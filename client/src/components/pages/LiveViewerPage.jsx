import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Send, X, ArrowLeft, Heart, Gift } from 'lucide-react';
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
    const [user, setUser] = useState(null);
    const videoRef = useRef(null);
    const wsRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const anonymousIdRef = useRef(`anonymous-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    
    // 認証状態を監視
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);
    
    // 現在のユーザーIDを取得（認証済みまたは匿名）
    const getUserId = () => user?.uid || anonymousIdRef.current;

    // ルーム情報を取得
    useEffect(() => {
        if (!roomId) return;

        const unsubscribe = onSnapshot(doc(db, 'liveRooms', roomId), (docSnap) => {
            if (docSnap.exists()) {
                const roomData = { id: docSnap.id, ...docSnap.data() };
                
                // 配信が終了状態かチェック
                if (roomData.status === 'ended' || roomData.isActive === false) {
                    toast({
                        title: '配信終了',
                        description: 'この配信は終了しました',
                        variant: 'destructive'
                    });
                    navigate('/live');
                    return;
                }
                
                setRoom(roomData);
                setViewers(roomData.viewers || 0);
            } else {
                toast({
                    title: '配信終了',
                    description: 'この配信は終了しました',
                    variant: 'destructive'
                });
                navigate('/live');
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
        if (!roomId) return;

        // ユーザーがログインしていなくても視聴可能
        setupWebRTC();

        return () => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'viewer-leave',
                    roomId,
                    userId: getUserId()
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
                userId: getUserId(),
                userName: user?.displayName || 'ゲスト',
                userAvatar: user?.photoURL || ''
            }));
        };

        ws.onmessage = async (event) => {
            const message = JSON.parse(event.data);
            console.log('📨 Viewer received:', message.type);

            switch (message.type) {
                case 'joined':
                    console.log('✅ Joined as viewer, waiting for broadcaster offer...');
                    setConnectionStatus('配信者の準備を待っています...');
                    break;

                case 'offer':
                    // 配信者からのofferを受信してanswerを作成
                    await handleOffer(message.offer);
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
                    navigate('/live');
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

    // 配信者からのOfferを処理してAnswerを作成
    const handleOffer = async (offer) => {
        try {
            console.log('📥 Received offer from broadcaster');
            setConnectionStatus('ピア接続を確立中...');

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

            peerConnectionRef.current = peerConnection;

            // リモートストリームを受信
            peerConnection.ontrack = (event) => {
                console.log('📺 Received remote stream');
                setRemoteStream(event.streams[0]);
                setIsConnecting(false);
                setConnectionStatus('配信中');
            };

            // ICE候補を配信者に送信
            peerConnection.onicecandidate = (event) => {
                if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: 'ice-candidate',
                        roomId,
                        userId: getUserId(),
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

            // リモートDescriptionを設定
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

            // Answerを作成
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            // Answerを配信者に送信
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'answer',
                    roomId,
                    userId: getUserId(),
                    data: answer
                }));
            }

            console.log('✅ Answer created and sent to broadcaster');
        } catch (error) {
            console.error('❌ Error handling offer:', error);
            setConnectionStatus('接続エラー');
            setIsConnecting(false);
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
        if (!newMessage.trim()) return;
        
        // ログインしていない場合は送信できない
        if (!user) {
            toast({
                title: 'ログインが必要です',
                description: 'チャットを送信するにはログインしてください',
                variant: 'destructive'
            });
            return;
        }

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
        <div className="fixed inset-0 bg-black overflow-hidden">
            {/* ビデオプレイヤー */}
            <div className="relative w-full h-full">
                {isConnecting ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
                        <div className="text-center">
                            <div className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-solid border-pink-500 border-r-transparent mb-6"></div>
                            <p className="text-white text-lg font-medium">{connectionStatus}</p>
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

                {/* ヘッダー - 配信者情報とLIVE表示 */}
                <div className="absolute top-0 left-0 right-0 p-4 z-10">
                    <div className="flex items-start justify-between">
                        {/* 左側: 配信者情報 */}
                        <div className="flex items-center space-x-3 flex-1">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="relative"
                            >
                                <img
                                    src={room.creatorAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default'}
                                    alt={room.creatorName}
                                    className="w-12 h-12 rounded-full border-2 border-pink-500 object-cover"
                                />
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-black animate-pulse"></div>
                            </motion.div>
                            <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                    <h2 className="text-white font-bold text-base truncate max-w-[120px]">{room.creatorName}</h2>
                                    <div className="flex items-center space-x-1 bg-red-500 px-2 py-0.5 rounded-md">
                                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                                        <span className="text-white text-xs font-bold">LIVE</span>
                                    </div>
                                </div>
                                <p className="text-white/90 text-sm mt-0.5">{room.title}</p>
                            </div>
                        </div>

                        {/* 右側: 視聴者数 */}
                        <motion.div
                            initial={{ x: 50, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            className="flex items-center space-x-1.5 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20"
                        >
                            <Users className="w-4 h-4 text-white" />
                            <span className="text-white text-sm font-bold" data-testid="text-viewer-count">
                                {viewers}
                            </span>
                        </motion.div>
                    </div>
                </div>

                {/* 右側インタラクションボタン */}
                <div className="absolute right-2 sm:right-4 bottom-28 sm:bottom-32 flex flex-col items-center space-y-4 sm:space-y-6 z-10">
                    {/* いいねボタン */}
                    <motion.button
                        whileTap={{ scale: 0.85 }}
                        className="flex flex-col items-center space-y-0.5 sm:space-y-1"
                        data-testid="button-like"
                    >
                        <div className="w-11 h-11 sm:w-12 sm:h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 hover:bg-pink-500/30 transition-all">
                            <Heart className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        </div>
                        <span className="text-white text-[10px] sm:text-xs font-medium">いいね</span>
                    </motion.button>

                    {/* 投げ銭ボタン */}
                    <motion.button
                        whileTap={{ scale: 0.85 }}
                        className="flex flex-col items-center space-y-0.5 sm:space-y-1"
                        data-testid="button-gift"
                    >
                        <div className="w-11 h-11 sm:w-12 sm:h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 hover:bg-pink-500/30 transition-all">
                            <Gift className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        </div>
                        <span className="text-white text-[10px] sm:text-xs font-medium">投げ銭</span>
                    </motion.button>
                </div>

                {/* チャットメッセージ表示エリア */}
                <div className="absolute left-1 sm:left-2 bottom-28 sm:bottom-32 max-h-[120px] sm:max-h-[180px] max-w-[40%] sm:max-w-[45%] overflow-y-auto space-y-1 sm:space-y-1.5 z-10 pointer-events-none">
                    <AnimatePresence>
                        {messages.slice(-5).map((msg) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="bg-black/40 backdrop-blur-md px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-lg sm:rounded-xl inline-block border border-white/10"
                            >
                                <div className="flex items-start space-x-1 sm:space-x-1.5">
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

                {/* チャット入力欄 */}
                <div className="absolute bottom-4 sm:bottom-6 left-2 right-2 sm:left-4 sm:right-4 z-10">
                    <form onSubmit={handleSendMessage} className="flex items-center space-x-1.5 sm:space-x-2">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder={user ? "コメントを入力..." : "ログインしてチャット"}
                                disabled={!user}
                                className="w-full bg-[#3a3a3a]/90 backdrop-blur-md text-white placeholder-gray-400 px-4 py-2.5 sm:px-5 sm:py-3 rounded-full focus:outline-none focus:ring-2 focus:ring-pink-500/50 border border-white/10 disabled:opacity-60 text-sm sm:text-base"
                                data-testid="input-chat-message"
                            />
                        </div>
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            type="submit"
                            disabled={!newMessage.trim() || !user}
                            className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-pink-500 to-pink-600 rounded-full flex items-center justify-center shadow-lg shadow-pink-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                            data-testid="button-send-message"
                        >
                            <Send className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </motion.button>
                    </form>
                </div>

                {/* 戻るボタン */}
                <motion.button
                    initial={{ x: -50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => navigate('/live')}
                    className="absolute top-4 left-4 w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 z-20"
                    data-testid="button-back"
                >
                    <ArrowLeft className="w-5 h-5 text-white" />
                </motion.button>
            </div>
        </div>
    );
};

export default LiveViewerPage;
