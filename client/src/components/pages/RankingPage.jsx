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
        // リアルタイムのライブルームを取得
        // Note: インデックス不要にするため、orderByを削除してクライアント側でソート
        const liveQuery = query(
            collection(db, 'liveRooms'),
            where('isActive', '==', true),
            limit(20)
        );
        
        const unsubscribe = onSnapshot(
            liveQuery, 
            (snapshot) => {
                const rooms = [];
                console.log('🔴 LIVE: Fetched liveRooms snapshot, size:', snapshot.size);
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    console.log('🔴 LIVE: Room data:', {
                        id: doc.id,
                        title: data.title,
                        isActive: data.isActive,
                        creatorId: data.creatorId,
                        creatorName: data.creatorName
                    });
                    
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
                
                console.log('🔴 LIVE: Total rooms found:', rooms.length);
                
                // クライアント側で作成日時でソート
                rooms.sort((a, b) => {
                    const timeA = a.createdAt?.toMillis?.() || 0;
                    const timeB = b.createdAt?.toMillis?.() || 0;
                    return timeB - timeA;
                });
                
                // リアルタイムライブがない場合は、モックデータとして投稿の動画を使用
                if (rooms.length === 0) {
                    console.log('🔴 LIVE: No live rooms, showing fallback videos');
                    const fallbackQuery = query(
                        collection(db, 'posts'),
                        where('visibility', '==', 'public'),
                        orderBy('createdAt', 'desc'),
                        limit(10)
                    );
                    
                    getDocs(fallbackQuery).then(async (snapshot) => {
                        const fallbackRooms = [];
                        const userIds = new Set();
                        
                        snapshot.forEach(doc => {
                            const data = doc.data();
                            if (data.files && data.files.length > 0 && data.userId) {
                                const videoFile = data.files.find(f => f.resourceType === 'video');
                                if (videoFile) {
                                    userIds.add(data.userId);
                                    fallbackRooms.push({
                                        id: doc.id,
                                        title: data.title || 'おすすめ動画',
                                        creatorName: data.userName || 'Anonymous',
                                        creatorAvatar: data.userAvatar || '',
                                        creatorId: data.userId,
                                        userId: data.userId,
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
                        
                        // usersコレクションからクリエイター情報を取得
                        if (userIds.size > 0) {
                            const userPromises = Array.from(userIds).map(userId => 
                                getDoc(doc(db, 'users', userId))
                            );
                            const userDocs = await Promise.all(userPromises);
                            const userMap = {};
                            
                            userDocs.forEach(userDoc => {
                                if (userDoc.exists()) {
                                    const userData = userDoc.data();
                                    userMap[userDoc.id] = {
                                        name: userData.name || userData.displayName || 'Anonymous',
                                        avatar: userData.avatarUrl || userData.photoURL || ''
                                    };
                                }
                            });
                            
                            // クリエイター情報を更新
                            fallbackRooms.forEach(room => {
                                if (userMap[room.userId]) {
                                    room.creatorName = userMap[room.userId].name;
                                    room.creatorAvatar = userMap[room.userId].avatar;
                                }
                            });
                        }
                        
                        setLiveRooms(fallbackRooms);
                    }).catch(error => {
                        console.error('Error fetching fallback rooms:', error);
                    });
                } else {
                    setLiveRooms(rooms);
                }
            },
            (error) => {
                console.error('Error fetching live rooms:', error);
            }
        );
        
        return () => unsubscribe();
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

                        {/* 美しいグラデーションオーバーレイ */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60" />
                        <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 via-transparent to-purple-500/10" />

                        {/* トップ情報バー - 洗練されたデザイン */}
                        <motion.div 
                            initial={{ y: -50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="absolute top-0 left-0 right-0 p-4 safe-top z-20"
                        >
                            <div className="flex items-center justify-between">
                                {/* クリエイター情報 - グラスモーフィズム */}
                                <motion.div 
                                    whileTap={{ scale: 0.98 }}
                                    className="flex items-center space-x-3 bg-black/40 backdrop-blur-xl px-4 py-2.5 rounded-2xl border border-white/10 shadow-2xl"
                                >
                                    <div className="relative">
                                        <motion.img
                                            whileHover={{ scale: 1.1 }}
                                            src={currentRoom.creatorAvatar && currentRoom.creatorAvatar.trim() !== '' 
                                                ? getProxyImageUrl(currentRoom.creatorAvatar)
                                                : '/logo192.png'
                                            }
                                            alt={currentRoom.creatorName}
                                            className="w-11 h-11 rounded-full object-cover border-2 border-pink-500 bg-white shadow-lg"
                                            onError={(e) => {
                                                if (e.target.src !== window.location.origin + '/logo192.png') {
                                                    e.target.src = '/logo192.png';
                                                }
                                            }}
                                        />
                                        <motion.div
                                            animate={{ 
                                                scale: [1, 1.3, 1],
                                                opacity: [1, 0.7, 1]
                                            }}
                                            transition={{ repeat: Infinity, duration: 1.5 }}
                                            className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-gradient-to-r from-red-500 to-pink-500 rounded-full border-2 border-black shadow-lg"
                                        />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold text-base drop-shadow-lg">{currentRoom.creatorName}</h3>
                                        <motion.div 
                                            animate={{ opacity: [1, 0.7, 1] }}
                                            transition={{ repeat: Infinity, duration: 2 }}
                                            className="flex items-center space-x-1.5 mt-0.5"
                                        >
                                            <div className="px-2 py-0.5 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center space-x-1">
                                                <Radio className="w-2.5 h-2.5 text-white" />
                                                <span className="text-white text-xs font-bold">LIVE</span>
                                            </div>
                                        </motion.div>
                                    </div>
                                </motion.div>

                                {/* 視聴者数 - エレガントなデザイン */}
                                <motion.div 
                                    whileHover={{ scale: 1.05 }}
                                    className="flex items-center space-x-2 bg-black/40 backdrop-blur-xl px-4 py-2.5 rounded-2xl border border-white/10 shadow-2xl"
                                >
                                    <Users className="w-4 h-4 text-pink-400" />
                                    <span className="text-white text-sm font-bold drop-shadow-lg">
                                        {currentRoom.isRealLive && liveViewer.viewers > 0 
                                            ? liveViewer.viewers 
                                            : currentRoom.viewers}
                                    </span>
                                </motion.div>
                            </div>

                            {/* タイトル - グラスモーフィズム */}
                            <motion.div 
                                initial={{ y: -20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="mt-3 bg-gradient-to-r from-black/50 to-black/30 backdrop-blur-xl px-4 py-3 rounded-2xl border border-white/10 shadow-2xl"
                            >
                                <p className="text-white text-sm font-medium drop-shadow-lg">{currentRoom.title}</p>
                            </motion.div>
                        </motion.div>

                        {/* チャットメッセージエリア - エレガントなデザイン */}
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="absolute bottom-32 left-0 right-0 px-4 space-y-2 max-h-64 overflow-y-auto z-10"
                        >
                            <AnimatePresence>
                                {currentMessages.slice(-5).map((message, index) => (
                                    <motion.div
                                        key={message.id}
                                        initial={{ opacity: 0, x: -30, scale: 0.9 }}
                                        animate={{ opacity: 1, x: 0, scale: 1 }}
                                        exit={{ opacity: 0, x: 30, scale: 0.9 }}
                                        transition={{ 
                                            delay: index * 0.05,
                                            type: "spring",
                                            stiffness: 300,
                                            damping: 25
                                        }}
                                        className="bg-gradient-to-r from-black/60 to-black/40 backdrop-blur-xl px-4 py-2.5 rounded-2xl max-w-xs border border-white/10 shadow-2xl"
                                        data-testid={`chat-message-${message.id}`}
                                    >
                                        <div className="flex items-start space-x-2.5">
                                            {message.userPhoto && (
                                                <img
                                                    src={getProxyImageUrl(message.userPhoto)}
                                                    alt={message.userName}
                                                    className="w-7 h-7 rounded-full object-cover flex-shrink-0 border-2 border-pink-400/30 shadow-lg"
                                                    onError={(e) => {
                                                        e.target.style.display = 'none';
                                                    }}
                                                />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <span className="text-pink-400 font-bold text-xs drop-shadow-lg">{message.userName}</span>
                                                <p className="text-white text-sm break-words drop-shadow-lg leading-relaxed">{message.text}</p>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </motion.div>

                        {/* サイドアクションボタン - 美しいグラスモーフィズム */}
                        <motion.div 
                            initial={{ x: 50, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="absolute right-4 bottom-40 space-y-5 z-20"
                        >
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleLike}
                                disabled={!user || isLiking}
                                className="flex flex-col items-center group"
                                data-testid="button-like"
                            >
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500/30 to-purple-500/30 backdrop-blur-xl flex items-center justify-center border border-white/20 shadow-2xl group-hover:from-pink-500/50 group-hover:to-purple-500/50 transition-all">
                                    <Heart className={`w-7 h-7 transition-all ${isLiking ? 'text-pink-500 fill-pink-500 scale-110' : 'text-white'}`} />
                                </div>
                                <span className="text-white text-xs mt-2 font-bold drop-shadow-lg">
                                    {likes[currentRoom?.id] || currentRoom?.likes || 0}
                                </span>
                            </motion.button>

                            {(currentRoom?.creatorId || currentRoom?.userId) && (
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleOpenTipModal}
                                    className="flex flex-col items-center group"
                                    data-testid="button-tip"
                                >
                                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-500/30 to-orange-500/30 backdrop-blur-xl flex items-center justify-center border border-white/20 shadow-2xl group-hover:from-yellow-500/50 group-hover:to-orange-500/50 transition-all">
                                        <Gift className="w-7 h-7 text-white" />
                                    </div>
                                    <span className="text-white text-xs mt-2 font-bold drop-shadow-lg">投げ銭</span>
                                </motion.button>
                            )}
                        </motion.div>

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

                        {/* メッセージ入力エリア - エレガントなデザイン */}
                        <motion.div 
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="absolute bottom-20 left-0 right-0 px-4 safe-bottom z-20"
                        >
                            <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
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
                                    whileHover={{ scale: 1.05 }}
                                    className="p-3 rounded-full bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl border border-white/20"
                                    data-testid="button-send-chat"
                                >
                                    <Send className="w-5 h-5" />
                                </motion.button>
                            </form>
                        </motion.div>

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
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default RankingPage;
