import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, Video, Image as ImageIcon, Heart, Bookmark, Sparkles } from 'lucide-react';
import BottomNavigationWithCreator from '../BottomNavigationWithCreator';
import { useUserInteractions } from '../../hooks/useUserInteractions';
import { useUserStats } from '../../context/UserStatsContext';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';

export const genreData = [
    { name: '運営Pik UP', count: '410,177 posts', color: 'from-pink-500 to-purple-600' },
    { name: 'ハメ撮り', count: '147,577 posts', color: 'from-purple-500 to-indigo-600' },
    { name: 'オナニー', count: '104,474 posts', color: 'from-red-500 to-pink-600' },
    { name: 'フェラチオ', count: '96,852 posts', color: 'from-orange-500 to-red-600' },
    { name: '複数プレイ', count: '83,925 posts', color: 'from-green-500 to-teal-600' },
    { name: '人妻', count: '72,199 posts', color: 'from-blue-500 to-purple-600' },
    { name: '潮吹き', count: '65,989 posts', color: 'from-pink-500 to-red-600' },
    { name: 'アブノーマル', count: '60,114 posts', color: 'from-purple-500 to-pink-600' }
];

const GenrePage = () => {
    const { genreName } = useParams();
    const navigate = useNavigate();
    const { likedPosts, savedPosts, toggleLike, toggleSave, isLiked, isSaved, loading, error } = useUserInteractions();
    const { updateLikedCount, updateSavedCount } = useUserStats();

    const [activeGenre, setActiveGenre] = useState(genreName ? decodeURIComponent(genreName) : '運営Pik UP');
    const [localLikedPosts, setLocalLikedPosts] = useState(new Set());
    const [localSavedPosts, setLocalSavedPosts] = useState(new Set());
    const [posts, setPosts] = useState([]);
    const [loadingPosts, setLoadingPosts] = useState(true);
    
    // ジャンル名を取得する関数
    const getGenreDisplayName = () => {
        if (activeGenre && activeGenre !== 'undefined') {
            return activeGenre;
        }
        // genreDataから最初のジャンル名を取得
        return genreData[0]?.name || 'ジャンル';
    };

    // クリック機能
    const handleVideoClick = (post) => {
        navigate(`/video/${post.id}`);
    };

    const handleAccountClick = (post) => {
        navigate(`/profile/${post.user.id}`);
    };

    const handleLikeClick = (postId, e) => {
        e.stopPropagation();
        console.log('Like clicked for post:', postId);
        const wasLiked = localLikedPosts.has(postId);
        
        setLocalLikedPosts(prev => {
            const newSet = new Set(prev);
            if (newSet.has(postId)) {
                newSet.delete(postId);
                console.log('Removed like from local state');
                updateLikedCount(-1); // 統計を減らす
            } else {
                newSet.add(postId);
                console.log('Added like to local state');
                updateLikedCount(1); // 統計を増やす
            }
            return newSet;
        });
        
        // 非同期でFirebaseにも保存
        toggleLike(postId).catch(error => {
            console.error('Error toggling like:', error);
            // エラーの場合は統計を元に戻す
            updateLikedCount(wasLiked ? 1 : -1);
        });
    };

    const handleSaveClick = (postId, e) => {
        e.stopPropagation();
        console.log('Save clicked for post:', postId);
        const wasSaved = localSavedPosts.has(postId);
        
        setLocalSavedPosts(prev => {
            const newSet = new Set(prev);
            if (newSet.has(postId)) {
                newSet.delete(postId);
                console.log('Removed save from local state');
                updateSavedCount(-1); // 統計を減らす
            } else {
                newSet.add(postId);
                console.log('Added save to local state');
                updateSavedCount(1); // 統計を増やす
            }
            return newSet;
        });
        
        // 非同期でFirebaseにも保存
        toggleSave(postId).catch(error => {
            console.error('Error toggling save:', error);
            // エラーの場合は統計を元に戻す
            updateSavedCount(wasSaved ? 1 : -1);
        });
    };

    useEffect(() => {
        if (genreName) {
            setActiveGenre(decodeURIComponent(genreName));
        }
    }, [genreName]);

    // Firestoreから投稿を取得
    useEffect(() => {
        const fetchPosts = async () => {
            if (!activeGenre) return;
            
            setLoadingPosts(true);
            try {
                const postsRef = collection(db, 'posts');
                
                // tagsフィールドがactiveGenreを含む投稿を検索
                // Firestoreの配列クエリ: array-contains
                const q = query(
                    postsRef,
                    where('tags', 'array-contains', activeGenre),
                    orderBy('createdAt', 'desc'),
                    limit(50)
                );
                
                const querySnapshot = await getDocs(q);
                
                const fetchedPosts = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    
                    // 投稿データを整形
                    fetchedPosts.push({
                        id: doc.id,
                        title: data.title || 'タイトルなし',
                        likes: data.likes || 0,
                        bookmarks: data.bookmarks || 0,
                        type: data.files && data.files.length > 0 ? data.files[0].resourceType : 'image',
                        thumbnail: data.files && data.files.length > 0 ? data.files[0].thumbnailUrl : null,
                        user: {
                            id: data.userId,
                            name: data.userName || '匿名',
                            avatar: data.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face'
                        },
                        author: data.userName || '匿名',
                        timeAgo: calculateTimeAgo(data.createdAt)
                    });
                });
                
                console.log(`✅ Fetched ${fetchedPosts.length} posts for genre: ${activeGenre}`);
                setPosts(fetchedPosts);
            } catch (error) {
                console.error('Error fetching posts by tag:', error);
                setPosts([]);
            } finally {
                setLoadingPosts(false);
            }
        };

        fetchPosts();
    }, [activeGenre]);

    // 時間経過を計算する関数
    const calculateTimeAgo = (timestamp) => {
        if (!timestamp) return '不明';
        
        const now = new Date();
        const postDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const diffInMs = now - postDate;
        const diffInMinutes = Math.floor(diffInMs / 60000);
        const diffInHours = Math.floor(diffInMs / 3600000);
        const diffInDays = Math.floor(diffInMs / 86400000);

        if (diffInMinutes < 1) return 'たった今';
        if (diffInMinutes < 60) return `${diffInMinutes}分前`;
        if (diffInHours < 24) return `${diffInHours}時間前`;
        if (diffInDays < 7) return `${diffInDays}日前`;
        return postDate.toLocaleDateString('ja-JP');
    };

    const handleNavigation = (path) => {
        if (path === 'home') navigate('/');
        else if (path === 'feed') navigate('/feed');
        else if (path === 'messages') navigate('/messages');
        else if (path === 'ranking') navigate('/rankingpage');
        else if (path === 'account') navigate('/account');
        else navigate('/');
    };

    // 投稿を人気順でソート（likes + bookmarks）
    const sortedPosts = [...posts].sort((a, b) => (b.likes + b.bookmarks) - (a.likes + a.bookmarks));

    return (
        <>
            <motion.div 
                className="min-h-screen bg-gradient-to-b from-gray-50 to-white pb-20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-white/95 backdrop-blur-md border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                    <motion.button 
                        onClick={() => navigate(-1)} 
                        className="p-2 hover:bg-gradient-to-br hover:from-pink-50 hover:to-rose-50 rounded-full transition-all"
                        whileHover={{ scale: 1.1, rotate: -10 }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <ArrowLeft size={20} className="text-pink-600" strokeWidth={2.5} />
                    </motion.button>
                    <div className="flex-1 mx-3">
                        <div className="relative flex items-center bg-gradient-to-r from-gray-50 to-pink-50 border-2 border-pink-200 rounded-full px-4 py-2.5 shadow-sm">
                            <motion.div
                                animate={{ 
                                    rotate: [0, 10, -10, 0],
                                    scale: [1, 1.1, 1]
                                }}
                                transition={{ duration: 3, repeat: Infinity }}
                            >
                                <Search size={18} className="text-pink-500 mr-2" strokeWidth={2.5} />
                            </motion.div>
                            <input
                                type="text"
                                placeholder="検索キーワードを入力してください"
                                className="bg-transparent flex-1 text-sm text-gray-700 outline-none placeholder:text-gray-400 font-medium"
                                data-testid="input-genre-search"
                            />
                        </div>
                    </div>
                </div>


                {/* Content Section */}
                <div className="bg-white px-4 py-4">
                    <motion.h2 
                        className="text-lg font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent mb-4"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: [0.8, 1, 0.8], x: 0 }}
                        transition={{ opacity: { duration: 2, repeat: Infinity }, x: { duration: 0.5 } }}
                    >
                        {getGenreDisplayName()}
                    </motion.h2>


                    {/* Posts Grid */}
                    {loadingPosts ? (
                        <motion.div 
                            className="text-center py-12"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        >
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                className="inline-block"
                            >
                                <Sparkles className="text-pink-500" size={48} strokeWidth={2} />
                            </motion.div>
                            <p className="mt-4 text-gray-600 font-medium">読み込み中...</p>
                        </motion.div>
                    ) : sortedPosts.length === 0 ? (
                        <motion.div 
                            className="text-center py-12"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5 }}
                        >
                            <motion.div 
                                className="text-6xl mb-4"
                                animate={{ 
                                    rotate: [0, 5, -5, 0],
                                    scale: [1, 1.1, 1]
                                }}
                                transition={{ duration: 3, repeat: Infinity }}
                            >
                                <Sparkles className="mx-auto text-pink-400" size={64} strokeWidth={2} />
                            </motion.div>
                            <motion.p 
                                className="font-bold text-lg bg-gradient-to-r from-pink-600 to-pink-700 bg-clip-text text-transparent"
                                animate={{ opacity: [0.7, 1, 0.7] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            >
                                このジャンルにはまだ投稿がありません
                            </motion.p>
                        </motion.div>
                           ) : (
                               <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                                   {sortedPosts.map((post, index) => (
                                   <motion.div 
                                       key={post.id} 
                                       className="bg-white rounded-2xl shadow-lg overflow-hidden"
                                       initial={{ opacity: 0, scale: 0.9 }}
                                       animate={{ opacity: 1, scale: 1 }}
                                       transition={{ delay: index * 0.05 }}
                                       whileHover={{ scale: 1.03, y: -5 }}
                                       whileTap={{ scale: 0.98 }}
                                   >
                                       {/* Thumbnail - クリックで動画ページへ */}
                                       <div 
                                           className="relative cursor-pointer overflow-hidden"
                                           onClick={() => handleVideoClick(post)}
                                       >
                                           {/* NEWバッジ（右上） */}
                                           {index < 2 && (
                                               <motion.div 
                                                   className="absolute top-2 right-2 bg-gradient-to-r from-pink-500 to-pink-600 px-3 py-1 rounded-full text-white text-xs font-bold shadow-lg z-10"
                                                   initial={{ scale: 0 }}
                                                   animate={{ scale: 1 }}
                                                   transition={{ delay: index * 0.1 + 0.3 }}
                                               >
                                                   NEW
                                               </motion.div>
                                           )}

                                           <motion.div 
                                               className="w-full h-48 bg-gradient-to-br from-gray-200 to-gray-300 relative"
                                               whileHover={{ scale: 1.05 }}
                                               transition={{ duration: 0.3 }}
                                           >
                                               {/* サムネイル画像 */}
                                               <motion.img
                                                   src={post.thumbnail || `https://images.unsplash.com/photo-${1500000000000 + post.id * 100000000}?w=400&h=300&fit=crop`}
                                                   alt={post.title}
                                                   className="w-full h-full object-cover"
                                                   animate={{ scale: [1, 1.05, 1] }}
                                                   transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                                               />
                                               
                                               {/* グラデーションオーバーレイ */}
                                               <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />

                                               {/* 動画時間（右下） */}
                                               {post.type === 'video' && (
                                                   <motion.div 
                                                       className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-bold px-2 py-1 rounded"
                                                       animate={{ opacity: [0.8, 1, 0.8] }}
                                                       transition={{ duration: 2, repeat: Infinity }}
                                                   >
                                                       48:18
                                                   </motion.div>
                                               )}
                                           </motion.div>
                                       </div>

                                       {/* Content */}
                                       <div className="p-3">
                                           <h3 className="text-sm font-bold mb-2 line-clamp-2 leading-tight text-gray-900">
                                               {post.title}
                                           </h3>

                                           {/* Author - クリックでプロフィールページへ */}
                                           <motion.div 
                                               className="flex items-center mb-3 cursor-pointer"
                                               onClick={() => handleAccountClick(post)}
                                               whileHover={{ x: 3 }}
                                           >
                                               <div className="relative w-5 h-5 mr-2 rounded-full overflow-hidden shadow-sm border border-gray-200">
                                                   <motion.img
                                                       src={post.user.avatar}
                                                       alt="Author"
                                                       className="w-full h-full object-cover"
                                                       animate={{ scale: [1, 1.1, 1] }}
                                                       transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                                                   />
                                               </div>
                                               <span className="text-xs font-medium text-gray-600 truncate">{post.author}</span>
                                           </motion.div>

                                           {/* Stats */}
                                           <div className="flex items-center space-x-4 text-xs font-medium text-gray-500">
                                               <motion.div 
                                                   className="flex items-center space-x-1 cursor-pointer"
                                                   onClick={(e) => handleLikeClick(post.id, e)}
                                                   whileHover={{ scale: 1.1 }}
                                                   whileTap={{ scale: 0.9 }}
                                               >
                                                   <Heart 
                                                       size={16} 
                                                       className={`${localLikedPosts.has(post.id) ? 'text-pink-500 fill-current' : 'text-gray-400'}`}
                                                       strokeWidth={2}
                                                   />
                                                   <span className="text-gray-600">{post.likes}</span>
                                               </motion.div>
                                               <motion.div 
                                                   className="flex items-center space-x-1 cursor-pointer"
                                                   onClick={(e) => handleSaveClick(post.id, e)}
                                                   whileHover={{ scale: 1.1 }}
                                                   whileTap={{ scale: 0.9 }}
                                               >
                                                   <Bookmark 
                                                       size={16} 
                                                       className={`${localSavedPosts.has(post.id) ? 'text-pink-500 fill-current' : 'text-gray-400'}`}
                                                       strokeWidth={2}
                                                   />
                                                   <span className="text-gray-600">{post.bookmarks}</span>
                                               </motion.div>
                                           </div>
                                       </div>
                                   </motion.div>
                               ))}
                               </div>
                           )}
                </div>
            </motion.div>

            <BottomNavigationWithCreator active="ranking" />
        </>
    );
};

export default GenrePage;
