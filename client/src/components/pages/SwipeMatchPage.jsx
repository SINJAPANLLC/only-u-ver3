import { useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { Heart, X, MessageCircle, Sparkles, Users, MapPin, Briefcase, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { useToast } from '../../hooks/use-toast';
import BottomNavigationWithCreator from '../BottomNavigationWithCreator';

const SwipeMatchPage = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [candidates, setCandidates] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showMatchModal, setShowMatchModal] = useState(false);
    const [matchedUser, setMatchedUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('swipe'); // 'swipe' or 'matches'
    const [matches, setMatches] = useState([]);
    const user = auth.currentUser;

    const x = useMotionValue(0);
    const rotate = useTransform(x, [-200, 200], [-15, 15]);
    const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);
    
    // スワイプインジケーター用
    const likeOpacity = useTransform(x, [0, 100], [0, 1]);
    const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);

    // 画像URLをプロキシURLに変換
    const getProxyImageUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('data:image/')) return url;
        if (url.startsWith('/api/proxy/')) return url;
        if (url.includes('only-u.fun') || url.includes('bunnycdn.com')) {
            const filename = url.split('/').pop();
            return `/api/proxy/public/${filename}`;
        }
        if (url.startsWith('http')) {
            const filename = url.split('/').pop();
            return `/api/proxy/public/${filename}`;
        }
        return url;
    };

    // スワイプ候補者を取得
    useEffect(() => {
        const fetchCandidates = async () => {
            if (!user) return;

            try {
                setLoading(true);
                
                // 既にいいねしたユーザーを取得
                const likesRef = collection(db, `userLikes/${user.uid}/likes`);
                const likesSnapshot = await getDocs(likesRef);
                const likedUserIds = likesSnapshot.docs.map(doc => doc.id);

                // 全ユーザーを取得（自分と既にいいねしたユーザーを除く）
                const usersRef = collection(db, 'users');
                const usersSnapshot = await getDocs(usersRef);
                
                const candidatesList = usersSnapshot.docs
                    .filter(doc => {
                        const userId = doc.id;
                        return userId !== user.uid && !likedUserIds.includes(userId);
                    })
                    .map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));

                setCandidates(candidatesList);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching candidates:', error);
                setLoading(false);
            }
        };

        fetchCandidates();
    }, [user]);

    // マッチ一覧を取得
    useEffect(() => {
        const fetchMatches = async () => {
            if (!user) return;

            try {
                const matchesRef = collection(db, 'matches');
                const q = query(
                    matchesRef,
                    where('userIds', 'array-contains', user.uid)
                );
                const matchesSnapshot = await getDocs(q);
                
                const matchesList = await Promise.all(
                    matchesSnapshot.docs.map(async (matchDoc) => {
                        const matchData = matchDoc.data();
                        const otherUserId = matchData.userIds.find(id => id !== user.uid);
                        
                        // 相手のユーザー情報を取得
                        const userDocRef = doc(db, 'users', otherUserId);
                        const userDoc = await getDoc(userDocRef);
                        
                        return {
                            id: matchDoc.id,
                            ...matchData,
                            otherUser: userDoc.exists() ? { id: otherUserId, ...userDoc.data() } : null
                        };
                    })
                );

                setMatches(matchesList.filter(m => m.otherUser));
            } catch (error) {
                console.error('Error fetching matches:', error);
            }
        };

        if (activeTab === 'matches') {
            fetchMatches();
        }
    }, [user, activeTab]);

    // いいねを記録してマッチングチェック
    const handleLike = async (candidate) => {
        if (!user || !candidate) return;

        try {
            // 自分のいいねを記録
            const likeRef = doc(db, `userLikes/${user.uid}/likes`, candidate.id);
            await setDoc(likeRef, {
                userId: candidate.id,
                userName: candidate.displayName || candidate.name || 'Unknown',
                userAvatar: candidate.photoURL || candidate.avatar || '',
                timestamp: serverTimestamp()
            });

            // 相手が自分にいいねしているかチェック
            const theirLikeRef = doc(db, `userLikes/${candidate.id}/likes`, user.uid);
            const theirLikeDoc = await getDoc(theirLikeRef);

            if (theirLikeDoc.exists()) {
                // マッチング成立！
                await createMatch(candidate);
            }

            // 次のカードへ
            setCurrentIndex(prev => prev + 1);
        } catch (error) {
            console.error('Error handling like:', error);
            toast({
                title: 'エラー',
                description: 'いいねの送信に失敗しました',
                variant: 'destructive'
            });
        }
    };

    // マッチングを作成
    const createMatch = async (candidate) => {
        if (!user || !candidate) return;

        try {
            // マッチングドキュメントを作成
            const matchRef = await addDoc(collection(db, 'matches'), {
                userIds: [user.uid, candidate.id],
                users: {
                    [user.uid]: {
                        name: user.displayName || 'Unknown',
                        avatar: user.photoURL || ''
                    },
                    [candidate.id]: {
                        name: candidate.displayName || candidate.name || 'Unknown',
                        avatar: candidate.photoURL || candidate.avatar || ''
                    }
                },
                createdAt: serverTimestamp(),
                chatRoomId: null // チャット開始時に設定
            });

            console.log('Match created:', matchRef.id);

            // マッチ成立モーダルを表示
            setMatchedUser(candidate);
            setShowMatchModal(true);
        } catch (error) {
            console.error('Error creating match:', error);
        }
    };

    // パスする
    const handlePass = () => {
        setCurrentIndex(prev => prev + 1);
    };

    // スワイプ終了時の処理
    const handleDragEnd = (event, info) => {
        const threshold = 150;

        if (info.offset.x > threshold) {
            // 右スワイプ = Like
            handleLike(candidates[currentIndex]);
        } else if (info.offset.x < -threshold) {
            // 左スワイプ = Pass
            handlePass();
        }
    };

    // チャットを開始
    const handleStartChat = (matchedUserId) => {
        navigate(`/chat?userId=${matchedUserId}`);
        setShowMatchModal(false);
    };

    const currentCandidate = candidates[currentIndex];

    if (!user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center">
                <p className="text-gray-600">ログインしてください</p>
            </div>
        );
    }

    return (
        <>
            <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 pb-20">
                {/* Header */}
                <div className="bg-white border-b border-pink-100 sticky top-0 z-10">
                    <div className="max-w-md mx-auto px-4 py-4">
                        <div className="flex items-center justify-between">
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent">
                                マッチング
                            </h1>
                            <Users className="w-6 h-6 text-pink-500" />
                        </div>
                        
                        {/* Tab Switcher */}
                        <div className="flex space-x-2 mt-4">
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setActiveTab('swipe')}
                                className={`flex-1 py-2 rounded-full font-semibold transition-all ${
                                    activeTab === 'swipe'
                                        ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white'
                                        : 'bg-gray-100 text-gray-600'
                                }`}
                                data-testid="tab-swipe"
                            >
                                スワイプ
                            </motion.button>
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setActiveTab('matches')}
                                className={`flex-1 py-2 rounded-full font-semibold transition-all ${
                                    activeTab === 'matches'
                                        ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white'
                                        : 'bg-gray-100 text-gray-600'
                                }`}
                                data-testid="tab-matches"
                            >
                                マッチ ({matches.length})
                            </motion.button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="max-w-md mx-auto px-4 py-8">
                    {activeTab === 'swipe' ? (
                        // Swipe Deck
                        <div className="relative h-[600px]">
                            {loading ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
                                        <p className="text-gray-600">候補者を探しています...</p>
                                    </div>
                                </div>
                            ) : currentCandidate ? (
                                <>
                                    {/* Card Stack */}
                                    <AnimatePresence>
                                        <motion.div
                                            key={currentCandidate.id}
                                            drag="x"
                                            dragConstraints={{ left: 0, right: 0 }}
                                            onDragEnd={handleDragEnd}
                                            style={{ x, rotate, opacity }}
                                            className="absolute inset-0 cursor-grab active:cursor-grabbing"
                                            data-testid={`card-${currentCandidate.id}`}
                                        >
                                            <div className="relative bg-gradient-to-br from-white via-pink-50 to-purple-50 rounded-3xl shadow-2xl overflow-hidden h-full">
                                                {/* Swipe Indicators */}
                                                <motion.div
                                                    style={{ opacity: likeOpacity }}
                                                    className="absolute top-8 right-8 z-10 bg-green-500 text-white px-8 py-3 rounded-2xl font-bold text-2xl rotate-12 border-4 border-white shadow-xl"
                                                >
                                                    LIKE
                                                </motion.div>
                                                <motion.div
                                                    style={{ opacity: nopeOpacity }}
                                                    className="absolute top-8 left-8 z-10 bg-red-500 text-white px-8 py-3 rounded-2xl font-bold text-2xl -rotate-12 border-4 border-white shadow-xl"
                                                >
                                                    NOPE
                                                </motion.div>

                                                {/* Content Container */}
                                                <div className="h-full flex flex-col p-6">
                                                    {/* Profile Image - Centered Circle */}
                                                    <div className="flex-shrink-0 flex justify-center items-center py-6">
                                                        <div className="relative">
                                                            <div className="w-64 h-64 rounded-full overflow-hidden border-8 border-white shadow-2xl bg-gradient-to-br from-pink-200 to-purple-200">
                                                                <img
                                                                    src={getProxyImageUrl(currentCandidate.photoURL || currentCandidate.avatar)}
                                                                    alt={currentCandidate.displayName || currentCandidate.name}
                                                                    className="w-full h-full object-cover"
                                                                    onError={(e) => {
                                                                        e.target.src = '/logo.webp';
                                                                    }}
                                                                />
                                                            </div>
                                                            {/* Verified Badge */}
                                                            {currentCandidate.isCreator && (
                                                                <div className="absolute bottom-2 right-2 bg-gradient-to-r from-pink-500 to-pink-600 rounded-full p-2 border-4 border-white shadow-xl">
                                                                    <Star className="w-6 h-6 text-white fill-white" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* User Info */}
                                                    <div className="flex-1 flex flex-col justify-center px-4 space-y-4">
                                                        {/* Name and Age */}
                                                        <div className="text-center">
                                                            <h2 className="text-4xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent mb-2">
                                                                {currentCandidate.displayName || currentCandidate.name || 'Unknown'}
                                                            </h2>
                                                            {currentCandidate.age && (
                                                                <p className="text-xl text-gray-600 font-medium">{currentCandidate.age}歳</p>
                                                            )}
                                                        </div>

                                                        {/* Additional Info */}
                                                        <div className="space-y-2">
                                                            {currentCandidate.location && (
                                                                <div className="flex items-center justify-center space-x-2 text-gray-600">
                                                                    <MapPin className="w-4 h-4 text-pink-500" />
                                                                    <span className="text-sm">{currentCandidate.location}</span>
                                                                </div>
                                                            )}
                                                            {currentCandidate.occupation && (
                                                                <div className="flex items-center justify-center space-x-2 text-gray-600">
                                                                    <Briefcase className="w-4 h-4 text-pink-500" />
                                                                    <span className="text-sm">{currentCandidate.occupation}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Bio */}
                                                        {currentCandidate.bio && (
                                                            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-pink-100">
                                                                <p className="text-gray-700 text-center leading-relaxed">
                                                                    {currentCandidate.bio}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {/* Tags/Interests */}
                                                        {currentCandidate.interests && currentCandidate.interests.length > 0 && (
                                                            <div className="flex flex-wrap justify-center gap-2">
                                                                {currentCandidate.interests.slice(0, 5).map((interest, idx) => (
                                                                    <span
                                                                        key={idx}
                                                                        className="px-3 py-1 bg-gradient-to-r from-pink-100 to-purple-100 text-pink-600 rounded-full text-xs font-medium border border-pink-200"
                                                                    >
                                                                        {interest}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Instruction Text */}
                                                    <div className="flex-shrink-0 text-center pb-4">
                                                        <p className="text-xs text-gray-400">
                                                            左右にスワイプするか、下のボタンをタップ
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    </AnimatePresence>

                                    {/* Action Buttons */}
                                    <div className="absolute -bottom-4 left-0 right-0 flex justify-center space-x-8">
                                        <motion.button
                                            whileHover={{ scale: 1.15 }}
                                            whileTap={{ scale: 0.85 }}
                                            onClick={handlePass}
                                            className="w-20 h-20 bg-white rounded-full shadow-2xl flex items-center justify-center border-4 border-red-100 hover:border-red-300 transition-colors"
                                            data-testid="button-pass"
                                        >
                                            <X className="w-10 h-10 text-red-500" />
                                        </motion.button>
                                        <motion.button
                                            whileHover={{ scale: 1.15 }}
                                            whileTap={{ scale: 0.85 }}
                                            onClick={() => handleLike(currentCandidate)}
                                            className="w-24 h-24 bg-gradient-to-br from-pink-500 via-pink-600 to-purple-600 rounded-full shadow-2xl flex items-center justify-center border-4 border-white hover:shadow-pink-300 transition-all"
                                            data-testid="button-like"
                                        >
                                            <Heart className="w-12 h-12 text-white fill-white" />
                                        </motion.button>
                                    </div>
                                </>
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center">
                                        <Sparkles className="w-16 h-16 text-pink-300 mx-auto mb-4" />
                                        <h3 className="text-xl font-bold text-gray-700 mb-2">
                                            候補者がいません
                                        </h3>
                                        <p className="text-gray-500">
                                            後でまた確認してください
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        // Matches List
                        <div className="space-y-4">
                            {matches.length > 0 ? (
                                matches.map((match) => (
                                    <motion.div
                                        key={match.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        whileHover={{ scale: 1.02 }}
                                        className="bg-white rounded-2xl p-4 shadow-lg border border-pink-100 cursor-pointer"
                                        onClick={() => handleStartChat(match.otherUser.id)}
                                        data-testid={`match-${match.id}`}
                                    >
                                        <div className="flex items-center space-x-4">
                                            <img
                                                src={getProxyImageUrl(match.otherUser.photoURL || match.otherUser.avatar)}
                                                alt={match.otherUser.displayName || match.otherUser.name}
                                                className="w-16 h-16 rounded-full object-cover border-2 border-pink-200"
                                                onError={(e) => {
                                                    e.target.src = '/logo.webp';
                                                }}
                                            />
                                            <div className="flex-1">
                                                <h3 className="font-bold text-lg text-gray-800">
                                                    {match.otherUser.displayName || match.otherUser.name || 'Unknown'}
                                                </h3>
                                                <p className="text-sm text-gray-500">マッチしました！</p>
                                            </div>
                                            <MessageCircle className="w-6 h-6 text-pink-500" />
                                        </div>
                                    </motion.div>
                                ))
                            ) : (
                                <div className="text-center py-12">
                                    <Users className="w-16 h-16 text-pink-200 mx-auto mb-4" />
                                    <h3 className="text-xl font-bold text-gray-700 mb-2">
                                        マッチがありません
                                    </h3>
                                    <p className="text-gray-500">
                                        スワイプして新しい人と出会いましょう！
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Match Modal */}
            <AnimatePresence>
                {showMatchModal && matchedUser && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4"
                        onClick={() => setShowMatchModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.8, y: 50 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.8, y: 50 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl"
                        >
                            <div className="text-center">
                                <motion.div
                                    animate={{ rotate: [0, 10, -10, 10, 0] }}
                                    transition={{ duration: 0.5, repeat: 3 }}
                                    className="mb-6"
                                >
                                    <div className="w-24 h-24 bg-gradient-to-br from-pink-400 to-pink-600 rounded-full mx-auto flex items-center justify-center">
                                        <Heart className="w-12 h-12 text-white fill-white" />
                                    </div>
                                </motion.div>
                                
                                <h2 className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent mb-2">
                                    マッチしました！
                                </h2>
                                <p className="text-gray-600 mb-6">
                                    {matchedUser.displayName || matchedUser.name}さんとマッチしました
                                </p>

                                <div className="flex space-x-3">
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setShowMatchModal(false)}
                                        className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold"
                                    >
                                        後で
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleStartChat(matchedUser.id)}
                                        className="flex-1 bg-gradient-to-r from-pink-500 to-pink-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center space-x-2"
                                    >
                                        <MessageCircle className="w-5 h-5" />
                                        <span>チャット</span>
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <BottomNavigationWithCreator />
        </>
    );
};

export default SwipeMatchPage;
