import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Send, X, Video, Mic, MicOff, VideoOff, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, updateDoc, onSnapshot, collection, addDoc, query, orderBy, limit, serverTimestamp, getDoc } from 'firebase/firestore';
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
    const [userProfile, setUserProfile] = useState(null);
    const videoRef = useRef(null);
    const wsRef = useRef(null);
    const peerConnectionsRef = useRef({});
    const user = auth.currentUser;

    // ユーザープロフィール取得
    useEffect(() => {
        if (!user) return;

        const fetchUserProfile = async () => {
            try {
                const userDocRef = doc(db, 'users', user.uid);
                const userDocSnap = await getDoc(userDocRef);
                
                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    setUserProfile({
                        name: userData.name || userData.displayName || user.displayName || 'Anonymous',
                        avatar: userData.avatarUrl || userData.photoURL || user.photoURL || ''
                    });
                } else {
                    setUserProfile({
                        name: user.displayName || 'Anonymous',
                        avatar: user.photoURL || ''
                    });
                }
            } catch (error) {
                console.error('Error fetching user profile:', error);
                setUserProfile({
                    name: user.displayName || 'Anonymous',
                    avatar: user.photoURL || ''
                });
            }
        };

        fetchUserProfile();
    }, [user]);

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
                        width: { ideal: 1080 },
                        height: { ideal: 1920 },
                        facingMode: 'user',
                        aspectRatio: 9/16
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
                userName: userProfile?.name || user.displayName || 'Anonymous',
                userAvatar: userProfile?.avatar || user.photoURL || ''
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
                    // STUN servers - 無料で利用可能
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:3478' },
                    { urls: 'stun:stun3.l.google.com:19302' }
                    // TODO: TURNサーバーを追加（本番環境推奨）
                    // Open Relay: https://www.metered.ca/tools/openrelay/
                    // ExpressTURN: https://www.expressturn.com/
                    // 例: { urls: 'turn:turn.server.com:3478', username: 'user', credential: 'pass' }
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

            // Firestoreのルームを更新（削除ではなく終了状態に）
            await updateDoc(doc(db, 'liveRooms', roomId), {
                isActive: false,
                status: 'ended',
                endedAt: serverTimestamp(),
                viewers: 0
            });

            toast({
                title: '配信終了',
                description: 'ライブ配信を終了しました'
            });

            navigate('/live');
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
            <div className="fixed inset-0 bg-black flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-solid border-pink-500 border-r-transparent mb-6"></div>
                    <p className="text-white text-lg font-medium">配信を準備中...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black overflow-hidden">
            {/* ビデオプレビュー */}
            <div className="relative w-full h-full">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                    data-testid="video-broadcast"
                />

                {!isVideoEnabled && (
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
                        <motion.div
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-center"
                        >
                            <VideoOff className="w-24 h-24 text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-400 text-lg">カメラオフ</p>
                        </motion.div>
                    </div>
                )}

                {/* ヘッダー - 配信情報 */}
                <div className="absolute top-0 left-0 right-0 p-4 z-10">
                    <div className="flex items-start justify-between">
                        {/* 左側: 配信者情報とタイトル */}
                        <div className="flex items-center space-x-3 flex-1">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="relative"
                            >
                                <img
                                    src={userProfile?.avatar || user.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=broadcaster'}
                                    alt="あなた"
                                    className="w-12 h-12 rounded-full border-2 border-pink-500 object-cover"
                                    data-testid="img-broadcaster-avatar"
                                />
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-black animate-pulse"></div>
                            </motion.div>
                            <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                    <h2 className="text-white font-bold text-base truncate max-w-[120px]" data-testid="text-broadcaster-name">{userProfile?.name || user.displayName || 'Anonymous'}</h2>
                                    <div className="flex items-center space-x-1 bg-red-500 px-2 py-0.5 rounded-md">
                                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                                        <span className="text-white text-xs font-bold">配信中</span>
                                    </div>
                                </div>
                                <p className="text-white/90 text-sm mt-0.5 truncate max-w-[200px]">{room.title}</p>
                            </div>
                        </div>

                        {/* 右側: 視聴者数 */}
                        <motion.div
                            initial={{ x: 50, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            className="flex items-center space-x-1.5 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20"
                        >
                            <Eye className="w-4 h-4 text-white" />
                            <span className="text-white text-sm font-bold" data-testid="text-viewer-count">
                                {viewers}
                            </span>
                        </motion.div>
                    </div>
                </div>

                {/* コメント表示エリア - 左端コンパクト版 */}
                <div className="absolute left-1 sm:left-2 bottom-28 sm:bottom-32 max-h-[80px] sm:max-h-[100px] max-w-[40%] sm:max-w-[45%] overflow-y-auto space-y-1 z-10 pointer-events-none">
                    <AnimatePresence>
                        {messages.slice(-3).map((msg) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="bg-black/40 backdrop-blur-sm px-1.5 sm:px-2 py-1 rounded-lg inline-block border border-white/10"
                            >
                                <div className="flex items-start space-x-1">
                                    <img
                                        src={msg.userAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default'}
                                        alt={msg.userName}
                                        className="w-3 h-3 sm:w-4 sm:h-4 rounded-full flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-pink-400 text-[9px] sm:text-[10px] font-semibold truncate">{msg.userName}</p>
                                        <p className="text-white text-[10px] sm:text-xs break-words leading-tight">{msg.message}</p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* 配信コントロール */}
                <div className="absolute bottom-6 left-0 right-0 px-4 z-10">
                    <div className="flex items-center justify-center space-x-4">
                        {/* ビデオトグル */}
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={toggleVideo}
                            className={`w-14 h-14 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 transition-all ${
                                isVideoEnabled 
                                    ? 'bg-white/20 hover:bg-white/30' 
                                    : 'bg-red-500/90 hover:bg-red-600'
                            }`}
                            data-testid="button-toggle-video-live"
                        >
                            {isVideoEnabled ? (
                                <Video className="w-6 h-6 text-white" />
                            ) : (
                                <VideoOff className="w-6 h-6 text-white" />
                            )}
                        </motion.button>

                        {/* オーディオトグル */}
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={toggleAudio}
                            className={`w-14 h-14 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 transition-all ${
                                isAudioEnabled 
                                    ? 'bg-white/20 hover:bg-white/30' 
                                    : 'bg-red-500/90 hover:bg-red-600'
                            }`}
                            data-testid="button-toggle-audio-live"
                        >
                            {isAudioEnabled ? (
                                <Mic className="w-6 h-6 text-white" />
                            ) : (
                                <MicOff className="w-6 h-6 text-white" />
                            )}
                        </motion.button>

                        {/* 配信終了ボタン */}
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={handleEndLive}
                            className="px-8 py-3.5 rounded-full bg-gradient-to-r from-red-500 to-red-600 text-white font-bold shadow-lg shadow-red-500/30 flex items-center space-x-2 border border-red-400/30"
                            data-testid="button-end-live"
                        >
                            <X className="w-5 h-5" />
                            <span>配信終了</span>
                        </motion.button>
                    </div>

                    {/* ステータス表示 */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 text-center"
                    >
                        <div className="inline-flex items-center space-x-2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                            <div className="flex items-center space-x-1.5">
                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                <span className="text-white/80 text-sm">接続中</span>
                            </div>
                            <span className="text-white/40">•</span>
                            <span className="text-white/80 text-sm">{viewers} 人が視聴中</span>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default LiveBroadcastPage;
