import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Send, Radio, Users, Heart, Gift, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, where, getDocs, doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import BottomNavigationWithCreator from '../BottomNavigationWithCreator';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { loadStripe } from '@stripe/stripe-js';
import { useLiveViewer } from '@/hooks/useLiveViewer';

const RankingPage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [liveRooms, setLiveRooms] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [messages, setMessages] = useState({});
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [viewerCounts, setViewerCounts] = useState({});
    const [likes, setLikes] = useState({});
    const [isLiking, setIsLiking] = useState(false);
    const [showHeartAnimation, setShowHeartAnimation] = useState(false);
    const [showTipModal, setShowTipModal] = useState(false);
    const [selectedTipAmount, setSelectedTipAmount] = useState(null);
    const [isSendingTip, setIsSendingTip] = useState(false);
    const containerRef = useRef(null);
    const y = useMotionValue(0);
    const user = auth.currentUser;
    const { toast } = useToast();
    
    // 現在のルームを取得
    const currentRoom = liveRooms[currentIndex];
    
    // リアルライブ配信の場合のみWebRTC接続
    const liveViewer = useLiveViewer(
        currentRoom?.isRealLive ? currentRoom.id : null,
        currentRoom?.isRealLive
    );

    // 画像URLをプロキシURLに変換するヘルパー関数
    const getProxyImageUrl = (url) => {
        if (!url) return '';
        
        // Base64エンコードされた画像データの場合はそのまま返す
        if (url.startsWith('data:image/')) {
            return url;
        }
        
        // 既にプロキシURLの場合はそのまま返す
        if (url.startsWith('/api/proxy/')) {
            return url;
        }
        
        // Bunny CDN URLの場合
        if (url.includes('only-u.fun') || url.includes('bunnycdn.com')) {
            const filename = url.split('/').pop();
            return `/api/proxy/public/${filename}`;
        }
        
        // 古いReplit URLやその他の外部URLの場合
        if (url.startsWith('http')) {
            // ファイル名を抽出してプロキシ経由で取得
            const filename = url.split('/').pop();
            return `/api/proxy/public/${filename}`;
        }
        
        // それ以外の場合はそのまま返す
        return url;
    };

    // アクティブなライブルームデータを取得
    useEffect(() => {
        const fetchLiveRooms = async () => {
            try {
                // リアルタイムのライブルームを取得
                // Note: インデックス不要にするため、orderByを削除してクライアント側でソート
                const liveQuery = query(
                    collection(db, 'liveRooms'),
                    where('isActive', '==', true),
                    limit(20)
                );
                
                const unsubscribe = onSnapshot(liveQuery, (snapshot) => {
                    const rooms = [];
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        rooms.push({
                            id: doc.id,
                            title: data.title || 'ライブ配信中',
                            creatorName: data.creatorName || 'Anonymous',
                            creatorAvatar: data.creatorAvatar || '',
                            videoUrl: null, // WebRTCを使用
                            isLive: true,
                            isRealLive: true,
                            viewers: data.viewers || 0,
                            creatorId: data.creatorId,
                            createdAt: data.createdAt
                        });
                    });
                    
                    // クライアント側で作成日時でソート
                    rooms.sort((a, b) => {
                        const timeA = a.createdAt?.toMillis?.() || 0;
                        const timeB = b.createdAt?.toMillis?.() || 0;
                        return timeB - timeA;
                    });
                    
                    // リアルタイムライブがない場合は、モックデータとして投稿の動画を使用
                    if (rooms.length === 0) {
                        const fallbackQuery = query(
                            collection(db, 'posts'),
                            where('visibility', '==', 'public'),
                            orderBy('createdAt', 'desc'),
                            limit(10)
                        );
                        
                        getDocs(fallbackQuery).then((snapshot) => {
                            const fallbackRooms = [];
                            snapshot.forEach(doc => {
                                const data = doc.data();
                                if (data.files && data.files.length > 0) {
                                    const videoFile = data.files.find(f => f.resourceType === 'video');
                                    if (videoFile) {
                                        fallbackRooms.push({
                                            id: doc.id,
                                            title: data.title || 'おすすめ動画',
                                            creatorName: data.userName || 'Anonymous',
                                            creatorAvatar: data.userAvatar || '',
                                            creatorId: data.userId || null,
                                            userId: data.userId || null,
                                            videoUrl: videoFile.url?.startsWith('http') 
                                                ? `/api/proxy/${videoFile.url.split('/').pop()}`
                                                : videoFile.url,
                                            thumbnailUrl: videoFile.thumbnailUrl || '',
                                            isLive: false,
                                            isRealLive: false,
                                            viewers: Math.floor(Math.random() * 1000) + 100,
                                            likes: data.likes || 0
                                        });
                                    }
                                }
                            });
                            setLiveRooms(fallbackRooms);
                        });
                    } else {
                        setLiveRooms(rooms);
                    }
                });
                
                return () => unsubscribe();
            } catch (error) {
                console.error('Error fetching live rooms:', error);
            }
        };

        fetchLiveRooms();
    }, []);

    // 現在のルームのチャットメッセージを取得
    useEffect(() => {
        if (!liveRooms[currentIndex]) return;

        const roomId = liveRooms[currentIndex].id;
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
            setMessages(prev => ({
                ...prev,
                [roomId]: msgs.reverse()
            }));
        });

        return () => unsubscribe();
    }, [currentIndex, liveRooms]);

    // メッセージ送信
    const handleSendMessage = async (e) => {
        e.preventDefault();
        
        if (!newMessage.trim() || !user || !liveRooms[currentIndex]) return;
        
        setIsSending(true);
        
        try {
            const roomId = liveRooms[currentIndex].id;
            await addDoc(collection(db, `liveChat/${roomId}/messages`), {
                text: newMessage.trim(),
                userId: user.uid,
                userName: user.displayName || 'Anonymous',
                userPhoto: user.photoURL || '',
                timestamp: serverTimestamp()
            });
            
            setNewMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setIsSending(false);
        }
    };

    // いいね機能
    const handleLike = async () => {
        if (!user || !liveRooms[currentIndex] || isLiking) return;
        
        setIsLiking(true);
        setShowHeartAnimation(true);
        
        try {
            const roomId = liveRooms[currentIndex].id;
            const roomRef = doc(db, liveRooms[currentIndex].isRealLive ? 'liveRooms' : 'posts', roomId);
            
            await updateDoc(roomRef, {
                likes: increment(1)
            });
            
            // ローカル状態を更新
            setLikes(prev => ({
                ...prev,
                [roomId]: (prev[roomId] || 0) + 1
            }));
            
            // アニメーション終了後に非表示
            setTimeout(() => setShowHeartAnimation(false), 1000);
        } catch (error) {
            console.error('Error liking:', error);
            toast({
                title: 'エラー',
                description: 'いいねに失敗しました',
                variant: 'destructive'
            });
        } finally {
            setIsLiking(false);
        }
    };

    // 投げ銭機能
    const handleOpenTipModal = () => {
        if (!user) {
            toast({
                title: 'ログインが必要です',
                description: '投げ銭を送るにはログインしてください',
                variant: 'destructive'
            });
            return;
        }
        
        const currentRoom = liveRooms[currentIndex];
        if (!currentRoom) return;
        
        // creatorIdがない場合は投げ銭できない
        if (!currentRoom.creatorId && !currentRoom.userId) {
            toast({
                title: '投げ銭できません',
                description: 'このコンテンツには投げ銭できません',
                variant: 'destructive'
            });
            return;
        }
        
        setShowTipModal(true);
    };

    const handleSendTip = async (amount) => {
        if (!user || !liveRooms[currentIndex] || isSendingTip) return;
        
        setIsSendingTip(true);
        setSelectedTipAmount(amount);
        
        try {
            const currentRoom = liveRooms[currentIndex];
            
            // Stripe Checkoutセッションを作成
            const response = await fetch('/api/create-tip-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: amount,
                    currency: 'jpy',
                    description: `投げ銭: ${currentRoom.title}`,
                    creatorId: currentRoom.creatorId || currentRoom.userId,
                    creatorName: currentRoom.creatorName,
                    roomId: currentRoom.id,
                    userId: user.uid,
                    userEmail: user.email
                })
            });
            
            if (!response.ok) {
                throw new Error('Checkout session creation failed');
            }
            
            const { sessionId } = await response.json();
            
            // Stripe Checkoutにリダイレクト
            const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);
            
            const { error } = await stripe.redirectToCheckout({
                sessionId: sessionId
            });
            
            if (error) {
                throw error;
            }
        } catch (error) {
            console.error('Error sending tip:', error);
            toast({
                title: 'エラー',
                description: '投げ銭の送信に失敗しました',
                variant: 'destructive'
            });
            setIsSendingTip(false);
            setSelectedTipAmount(null);
        }
    };

    // 縦スワイプでルーム切り替え
    const handleDragEnd = (event, info) => {
        const offsetThreshold = 80;
        const velocityThreshold = 500;
        
        // 上スワイプ（次へ）
        if ((info.offset.y < -offsetThreshold || info.velocity.y < -velocityThreshold) && 
            currentIndex < liveRooms.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } 
        // 下スワイプ（前へ）
        else if ((info.offset.y > offsetThreshold || info.velocity.y > velocityThreshold) && 
                 currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    const currentMessages = currentRoom ? messages[currentRoom.id] || [] : [];

    return (
        <div 
            ref={containerRef}
            className="fixed inset-0 bg-black overflow-hidden"
            style={{ height: '100vh', width: '100vw' }}
        >
            <AnimatePresence mode="wait">
                {currentRoom && (
                    <motion.div
                        key={currentRoom.id}
                        drag="y"
                        dragConstraints={containerRef}
                        dragElastic={0.3}
                        dragMomentum={false}
                        onDragEnd={handleDragEnd}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-0 flex items-center justify-center touch-pan-y"
                        data-testid={`live-room-${currentRoom.id}`}
                    >
                        {/* 動画背景 - WebRTCライブまたは録画動画 */}
                        {currentRoom.isRealLive ? (
                            // リアルライブ配信: WebRTC
                            <>
                                <video
                                    ref={liveViewer.videoRef}
                                    autoPlay
                                    playsInline
                                    className="absolute inset-0 w-full h-full object-contain bg-black"
                                />
                                {liveViewer.isConnecting && (
                                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                                        <div className="text-center">
                                            <Radio className="w-16 h-16 text-pink-500 mx-auto mb-4 animate-pulse" />
                                            <p className="text-white text-lg font-bold">{liveViewer.connectionStatus}</p>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : currentRoom.videoUrl ? (
                            // フォールバック動画: 通常のvideo要素
                            <video
                                key={currentRoom.videoUrl}
                                src={currentRoom.videoUrl}
                                autoPlay
                                loop
                                muted
                                playsInline
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                        ) : null}

                        {/* グラデーションオーバーレイ */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />

                        {/* トップ情報バー */}
                        <div className="absolute top-0 left-0 right-0 p-4 safe-top z-20">
                            <div className="flex items-center justify-between">
                                {/* クリエイター情報 */}
                                <div className="flex items-center space-x-3">
                                    <div className="relative">
                                        <img
                                            src={currentRoom.creatorAvatar && currentRoom.creatorAvatar.trim() !== '' 
                                                ? getProxyImageUrl(currentRoom.creatorAvatar)
                                                : `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentRoom.creatorName}`
                                            }
                                            alt={currentRoom.creatorName}
                                            className="w-12 h-12 rounded-full object-cover border-2 border-pink-500 bg-gradient-to-br from-pink-500 to-pink-600"
                                            onError={(e) => {
                                                e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentRoom.creatorName}`;
                                            }}
                                        />
                                        <motion.div
                                            animate={{ scale: [1, 1.2, 1] }}
                                            transition={{ repeat: Infinity, duration: 2 }}
                                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-black"
                                        />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold text-sm">{currentRoom.creatorName}</h3>
                                        <div className="flex items-center space-x-2 text-white/80 text-xs">
                                            <Radio className="w-3 h-3" />
                                            <span>LIVE</span>
                                        </div>
                                    </div>
                                </div>

                                {/* 視聴者数 */}
                                <div className="flex items-center space-x-2 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
                                    <Users className="w-4 h-4 text-white" />
                                    <span className="text-white text-sm font-bold">
                                        {currentRoom.isRealLive && liveViewer.viewers > 0 
                                            ? liveViewer.viewers 
                                            : currentRoom.viewers}
                                    </span>
                                </div>
                            </div>

                            {/* タイトル */}
                            <div className="mt-3 bg-black/30 backdrop-blur-sm px-3 py-2 rounded-lg">
                                <p className="text-white text-sm font-medium">{currentRoom.title}</p>
                            </div>
                        </div>

                        {/* チャットメッセージエリア */}
                        <div className="absolute bottom-32 left-0 right-0 px-4 space-y-2 max-h-64 overflow-y-auto z-10">
                            <AnimatePresence>
                                {currentMessages.slice(-5).map((message, index) => (
                                    <motion.div
                                        key={message.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="bg-black/40 backdrop-blur-sm px-3 py-2 rounded-lg max-w-xs"
                                        data-testid={`chat-message-${message.id}`}
                                    >
                                        <div className="flex items-start space-x-2">
                                            {message.userPhoto && (
                                                <img
                                                    src={getProxyImageUrl(message.userPhoto)}
                                                    alt={message.userName}
                                                    className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                                                    onError={(e) => {
                                                        e.target.style.display = 'none';
                                                    }}
                                                />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <span className="text-pink-400 font-bold text-xs">{message.userName}</span>
                                                <p className="text-white text-sm break-words">{message.text}</p>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        {/* サイドアクションボタン */}
                        <div className="absolute right-4 bottom-40 space-y-4 z-20">
                            <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={handleLike}
                                disabled={!user || isLiking}
                                className="flex flex-col items-center"
                                data-testid="button-like"
                            >
                                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                    <Heart className={`w-6 h-6 ${isLiking ? 'text-pink-500 fill-pink-500' : 'text-white'}`} />
                                </div>
                                <span className="text-white text-xs mt-1">
                                    {likes[currentRoom?.id] || currentRoom?.likes || 0}
                                </span>
                            </motion.button>

                            {(currentRoom?.creatorId || currentRoom?.userId) && (
                                <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={handleOpenTipModal}
                                    className="flex flex-col items-center"
                                    data-testid="button-tip"
                                >
                                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                        <Gift className="w-6 h-6 text-white" />
                                    </div>
                                    <span className="text-white text-xs mt-1">投げ銭</span>
                                </motion.button>
                            )}
                        </div>

                        {/* ハートアニメーション */}
                        <AnimatePresence>
                            {showHeartAnimation && (
                                <motion.div
                                    initial={{ scale: 0, opacity: 1, y: 0 }}
                                    animate={{ scale: 3, opacity: 0, y: -100 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 1 }}
                                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
                                >
                                    <Heart className="w-16 h-16 text-pink-500 fill-pink-500" />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* メッセージ入力エリア */}
                        <div className="absolute bottom-20 left-0 right-0 px-4 safe-bottom z-20">
                            <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder={user ? "コメントを入力..." : "ログインしてコメント"}
                                    disabled={!user || isSending}
                                    className="flex-1 px-4 py-2.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-pink-500 disabled:opacity-50"
                                    data-testid="input-chat-message"
                                />
                                <motion.button
                                    type="submit"
                                    disabled={!user || !newMessage.trim() || isSending}
                                    whileTap={{ scale: 0.9 }}
                                    className="p-2.5 rounded-full bg-gradient-to-r from-pink-500 to-pink-600 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                                    data-testid="button-send-chat"
                                >
                                    <Send className="w-5 h-5" />
                                </motion.button>
                            </form>
                        </div>

                        {/* スワイプヒント */}
                        {liveRooms.length > 1 && (
                            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
                                <div className="flex flex-col items-center space-y-1 text-white/60 text-xs">
                                    {currentIndex < liveRooms.length - 1 && (
                                        <motion.div
                                            animate={{ y: [0, 5, 0] }}
                                            transition={{ repeat: Infinity, duration: 1.5 }}
                                        >
                                            ↓ スワイプで次へ
                                        </motion.div>
                                    )}
                                    {currentIndex > 0 && (
                                        <motion.div
                                            animate={{ y: [0, -5, 0] }}
                                            transition={{ repeat: Infinity, duration: 1.5 }}
                                        >
                                            ↑ スワイプで前へ
                                        </motion.div>
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ボトムナビゲーション */}
            <div className="absolute bottom-0 left-0 right-0 z-30">
                <BottomNavigationWithCreator active="ranking" />
            </div>

            {/* 投げ銭モーダル */}
            <Dialog open={showTipModal} onOpenChange={setShowTipModal}>
                <DialogContent className="sm:max-w-md bg-gradient-to-br from-gray-900 to-black border-pink-500/20">
                    <DialogHeader>
                        <DialogTitle className="text-white text-xl font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent">
                            投げ銭を送る
                        </DialogTitle>
                        <DialogDescription className="text-gray-400">
                            {currentRoom?.creatorName} さんを応援しよう！
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid grid-cols-2 gap-3 py-4">
                        {[500, 1000, 3000, 5000, 10000].map((amount) => (
                            <motion.button
                                key={amount}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleSendTip(amount)}
                                disabled={isSendingTip}
                                className={`
                                    relative overflow-hidden rounded-lg p-4
                                    bg-gradient-to-br from-pink-500/10 to-pink-600/10
                                    border-2 border-pink-500/30
                                    hover:border-pink-500 hover:from-pink-500/20 hover:to-pink-600/20
                                    transition-all duration-200
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                    ${selectedTipAmount === amount ? 'ring-2 ring-pink-500' : ''}
                                `}
                                data-testid={`button-tip-amount-${amount}`}
                            >
                                <div className="flex flex-col items-center space-y-1">
                                    <Gift className="w-6 h-6 text-pink-500" />
                                    <span className="text-white font-bold text-lg">
                                        ¥{amount.toLocaleString()}
                                    </span>
                                </div>
                                {isSendingTip && selectedTipAmount === amount && (
                                    <div className="absolute inset-0 bg-pink-500/20 flex items-center justify-center">
                                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    </div>
                                )}
                            </motion.button>
                        ))}
                    </div>

                    <div className="text-xs text-gray-400 text-center">
                        ※ Stripe決済を利用します
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default RankingPage;
