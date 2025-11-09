import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Grid3x3, Video, Image as ImageIcon, ChevronDown, Heart, Bookmark, Sparkles
} from 'lucide-react';
import BottomNavigationWithCreator from '../BottomNavigationWithCreator';
import { t } from 'i18next';
import { useUserInteractions } from '../../hooks/useUserInteractions';
import { useUserStats } from '../../context/UserStatsContext';
import { useAuth } from '../../context/AuthContext';
import { 
    getUserLikedPosts, 
    getUserSavedPosts, 
    getUserPurchasedPosts, 
    getUserViewingHistory 
} from '../../utils/userInteractions';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

const UserContentPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { currentUser } = useAuth();
    const { likedPosts, savedPosts, toggleLike, toggleSave, isLiked, isSaved } = useUserInteractions();
    const { stats, updateLikedCount, updateSavedCount } = useUserStats();
    
    // デバッグ: stats値を確認
    useEffect(() => {
        console.log('📊 LikePurchedViewPage stats:', stats);
    }, [stats]);
    
    // const { contentType = 'purchased' } = useParams();

    const [filter, setFilter] = useState('video');
    const [sort, setSort] = useState('New');
    const [activeTab, setActiveTab] = useState('purchased');
    const [localLikedPosts, setLocalLikedPosts] = useState(new Set());
    const [localSavedPosts, setLocalSavedPosts] = useState(new Set());
    const [contentData, setContentData] = useState({
        purchased: [],
        liked: [],
        saved: [],
        viewingHistory: []
    });
    const [loading, setLoading] = useState(true);

    // const [dropdownFilter, setDropdownFilter] = useState('All');

    // THEN use useEffect to update based on location
    useEffect(() => {
        if (location.state?.activeTab) {
            setActiveTab(location.state.activeTab);
        }
    }, [location.state]);
    
    // Firestoreから投稿データを取得
    useEffect(() => {
        const fetchUserPosts = async () => {
            if (!currentUser) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                console.log('🔍 Fetching user posts for tab:', activeTab);

                let postIds = [];
                
                // activeTabに応じて投稿IDを取得
                switch (activeTab) {
                    case 'liked':
                        postIds = await getUserLikedPosts(currentUser.uid);
                        console.log('📝 Liked post IDs:', postIds);
                        break;
                    case 'saved':
                        postIds = await getUserSavedPosts(currentUser.uid);
                        console.log('📝 Saved post IDs:', postIds);
                        break;
                    case 'purchased':
                        postIds = await getUserPurchasedPosts(currentUser.uid);
                        console.log('📝 Purchased post IDs:', postIds);
                        break;
                    case 'viewingHistory':
                        postIds = await getUserViewingHistory(currentUser.uid);
                        console.log('📝 Viewing history post IDs:', postIds);
                        break;
                    default:
                        postIds = [];
                }

                // 投稿IDが空の場合
                if (postIds.length === 0) {
                    setContentData(prev => ({
                        ...prev,
                        [activeTab]: []
                    }));
                    setLoading(false);
                    return;
                }

                // 投稿IDを文字列に変換し、重複を削除、無効な値を除外
                const validPostIds = [...new Set(
                    postIds
                        .map(id => String(id).trim())
                        .filter(id => id && id !== 'undefined' && id !== 'null')
                )].slice(0, 10); // 最大10件（Firestoreの制限）

                console.log('🔍 Valid post IDs:', validPostIds);

                if (validPostIds.length === 0) {
                    setContentData(prev => ({
                        ...prev,
                        [activeTab]: []
                    }));
                    setLoading(false);
                    return;
                }

                // Firestoreから投稿データを取得
                // Note: userInteractionsには投稿のpostIdフィールドの値が保存されているため、
                // ドキュメントID(__name__)ではなくpostIdフィールドでクエリする
                const postsRef = collection(db, 'posts');
                const q = query(postsRef, where('postId', 'in', validPostIds));
                const querySnapshot = await getDocs(q);
                
                const posts = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    posts.push({
                        id: doc.id,
                        ...data
                    });
                });

                console.log(`✅ Fetched ${posts.length} posts for ${activeTab}`);
                
                setContentData(prev => ({
                    ...prev,
                    [activeTab]: posts
                }));
                
            } catch (error) {
                console.error('Error fetching user posts:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserPosts();
    }, [activeTab, currentUser]);

    const currentData = contentData[activeTab] || [];

    const handleNavigation = (path) => {
        if (path === 'home') navigate('/');
        else if (path === 'feed') navigate('/feed');
        else if (path === 'messages') navigate('/messages');
        else if (path === 'ranking') navigate('/live');
        else if (path === 'account') navigate('/account');
        else navigate('/');
    };

    // クリック機能
    const handleVideoClick = (post) => {
        navigate(`/video/${post.id}`);
    };

    const handleAccountClick = (post) => {
        navigate(`/profile/${post.userId || post.id}`);
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

    // Update when location state changes
    useEffect(() => {
        if (location.state?.activeTab) {
            setActiveTab(location.state.activeTab);
        }
    }, [location.state]);

    // Dynamic page title based on activeTab
    const getPageTitle = () => {
        const titles = {
            purchased: t('postLibrary.purchased'),
            liked: t('postLibrary.liked'),
            saved: t('postLibrary.saved'),
            viewingHistory: t('postLibrary.viewingHistory')
        };
        return titles[activeTab] || 'Posts';
    };

    // Debug: Log to see what you're receiving
    console.log('Location state:', location.state);
    console.log('Active tab:', activeTab);
    console.log('Button name:', location.state?.buttonName);

    // const getPageTitle = () => {
    //     const titles = {
    //         purchased: t('postLibrary.purchased'),
    //         liked: t('postLibrary.liked'),
    //         saved: t('postLibrary.saved'),
    //         viewingHistory: t('postLibrary.viewingHistory')
    //     };
    //     console.log('Active Tab:', activeTab);
    //     return titles[activeTab] || 'Posts';
    // };

    // const getSortLabel = () => {
    //     return activeTab === 'viewingHistory' ? 'Viewing date' : 'New';
    // };

    const EmptyState = () => (
        <motion.div 
            className="flex flex-col items-center justify-center py-20"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
        >
            <motion.div 
                className="w-20 h-20 bg-gradient-to-br from-pink-400 to-pink-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
                animate={{ 
                    rotate: [0, 5, -5, 0],
                    scale: [1, 1.05, 1]
                }}
                transition={{ duration: 3, repeat: Infinity }}
            >
                <Grid3x3 size={32} className="text-white" strokeWidth={2.5} />
            </motion.div>
            <motion.p 
                className="font-bold text-lg bg-gradient-to-r from-pink-600 to-pink-700 bg-clip-text text-transparent"
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity }}
            >
                コンテンツがありません
            </motion.p>
        </motion.div>
    );

    const PostCard = ({ post }) => (
        <motion.div 
            className="bg-white rounded-xl shadow-md overflow-hidden border-2 border-pink-100"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.03, y: -5 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
        >
            {/* Thumbnail - クリックで動画ページへ */}
            <div 
                className="relative cursor-pointer overflow-hidden"
                onClick={() => handleVideoClick(post)}
            >
                <motion.div 
                    className="w-full h-40 bg-gradient-to-br from-yellow-300 to-yellow-500 flex items-center justify-center"
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.3 }}
                >
                    {/* Yellow placeholder as shown in your images */}
                    <motion.div 
                        className="absolute bottom-2 right-2 text-white text-xs font-bold bg-gradient-to-r from-pink-500 to-pink-600 px-2 py-1 rounded-full shadow-md"
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    >
                        {post.type === 'video' ? '4:32' : 'IMG'}
                    </motion.div>
                    {post.type === 'video' && (
                        <motion.div 
                            className="absolute top-2 left-2 bg-gradient-to-br from-pink-400 to-pink-600 p-1.5 rounded-full shadow-md"
                            animate={{ 
                                rotate: [0, 5, -5, 0],
                                scale: [1, 1.05, 1]
                            }}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            <Video size={16} className="text-white" strokeWidth={2.5} />
                        </motion.div>
                    )}
                </motion.div>
            </div>

            {/* Content */}
            <div className="p-3 bg-gradient-to-b from-white to-pink-50/30">
                <h3 className="text-sm font-bold mb-2 line-clamp-2 text-gray-800">
                    {post.title}
                </h3>

                {/* Author - クリックでプロフィールページへ */}
                <motion.div 
                    className="flex items-center mb-2 cursor-pointer"
                    onClick={() => handleAccountClick(post)}
                    whileHover={{ x: 3 }}
                >
                    <div className="relative w-6 h-6 mr-2 rounded-full overflow-hidden shadow-sm">
                        <motion.img
                            src={post.user?.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=20&h=20&fit=crop"}
                            alt="Author"
                            className="w-full h-full object-cover"
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                        />
                    </div>
                    <span className="text-xs font-medium text-gray-700 truncate">{post.author}</span>
                </motion.div>

                {/* Stats */}
                <div className="flex items-center justify-between text-xs font-medium text-gray-600">
                    <div className="flex items-center space-x-3">
                        <motion.div 
                            className="flex items-center space-x-1 cursor-pointer hover:bg-pink-50 p-1.5 rounded-full transition-colors"
                            onClick={(e) => handleLikeClick(post.id, e)}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                        >
                            <Heart 
                                size={14} 
                                className={`${localLikedPosts.has(post.id) ? 'text-red-500 fill-current' : 'text-pink-500'}`}
                                strokeWidth={2.5}
                            />
                            <span>{post.likes}</span>
                        </motion.div>
                        <motion.div 
                            className="flex items-center space-x-1 cursor-pointer hover:bg-blue-50 p-1.5 rounded-full transition-colors"
                            onClick={(e) => handleSaveClick(post.id, e)}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                        >
                            <Bookmark 
                                size={14} 
                                className={`${localSavedPosts.has(post.id) ? 'text-blue-500 fill-current' : 'text-pink-500'}`}
                                strokeWidth={2.5}
                            />
                            <span>{post.bookmarks}</span>
                        </motion.div>
                    </div>
                    <span className="text-gray-500">{post.timeAgo}</span>
                </div>
            </div>
        </motion.div>
    );

    return (
        <>
            <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pb-20">
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
                    <motion.h1 
                        className="text-base font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent"
                        animate={{ opacity: [0.8, 1, 0.8] }}
                        transition={{ duration: 3, repeat: Infinity }}
                    >
                        {getPageTitle()}
                    </motion.h1>
                    <div className="w-8"></div>
                </div>

                {/* Stats Cards */}
                <div className="bg-white px-4 py-4 border-b border-gray-200">
                    <div className="grid grid-cols-4 gap-3">
                        {/* 購入済み */}
                        <motion.div 
                            className="text-center cursor-pointer"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            onClick={() => setActiveTab('purchased')}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            data-testid="card-purchased"
                        >
                            <motion.div 
                                className="w-14 h-14 bg-gradient-to-br from-pink-300 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-2 shadow-md"
                                animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
                                transition={{ duration: 3, repeat: Infinity }}
                            >
                                <Video size={22} className="text-white" strokeWidth={2.5} />
                            </motion.div>
                            <div className="text-xs font-bold text-gray-700">全て</div>
                            <motion.div 
                                className="text-lg font-bold text-pink-600"
                                animate={{ scale: [1, 1.05, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            >
                                {stats.purchased}
                            </motion.div>
                        </motion.div>
                        
                        {/* いいね */}
                        <motion.div 
                            className="text-center cursor-pointer"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            onClick={() => setActiveTab('liked')}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            data-testid="card-liked"
                        >
                            <motion.div 
                                className="w-14 h-14 bg-gradient-to-br from-pink-400 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-2 shadow-md"
                                animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
                                transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
                            >
                                <Heart size={22} className="text-white" strokeWidth={2.5} />
                            </motion.div>
                            <div className="text-xs font-bold text-gray-700">いいね</div>
                            <motion.div 
                                className="text-lg font-bold text-pink-600"
                                animate={{ scale: [1, 1.05, 1] }}
                                transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                            >
                                {stats.liked}
                            </motion.div>
                        </motion.div>
                        
                        {/* 保存済み */}
                        <motion.div 
                            className="text-center cursor-pointer"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            onClick={() => setActiveTab('saved')}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            data-testid="card-saved"
                        >
                            <motion.div 
                                className="w-14 h-14 bg-gradient-to-br from-pink-500 to-pink-700 rounded-full flex items-center justify-center mx-auto mb-2 shadow-md"
                                animate={{ rotate: [0, -5, 5, 0], scale: [1, 1.05, 1] }}
                                transition={{ duration: 3, repeat: Infinity, delay: 1 }}
                            >
                                <Bookmark size={22} className="text-white" strokeWidth={2.5} />
                            </motion.div>
                            <div className="text-xs font-bold text-gray-700">保存済み</div>
                            <motion.div 
                                className="text-lg font-bold text-pink-600"
                                animate={{ scale: [1, 1.05, 1] }}
                                transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
                            >
                                {stats.saved}
                            </motion.div>
                        </motion.div>
                        
                        {/* 視聴履歴 */}
                        <motion.div 
                            className="text-center cursor-pointer"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            onClick={() => setActiveTab('viewingHistory')}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            data-testid="card-viewing-history"
                        >
                            <motion.div 
                                className="w-14 h-14 bg-gradient-to-br from-pink-600 to-pink-800 rounded-full flex items-center justify-center mx-auto mb-2 shadow-md"
                                animate={{ rotate: [0, -5, 5, 0], scale: [1, 1.05, 1] }}
                                transition={{ duration: 3, repeat: Infinity, delay: 1.5 }}
                            >
                                <Sparkles size={22} className="text-white" strokeWidth={2.5} />
                            </motion.div>
                            <div className="text-xs font-bold text-gray-700">視聴履歴</div>
                            <motion.div 
                                className="text-lg font-bold text-pink-600"
                                animate={{ scale: [1, 1.05, 1] }}
                                transition={{ duration: 2, repeat: Infinity, delay: 0.9 }}
                            >
                                {stats.viewingHistory}
                            </motion.div>
                        </motion.div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => setFilter('video')}
                                className={`p-2 rounded border ${filter === 'video'
                                    ? 'border-pink-600 text-pink-600 bg-pink-50'
                                    : 'border-gray-300 text-gray-600'
                                    }`}
                            >
                                <Video size={16} />
                            </button>
                            <button
                                onClick={() => setFilter('image')}
                                className={`p-2 rounded border ${filter === 'image'
                                    ? 'border-pink-600 text-pink-600 bg-pink-50'
                                    : 'border-gray-300 text-gray-600'
                                    }`}
                            >
                                <ImageIcon size={16} />
                            </button>
                        </div>

                        <div className="flex items-center space-x-2">
                            <select
                                value={sort}
                                onChange={(e) => setSort(e.target.value)}
                                className="px-3 py-1 border border-gray-300 rounded text-sm bg-white"
                            >
                                <option value="New">{t('postLibrary.new')}</option>
                                <option value="Viewing date">{t('postLibrary.viewingdate')}</option>
                                <option value="Most liked">{t('postLibrary.mostLiked')}</option>
                            </select>

                            <button className="p-2 border border-gray-300 rounded">
                                <ChevronDown size={16} className="text-gray-600" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Date Section (for viewing history) */}
                {activeTab === 'viewingHistory' && currentData.length > 0 && (
                    <div className="bg-white px-4 py-3 border-b border-gray-200">
                        <h2 className="font-semibold text-gray-900">{t('postLibrary.today')}</h2>
                    </div>
                )}

                {/* Content */}
                <div className="p-4">
                    {currentData.length === 0 ? (
                        <EmptyState />
                    ) : (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                            {currentData.map((post) => (
                                <PostCard key={post.id} post={post} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <BottomNavigationWithCreator active="account" />
        </>
    );
};

export default UserContentPage;
