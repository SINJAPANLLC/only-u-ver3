import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Send, X, ArrowLeft, Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection, addDoc, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { useToast } from '../../hooks/use-toast';

const LiveViewerPage = () => {
    const { t } = useTranslation();
    const { roomId } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [room, setRoom] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [viewers, setViewers] = useState(0);
    const [remoteStream, setRemoteStream] = useState(null);
    const [isConnecting, setIsConnecting] = useState(true);
    const [connectionStatus, setConnectionStatus] = useState('接続中...');
    const videoRef = useRef(null);
    const wsRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const user = auth.currentUser;

    // ルーム情報を取得
    useEffect(() => {
        if (!roomId) return;

        const unsubscribe = onSnapshot(doc(db, 'liveRooms', roomId), (docSnap) => {
            if (docSnap.exists()) {
                const roomData = { id: docSnap.id, ...docSnap.data() };
                setRoom(roomData);
                setViewers(roomData.viewers || 0);
            } else {
                toast({
                    title: '配信終了',
                    description: 'この配信は終了しました',
                    variant: 'destructive'
                });
                navigate('/rankingpage');
            }
        });

        return () => unsubscribe();
    }, [roomId, navigate, toast]);

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

    // WebRTC接続を確立
    useEffect(() => {
        if (!roomId || !user) return;

        setupWebRTC();

        return () => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'viewer-leave',
                    roomId,
                    userId: user.uid
                }));
                wsRef.current.close();
            }
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
            }
        };
    }, [roomId, user]);

    // リモートストリームを更新
    useEffect(() => {
        if (remoteStream && videoRef.current) {
            videoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    // WebRTCセットアップ
    const setupWebRTC = async () => {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/signaling`;
        
        console.log('🔌 Viewer connecting to signaling server:', wsUrl);
        
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('✅ WebSocket connected');
            setConnectionStatus('接続完了');
            
            ws.send(JSON.stringify({
                type: 'viewer-join',
                roomId,
                userId: user.uid,
                userName: user.displayName || 'Anonymous',
                userAvatar: user.photoURL || ''
            }));
        };

        ws.onmessage = async (event) => {
            const message = JSON.parse(event.data);
            console.log('📨 Viewer received:', message.type);

            switch (message.type) {
                case 'joined':
                    console.log('✅ Joined as viewer');
                    await createOffer();
                    break;

                case 'answer':
                    await handleAnswer(message.answer);
                    break;

                case 'ice-candidate':
                    await handleIceCandidate(message.candidate);
                    break;

                case 'viewer-count':
                    setViewers(message.count);
                    break;

                case 'broadcaster-left':
                    toast({
                        title: '配信終了',
                        description: '配信者が退出しました',
                        variant: 'destructive'
                    });
                    navigate('/rankingpage');
                    break;

                case 'error':
                    console.error('❌ Signaling error:', message.message);
                    setConnectionStatus('接続エラー');
                    setIsConnecting(false);
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
            setConnectionStatus('接続エラー');
            setIsConnecting(false);
        };

        ws.onclose = () => {
            console.log('🔌 WebSocket disconnected');
        };
    };

    // Offerを作成して送信
    const createOffer = async () => {
        try {
            setConnectionStatus('ピア接続を確立中...');

            const peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });

            peerConnectionRef.current = peerConnection;

            peerConnection.ontrack = (event) => {
                console.log('📺 Received remote stream');
                setRemoteStream(event.streams[0]);
                setIsConnecting(false);
                setConnectionStatus('接続完了');
            };

            peerConnection.onicecandidate = (event) => {
                if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: 'ice-candidate',
                        roomId,
                        userId: user.uid,
                        data: event.candidate
                    }));
                }
            };

            peerConnection.onconnectionstatechange = () => {
                console.log('🔗 Connection state:', peerConnection.connectionState);
                
                if (peerConnection.connectionState === 'connected') {
                    setIsConnecting(false);
                    setConnectionStatus('配信中');
                } else if (peerConnection.connectionState === 'disconnected') {
                    setConnectionStatus('切断されました');
                } else if (peerConnection.connectionState === 'failed') {
                    setConnectionStatus('接続に失敗しました');
                    toast({
                        title: '接続エラー',
                        description: '配信への接続に失敗しました',
                        variant: 'destructive'
                    });
                }
            };

            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'offer',
                    roomId,
                    userId: user.uid,
                    data: offer
                }));
            }

            console.log('✅ Offer sent to broadcaster');
        } catch (error) {
            console.error('❌ Error creating offer:', error);
            setConnectionStatus('接続エラー');
            setIsConnecting(false);
        }
    };

    // Answerを処理
    const handleAnswer = async (answer) => {
        try {
            if (peerConnectionRef.current) {
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
                console.log('✅ Answer received and set');
            }
        } catch (error) {
            console.error('❌ Error handling answer:', error);
        }
    };

    // ICE候補を処理
    const handleIceCandidate = async (candidate) => {
        try {
            if (peerConnectionRef.current && candidate) {
                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                console.log('✅ ICE candidate added');
            }
        } catch (error) {
            console.error('❌ Error adding ICE candidate:', error);
        }
    };

    // チャットメッセージを送信
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !user) return;

        try {
            await addDoc(collection(db, `liveChat/${roomId}/messages`), {
                userId: user.uid,
                userName: user.displayName || 'Anonymous',
                userAvatar: user.photoURL || '',
                message: newMessage,
                timestamp: serverTimestamp()
            });

            setNewMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    if (!room) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-white text-center">
                    <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-pink-500 border-r-transparent mb-4"></div>
                    <p>配信を読み込み中...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black">
            {/* ビデオプレイヤー */}
            <div className="relative w-full h-full">
                {isConnecting ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black">
                        <div className="text-center">
                            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-pink-500 border-r-transparent mb-4"></div>
                            <p className="text-white text-lg">{connectionStatus}</p>
                        </div>
                    </div>
                ) : (
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                        data-testid="video-live-stream"
                    />
                )}

                {/* ヘッダー */}
                <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent">
                    <div className="flex items-center justify-between">
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => navigate('/rankingpage')}
                            className="p-2 bg-black/40 rounded-full"
                            data-testid="button-back"
                        >
                            <ArrowLeft className="w-6 h-6 text-white" />
                        </motion.button>

                        <div className="flex items-center space-x-2 bg-red-500/90 px-3 py-1 rounded-full">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                            <span className="text-white text-sm font-bold">LIVE</span>
                        </div>

                        <div className="flex items-center space-x-2 bg-black/40 px-3 py-1 rounded-full">
                            <Users className="w-4 h-4 text-white" />
                            <span className="text-white text-sm font-bold" data-testid="text-viewer-count">
                                {viewers}
                            </span>
                        </div>
                    </div>

                    <div className="mt-3 flex items-center space-x-3">
                        <img
                            src={room.creatorAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default'}
                            alt={room.creatorName}
                            className="w-10 h-10 rounded-full border-2 border-pink-500"
                        />
                        <div>
                            <h2 className="text-white font-bold">{room.creatorName}</h2>
                            <p className="text-white/80 text-sm">{room.title}</p>
                        </div>
                    </div>
                </div>

                {/* チャットオーバーレイ */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                    <div className="max-h-48 overflow-y-auto mb-3 space-y-2">
                        {messages.slice(-10).map((msg) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-black/40 backdrop-blur-sm px-3 py-2 rounded-lg"
                            >
                                <div className="flex items-start space-x-2">
                                    <img
                                        src={msg.userAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default'}
                                        alt={msg.userName}
                                        className="w-6 h-6 rounded-full"
                                    />
                                    <div className="flex-1">
                                        <p className="text-pink-400 text-xs font-bold">{msg.userName}</p>
                                        <p className="text-white text-sm break-words">{msg.message}</p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="コメントを入力..."
                            className="flex-1 bg-black/40 backdrop-blur-sm text-white px-4 py-2 rounded-full focus:outline-none focus:ring-2 focus:ring-pink-500"
                            data-testid="input-chat-message"
                        />
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            type="submit"
                            className="p-2 bg-pink-500 rounded-full"
                            data-testid="button-send-message"
                        >
                            <Send className="w-5 h-5 text-white" />
                        </motion.button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LiveViewerPage;
