import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Send, X, Video, Mic, MicOff, VideoOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, updateDoc, onSnapshot, collection, addDoc, query, orderBy, limit, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { useToast } from '../../hooks/use-toast';

const LiveBroadcastPage = () => {
    const { t } = useTranslation();
    const { roomId } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [room, setRoom] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [viewers, setViewers] = useState(0);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [localStream, setLocalStream] = useState(null);
    const videoRef = useRef(null);
    const wsRef = useRef(null);
    const peerConnectionsRef = useRef({});
    const user = auth.currentUser;

    // ルーム情報を取得
    useEffect(() => {
        if (!roomId) return;

        const unsubscribe = onSnapshot(doc(db, 'liveRooms', roomId), (docSnap) => {
            if (docSnap.exists()) {
                setRoom({ id: docSnap.id, ...docSnap.data() });
                setViewers(docSnap.data().viewers || 0);
            }
        });

        return () => unsubscribe();
    }, [roomId]);

    // チャットメッセージを取得
    useEffect(() => {
        if (!roomId) return;

        const q = query(
            collection(db, `liveChat/${roomId}/messages`),
            orderBy('timestamp', 'desc'),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = [];
            snapshot.forEach((doc) => {
                msgs.push({ id: doc.id, ...doc.data() });
            });
            setMessages(msgs.reverse());
        });

        return () => unsubscribe();
    }, [roomId]);

    // ローカルメディアストリームを取得
    useEffect(() => {
        const getLocalStream = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 720 },
                        height: { ideal: 1280 },
                        facingMode: 'user'
                    },
                    audio: true
                });

                setLocalStream(stream);

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }

                // WebRTCシグナリングを開始
                setupWebRTC(stream);
            } catch (error) {
                console.error('Error accessing media:', error);
                toast({
                    title: 'エラー',
                    description: 'カメラまたはマイクへのアクセスに失敗しました',
                    variant: 'destructive'
                });
            }
        };

        getLocalStream();

        return () => {
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
            Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
        };
    }, []);

    // WebSocketシグナリング接続
    const setupWebRTC = async (stream) => {
        if (!roomId || !user) return;

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/signaling`;
        
        console.log('🔌 Connecting to signaling server:', wsUrl);
        
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('✅ WebSocket connected');
            
            ws.send(JSON.stringify({
                type: 'join',
                roomId,
                userId: user.uid,
                userName: user.displayName || 'Anonymous',
                userAvatar: user.photoURL || ''
            }));
        };

        ws.onmessage = async (event) => {
            const message = JSON.parse(event.data);
            console.log('📨 Received signaling message:', message.type);

            switch (message.type) {
                case 'joined':
                    console.log('✅ Joined as broadcaster');
                    break;

                case 'new-viewer':
                    // 新しい視聴者が参加した - offerを作成して送信
                    await createOfferForViewer(message.viewerId, stream);
                    break;

                case 'answer':
                    // 視聴者からのanswerを受信
                    await handleViewerAnswer(message.viewerId, message.answer);
                    break;

                case 'ice-candidate':
                    await handleViewerIceCandidate(message.viewerId, message.candidate);
                    break;

                case 'viewer-count':
                    setViewers(message.count);
                    updateFirestoreViewerCount(message.count);
                    break;

                case 'error':
                    console.error('❌ Signaling error:', message.message);
                    toast({
                        title: 'エラー',
                        description: message.message,
                        variant: 'destructive'
                    });
                    break;
            }
        };

        ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
        };

        ws.onclose = () => {
            console.log('🔌 WebSocket disconnected');
        };
    };

    // 新しい視聴者のためにOfferを作成
    const createOfferForViewer = async (viewerId, stream) => {
        try {
            console.log(`🎬 Creating offer for viewer ${viewerId}`);

            const peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });

            // ストリームのトラックを追加
            stream.getTracks().forEach(track => {
                peerConnection.addTrack(track, stream);
            });

            // ICE候補をシグナリングサーバーに送信（視聴者IDを含める）
            peerConnection.onicecandidate = (event) => {
                if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: 'ice-candidate',
                        roomId,
                        userId: user.uid,
                        data: {
                            targetViewerId: viewerId,
                            candidate: event.candidate
                        }
                    }));
                }
            };

            peerConnection.onconnectionstatechange = () => {
                console.log(`🔗 Connection state for ${viewerId}:`, peerConnection.connectionState);
                
                if (peerConnection.connectionState === 'disconnected' || 
                    peerConnection.connectionState === 'failed') {
                    delete peerConnectionsRef.current[viewerId];
                    console.log(`🗑️ Removed peer connection for ${viewerId}`);
                }
            };

            // Offerを作成
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            // Offerをシグナリングサーバー経由で視聴者に送信
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'offer',
                    roomId,
                    userId: user.uid,
                    data: {
                        targetViewerId: viewerId,
                        sdp: offer
                    }
                }));
            }

            // ピア接続を保存（refに直接保存）
            peerConnectionsRef.current[viewerId] = peerConnection;

            console.log(`✅ Offer created and sent to viewer ${viewerId}`);
        } catch (error) {
            console.error('❌ Error creating offer for viewer:', error);
        }
    };

    // 視聴者からのAnswerを処理
    const handleViewerAnswer = async (viewerId, answer) => {
        try {
            console.log(`📥 Received answer from viewer ${viewerId}`);

            const peerConnection = peerConnectionsRef.current[viewerId];
            if (peerConnection) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                console.log(`✅ Answer set for viewer ${viewerId}`);
            } else {
                console.warn(`⚠️ No peer connection found for viewer ${viewerId}`);
                console.log('Current connections:', Object.keys(peerConnectionsRef.current));
            }
        } catch (error) {
            console.error('❌ Error handling viewer answer:', error);
        }
    };

    // 視聴者からのICE候補を処理
    const handleViewerIceCandidate = async (viewerId, candidate) => {
        try {
            const peerConnection = peerConnectionsRef.current[viewerId];
            if (peerConnection && candidate) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                console.log(`✅ Added ICE candidate from viewer ${viewerId}`);
            } else {
                console.warn(`⚠️ No peer connection for viewer ${viewerId} when adding ICE candidate`);
            }
        } catch (error) {
            console.error('❌ Error adding ICE candidate:', error);
        }
    };

    // Firestoreの視聴者数を更新
    const updateFirestoreViewerCount = async (count) => {
        try {
            await updateDoc(doc(db, 'liveRooms', roomId), {
                viewers: count
            });
        } catch (error) {
            console.error('Error updating viewer count:', error);
        }
    };

    // ビデオトグル
    const toggleVideo = () => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoEnabled(videoTrack.enabled);
            }
        }
    };

    // オーディオトグル
    const toggleAudio = () => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsAudioEnabled(audioTrack.enabled);
            }
        }
    };

    // 配信終了
    const handleEndLive = async () => {
        try {
            // WebSocket通知
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'leave',
                    roomId,
                    userId: user.uid
                }));
                wsRef.current.close();
            }

            // ストリームを停止
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }

            // すべてのピア接続を閉じる
            Object.values(peerConnectionsRef.current).forEach(pc => pc.close());

            // Firestoreのルームを削除
            await deleteDoc(doc(db, 'liveRooms', roomId));

            toast({
                title: '配信終了',
                description: 'ライブ配信を終了しました'
            });

            navigate('/rankingpage');
        } catch (error) {
            console.error('Error ending live:', error);
            toast({
                title: 'エラー',
                description: '配信の終了に失敗しました',
                variant: 'destructive'
            });
        }
    };

    if (!room) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <p className="text-white">読み込み中...</p>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black flex flex-col">
            {/* 配信プレビュー */}
            <div className="flex-1 relative">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
                    data-testid="video-broadcast"
                />

                {!isVideoEnabled && (
                    <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                        <VideoOff className="w-20 h-20 text-gray-600" />
                    </div>
                )}

                {/* グラデーションオーバーレイ */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />

                {/* トップ情報バー */}
                <div className="absolute top-0 left-0 right-0 p-4 safe-top z-20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 bg-red-500 px-3 py-1.5 rounded-full">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                            <span className="text-white text-sm font-bold">LIVE</span>
                        </div>

                        <div className="flex items-center space-x-2 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
                            <Users className="w-4 h-4 text-white" />
                            <span className="text-white text-sm font-bold">{viewers}</span>
                        </div>
                    </div>

                    <div className="mt-3 bg-black/30 backdrop-blur-sm px-3 py-2 rounded-lg">
                        <p className="text-white text-sm font-medium">{room.title}</p>
                    </div>
                </div>

                {/* チャットメッセージ */}
                <div className="absolute bottom-32 left-0 right-0 px-4 space-y-2 max-h-64 overflow-y-auto z-10">
                    {messages.slice(-5).map((message) => (
                        <motion.div
                            key={message.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-black/40 backdrop-blur-sm px-3 py-2 rounded-lg max-w-xs"
                        >
                            <div className="flex items-start space-x-2">
                                {message.userPhoto && (
                                    <img
                                        src={message.userPhoto}
                                        alt={message.userName}
                                        className="w-6 h-6 rounded-full object-cover"
                                    />
                                )}
                                <div>
                                    <span className="text-pink-400 font-bold text-xs">{message.userName}</span>
                                    <p className="text-white text-sm">{message.text}</p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* コントロール */}
                <div className="absolute bottom-4 left-0 right-0 px-4 safe-bottom z-20">
                    <div className="flex items-center justify-center space-x-4 mb-4">
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={toggleVideo}
                            className={`p-3 rounded-full ${
                                isVideoEnabled ? 'bg-white/20' : 'bg-red-500'
                            }`}
                            data-testid="button-toggle-video-live"
                        >
                            {isVideoEnabled ? (
                                <Video className="w-6 h-6 text-white" />
                            ) : (
                                <VideoOff className="w-6 h-6 text-white" />
                            )}
                        </motion.button>

                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={toggleAudio}
                            className={`p-3 rounded-full ${
                                isAudioEnabled ? 'bg-white/20' : 'bg-red-500'
                            }`}
                            data-testid="button-toggle-audio-live"
                        >
                            {isAudioEnabled ? (
                                <Mic className="w-6 h-6 text-white" />
                            ) : (
                                <MicOff className="w-6 h-6 text-white" />
                            )}
                        </motion.button>

                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={handleEndLive}
                            className="px-6 py-3 rounded-full bg-red-500 text-white font-bold"
                            data-testid="button-end-live"
                        >
                            <X className="w-6 h-6" />
                        </motion.button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiveBroadcastPage;
