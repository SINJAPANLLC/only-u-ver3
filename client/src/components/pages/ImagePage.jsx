import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Share,
    Heart,
    MessageCircle,
    Bookmark,
    MoreHorizontal,
    ChevronDown,
    ZoomIn,
    ZoomOut,
    X,
    ChevronLeft,
    ChevronRight,
    Lock
} from 'lucide-react';
import BottomNavigationWithCreator from '../BottomNavigationWithCreator';
import { useUserInteractions } from '../../hooks/useUserInteractions';
import { useUserStats } from '../../context/UserStatsContext';
import { db } from '../../firebase';
import { doc, getDoc, collection, addDoc, onSnapshot, query, orderBy, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { addUserView } from '../../utils/userInteractions';
import { canAccessContent } from '../../utils/planAccess';

const ImagePage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { likedPosts, savedPosts, toggleLike, toggleSave } = useUserInteractions();
    
    // useUserStatsのエラーハンドリング
    let updateLikedCount, updateSavedCount, updateViewingHistoryCount;
    try {
        const userStats = useUserStats();
        updateLikedCount = userStats.updateLikedCount;
        updateSavedCount = userStats.updateSavedCount;
        updateViewingHistoryCount = userStats.updateViewingHistoryCount;
    } catch (error) {
        console.warn('UserStats not available:', error);
        updateLikedCount = () => {};
        updateSavedCount = () => {};
        updateViewingHistoryCount = () => {};
    }
    
    const [localLikedPosts, setLocalLikedPosts] = useState(new Set());
    const [localSavedPosts, setLocalSavedPosts] = useState(new Set());
    const [imageData, setImageData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showCommentModal, setShowCommentModal] = useState(false);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loadingComments, setLoadingComments] = useState(false);
    const [showOptionsModal, setShowOptionsModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [showFullscreen, setShowFullscreen] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [accessDenied, setAccessDenied] = useState(false);
    const { currentUser } = useAuth();

    // URL変換ヘルパー関数
    const convertToProxyUrl = (url) => {
        if (!url) return null;
        
        console.log('ImagePage - Original URL:', url);
        
        // 既にプロキシURLの場合はそのまま返す
        if (url.startsWith('/api/proxy/')) {
            console.log('ImagePage - Already proxy URL:', url);
            return url;
        }
        
        // Bunny CDN直接URL（CORSエラーを防ぐためプロキシ経由に変換）
        if (url.includes('only-u.fun/') || url.includes('b-cdn.net/')) {
            const bunnyPattern = /https?:\/\/[^/]+\/(public|private)\/(.+)/;
            const match = url.match(bunnyPattern);
            if (match) {
                const folder = match[1];
                const filename = match[2];
                const proxyUrl = `/api/proxy/${folder}/${filename}`;
                console.log('ImagePage - Converted Bunny CDN URL to proxy:', proxyUrl);
                return proxyUrl;
            }
        }
        
        // Google Storage URLの場合
        if (url.includes('storage.googleapis.com')) {
            const match = url.match(/\/(public|\.private)\/([^?]+)/);
            if (match) {
                const [, folder, filename] = match;
                const proxyUrl = `/api/proxy/${folder}/${filename}`;
                console.log('ImagePage - Converted to proxy URL:', proxyUrl);
                return proxyUrl;
            }
        }
        
        // /objects/ 形式の場合
        if (url.startsWith('/objects/')) {
            const filename = url.replace('/objects/', '');
            const proxyUrl = `/api/proxy/public/${filename}`;
            console.log('ImagePage - Converted legacy URL to proxy:', proxyUrl);
            return proxyUrl;
        }
        
        console.log('ImagePage - Using original URL:', url);
        return url;
    };

    // Firestoreから投稿データを取得
    useEffect(() => {
        const fetchPostData = async () => {
            try {
                setLoading(true);
                const postDoc = await getDoc(doc(db, 'posts', id));
                
                if (postDoc.exists()) {
                    const postData = postDoc.data();
                    console.log('🖼️ ImagePage - Post data:', postData);
                    
                    // 限定コンテンツのチェック
                    if (postData.isExclusiveContent) {
                        // サブスクリプション状態をチェック
                        if (!currentUser) {
                            setAccessDenied(true);
                            setLoading(false);
                            return;
                        }
                        
                        // クリエイターのサブスクリプション確認
                        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                        if (!userDoc.exists()) {
                            // Firestoreユーザードキュメントが存在しない場合はアクセス拒否
                            setAccessDenied(true);
                            setLoading(false);
                            return;
                        }
                        
                        const userData = userDoc.data();
                        
                        // サブスクリプション情報をサブコレクションから取得
                        const subscriptionDocRef = doc(db, 'users', currentUser.uid, 'subscriptions', postData.userId);
                        const subscriptionDoc = await getDoc(subscriptionDocRef);
                        let userSubscription = subscriptionDoc.exists() && subscriptionDoc.data().status === 'active' ? subscriptionDoc.data() : null;
                        
                        // サブコレクションに存在しない場合、古い配列形式からフォールバック
                        if (!userSubscription && userData.subscriptions) {
                            const legacySubscription = userData.subscriptions.find(sub => sub.creatorId === postData.userId);
                            if (legacySubscription) {
                                userSubscription = legacySubscription;
                            }
                        }
                        
                        const userPlanLevel = userSubscription?.planLevel || null;
                        
                        // オーナー自身または管理者でない場合、プランレベルチェック
                        if (!canAccessContent(userPlanLevel, postData.requiredPlanLevel, postData.userId === currentUser.uid, userData.isAdmin)) {
                            setAccessDenied(true);
                            setLoading(false);
                            return;
                        }
                    }
                    
                    // 全ファイルを取得（ギャラリー対応）
                    const allFiles = postData.files && postData.files.length > 0 ? postData.files : [];
                    
                    // 画像URLを変換
                    const imageUrls = allFiles.map(file => convertToProxyUrl(file.url || file.secure_url));
                    
                    console.log('🖼️ ImagePage - Image URLs:', imageUrls);
                    
                    // クリエイター情報を取得
                    let creatorData = {};
                    if (postData.userId) {
                        const userDoc = await getDoc(doc(db, 'users', postData.userId));
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            creatorData = {
                                name: userData.displayName || userData.username || 'クリエイター',
                                username: userData.username ? `@${userData.username}` : '@creator',
                                avatar: userData.photoURL || 'https://via.placeholder.com/150',
                                isVerified: userData.isVerified || false,
                                followers: userData.followers || 0
                            };
                        }
                    }
                    
                    setImageData({
                        id: postDoc.id,
                        title: postData.title || 'タイトルなし',
                        description: postData.explanation || postData.description || postData.content || '説明なし',
                        creator: creatorData,
                        type: 'image',
                        imageUrls: imageUrls,
                        imageUrl: imageUrls[0] || null,
                        likes: postData.likes || 0,
                        comments: postData.commentCount || 0,
                        bookmarks: postData.bookmarks || 0,
                        views: postData.views || 0,
                        uploadDate: postData.createdAt ? new Date(postData.createdAt.seconds * 1000).toLocaleDateString('ja-JP') : '最近',
                        tags: postData.tags || [],
                        userId: postData.userId,
                        isExclusiveContent: postData.isExclusiveContent || false
                    });
                    
                    // 視聴履歴を保存（ログイン済みユーザーのみ）
                    if (currentUser) {
                        try {
                            const added = await addUserView(currentUser.uid, postDoc.id);
                            if (added) {
                                updateViewingHistoryCount(1);
                                console.log('✅ Viewing history saved for post:', postDoc.id);
                            }
                        } catch (error) {
                            console.error('Error saving viewing history:', error);
                        }
                    }
                } else {
                    console.error('Post not found:', id);
                    alert('投稿が見つかりません');
                    navigate('/feed');
                }
            } catch (error) {
                console.error('Error fetching post data:', error);
                alert('投稿データの取得に失敗しました');
            } finally {
                setLoading(false);
            }
        };
        
        if (id) {
            fetchPostData();
        }
    }, [id, currentUser, navigate]);

    // コメントの監視
    useEffect(() => {
        if (!id) return;

        const commentsRef = collection(db, 'posts', id, 'comments');
        const q = query(commentsRef, orderBy('createdAt', 'desc'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const commentsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setComments(commentsData);
        });

        return () => unsubscribe();
    }, [id]);

    const handleLike = async () => {
        if (!imageData || !currentUser) return;

        try {
            const postRef = doc(db, 'posts', imageData.id);
            const isLiked = localLikedPosts.has(imageData.id);

            if (isLiked) {
                await updateDoc(postRef, {
                    likes: increment(-1)
                });
                setLocalLikedPosts(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(imageData.id);
                    return newSet;
                });
                updateLikedCount(-1);
            } else {
                await updateDoc(postRef, {
                    likes: increment(1)
                });
                setLocalLikedPosts(prev => new Set(prev).add(imageData.id));
                updateLikedCount(1);
            }

            setImageData(prev => ({
                ...prev,
                likes: prev.likes + (isLiked ? -1 : 1)
            }));
        } catch (error) {
            console.error('Error toggling like:', error);
        }
    };

    const handleSave = async () => {
        if (!imageData || !currentUser) return;

        try {
            const postRef = doc(db, 'posts', imageData.id);
            const isSaved = localSavedPosts.has(imageData.id);

            if (isSaved) {
                await updateDoc(postRef, {
                    bookmarks: increment(-1)
                });
                setLocalSavedPosts(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(imageData.id);
                    return newSet;
                });
                updateSavedCount(-1);
            } else {
                await updateDoc(postRef, {
                    bookmarks: increment(1)
                });
                setLocalSavedPosts(prev => new Set(prev).add(imageData.id));
                updateSavedCount(1);
            }

            setImageData(prev => ({
                ...prev,
                bookmarks: prev.bookmarks + (isSaved ? -1 : 1)
            }));
        } catch (error) {
            console.error('Error toggling save:', error);
        }
    };

    const handleAddComment = async () => {
        if (!newComment.trim() || !currentUser || !imageData) return;

        try {
            setLoadingComments(true);
            const commentsRef = collection(db, 'posts', imageData.id, 'comments');
            
            await addDoc(commentsRef, {
                userId: currentUser.uid,
                userName: currentUser.displayName || 'ユーザー',
                userAvatar: currentUser.photoURL || '',
                content: newComment,
                createdAt: new Date(),
                likes: 0
            });

            await updateDoc(doc(db, 'posts', imageData.id), {
                commentCount: increment(1)
            });

            setNewComment('');
            setImageData(prev => ({
                ...prev,
                comments: prev.comments + 1
            }));
        } catch (error) {
            console.error('Error adding comment:', error);
            alert('コメントの追加に失敗しました');
        } finally {
            setLoadingComments(false);
        }
    };

    const handleShare = async () => {
        if (!imageData) return;

        const shareData = {
            title: imageData.title,
            text: `${imageData.creator.name}の画像をチェック！`,
            url: window.location.href
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(shareData.url);
                alert('画像URLをクリップボードにコピーしました！');
            }
        } catch (error) {
            console.error('シェアに失敗しました:', error);
        }
    };

    const handleDeletePost = async () => {
        if (!imageData || !currentUser) return;
        if (!window.confirm('この投稿を削除しますか？')) return;

        try {
            setIsDeleting(true);
            await deleteDoc(doc(db, 'posts', imageData.id));
            alert('投稿を削除しました');
            navigate('/feed');
        } catch (error) {
            console.error('Error deleting post:', error);
            alert('投稿の削除に失敗しました');
        } finally {
            setIsDeleting(false);
            setShowOptionsModal(false);
        }
    };

    const handleZoom = (direction) => {
        if (direction === 'in') {
            setZoomLevel(prev => Math.min(prev + 0.5, 3));
        } else {
            setZoomLevel(prev => Math.max(prev - 0.5, 1));
        }
    };

    const handlePreviousImage = () => {
        if (currentImageIndex > 0) {
            setCurrentImageIndex(currentImageIndex - 1);
        }
    };

    const handleNextImage = () => {
        if (imageData && currentImageIndex < imageData.imageUrls.length - 1) {
            setCurrentImageIndex(currentImageIndex + 1);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full"
                />
            </div>
        );
    }

    if (accessDenied) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center"
                >
                    <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center"
                    >
                        <Lock className="w-12 h-12 text-white" />
                    </motion.div>
                    <h2 className="text-2xl font-black bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent mb-4">
                        限定コンテンツ
                    </h2>
                    <p className="text-gray-600 mb-6">
                        このコンテンツはサブスクライバー限定です。<br />
                        クリエイターをサブスクライブして閲覧しましょう。
                    </p>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/feed')}
                        className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-xl font-bold shadow-lg"
                        data-testid="button-back-to-feed"
                    >
                        フィードに戻る
                    </motion.button>
                </motion.div>
            </div>
        );
    }

    if (!imageData) return null;

    const isLiked = localLikedPosts.has(imageData.id);
    const isSaved = localSavedPosts.has(imageData.id);
    const isOwner = currentUser && imageData.userId === currentUser.uid;

    return (
        <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
            {/* Image Viewer */}
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative w-full bg-black"
                style={{ minHeight: '60vh' }}
            >
                <div className="relative flex items-center justify-center" style={{ minHeight: '60vh' }}>
                    <img
                        src={imageData.imageUrls[currentImageIndex]}
                        alt={imageData.title}
                        className="max-w-full max-h-[60vh] object-contain cursor-zoom-in"
                        style={{ transform: `scale(${zoomLevel})` }}
                        onClick={() => setShowFullscreen(true)}
                    />
                    
                    {/* Zoom Controls */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 bg-black/70 backdrop-blur-md rounded-full px-4 py-2"
                    >
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleZoom('out')}
                            className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
                            data-testid="button-zoom-out"
                        >
                            <ZoomOut size={20} />
                        </motion.button>
                        <span className="text-white text-sm px-2 font-medium">
                            {Math.round(zoomLevel * 100)}%
                        </span>
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleZoom('in')}
                            className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
                            data-testid="button-zoom-in"
                        >
                            <ZoomIn size={20} />
                        </motion.button>
                    </motion.div>

                    {/* Gallery Navigation */}
                    {imageData.imageUrls.length > 1 && (
                        <>
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={handlePreviousImage}
                                disabled={currentImageIndex === 0}
                                className="absolute left-4 top-1/2 transform -translate-y-1/2 p-3 bg-black/70 backdrop-blur-md rounded-full text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                data-testid="button-previous-image"
                            >
                                <ChevronLeft size={24} />
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={handleNextImage}
                                disabled={currentImageIndex === imageData.imageUrls.length - 1}
                                className="absolute right-4 top-1/2 transform -translate-y-1/2 p-3 bg-black/70 backdrop-blur-md rounded-full text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                data-testid="button-next-image"
                            >
                                <ChevronRight size={24} />
                            </motion.button>
                            
                            {/* Image Counter */}
                            <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full text-white text-sm font-medium">
                                {currentImageIndex + 1} / {imageData.imageUrls.length}
                            </div>
                        </>
                    )}
                    
                    {/* Exclusive Content Badge */}
                    {imageData.isExclusiveContent && (
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="absolute top-4 left-4 bg-gradient-to-r from-pink-500 to-purple-600 px-4 py-2 rounded-full flex items-center space-x-2 shadow-lg"
                        >
                            <Lock className="w-4 h-4 text-white" />
                            <span className="text-white text-sm font-bold">限定コンテンツ</span>
                        </motion.div>
                    )}
                </div>
            </motion.div>

            {/* Content Info */}
            <div className="bg-white rounded-t-3xl -mt-6 relative z-10 shadow-2xl">
                <div className="p-6 space-y-6">
                    {/* Creator Info */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-between"
                    >
                        <div 
                            className="flex items-center space-x-3 cursor-pointer"
                            onClick={() => navigate(`/profile/${imageData.userId}`)}
                        >
                            <img
                                src={imageData.creator.avatar}
                                alt={imageData.creator.name}
                                className="w-12 h-12 rounded-full object-cover ring-2 ring-pink-200"
                            />
                            <div>
                                <div className="flex items-center space-x-1">
                                    <h3 className="font-bold text-gray-900">{imageData.creator.name}</h3>
                                    {imageData.creator.isVerified && (
                                        <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                                        </svg>
                                    )}
                                </div>
                                <p className="text-sm text-gray-500">{imageData.creator.username}</p>
                            </div>
                        </div>
                        {isOwner && (
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setShowOptionsModal(true)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                data-testid="button-options"
                            >
                                <MoreHorizontal className="w-6 h-6 text-gray-600" />
                            </motion.button>
                        )}
                    </motion.div>

                    {/* Title */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <h1 className="text-2xl font-black bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent mb-2">
                            {imageData.title}
                        </h1>
                        <p className="text-gray-600 text-sm">
                            {imageData.uploadDate} • {imageData.views.toLocaleString()}回閲覧
                        </p>
                    </motion.div>

                    {/* Description */}
                    {imageData.description && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl p-4"
                        >
                            <p className="text-gray-800 whitespace-pre-line">{imageData.description}</p>
                        </motion.div>
                    )}

                    {/* Tags */}
                    {imageData.tags && imageData.tags.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="flex flex-wrap gap-2"
                        >
                            {imageData.tags.split(',').map((tag, index) => (
                                <span
                                    key={index}
                                    className="bg-gradient-to-r from-pink-100 to-purple-100 text-pink-700 px-3 py-1 rounded-full text-sm font-medium"
                                >
                                    #{tag.trim()}
                                </span>
                            ))}
                        </motion.div>
                    )}

                    {/* Actions */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="flex items-center justify-between py-4 border-t border-gray-100"
                    >
                        <div className="flex items-center space-x-6">
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={handleLike}
                                className="flex items-center space-x-2"
                                data-testid="button-like"
                            >
                                <Heart
                                    className={`w-6 h-6 ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-600'}`}
                                />
                                <span className={`font-bold ${isLiked ? 'text-red-500' : 'text-gray-600'}`}>
                                    {imageData.likes}
                                </span>
                            </motion.button>
                            
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setShowCommentModal(!showCommentModal)}
                                className="flex items-center space-x-2 text-gray-600"
                                data-testid="button-comment"
                            >
                                <MessageCircle className="w-6 h-6" />
                                <span className="font-bold">{imageData.comments}</span>
                            </motion.button>
                            
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={handleSave}
                                data-testid="button-bookmark"
                            >
                                <Bookmark
                                    className={`w-6 h-6 ${isSaved ? 'fill-yellow-500 text-yellow-500' : 'text-gray-600'}`}
                                />
                            </motion.button>
                        </div>
                        
                        <motion.button
                            whileHover={{ scale: 1.1, rotate: 15 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={handleShare}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            data-testid="button-share"
                        >
                            <Share className="w-6 h-6 text-gray-600" />
                        </motion.button>
                    </motion.div>

                    {/* Comments Section */}
                    <AnimatePresence>
                        {showCommentModal && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="border-t border-gray-100 pt-4 space-y-4"
                            >
                                <h3 className="font-bold text-gray-900">コメント ({imageData.comments})</h3>
                                
                                {/* Add Comment */}
                                <div className="flex space-x-3">
                                    <img
                                        src={currentUser?.photoURL || 'https://via.placeholder.com/32'}
                                        alt="Your avatar"
                                        className="w-10 h-10 rounded-full object-cover"
                                    />
                                    <div className="flex-1 flex">
                                        <input
                                            type="text"
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                                            placeholder="コメントを追加..."
                                            className="flex-1 p-3 border border-gray-300 rounded-l-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                            data-testid="input-comment"
                                        />
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={handleAddComment}
                                            disabled={loadingComments || !newComment.trim()}
                                            className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-r-xl font-bold shadow-lg disabled:opacity-50"
                                            data-testid="button-send-comment"
                                        >
                                            {loadingComments ? '送信中...' : '送信'}
                                        </motion.button>
                                    </div>
                                </div>

                                {/* Comments List */}
                                <div className="space-y-4 max-h-96 overflow-y-auto">
                                    {comments.map((comment) => (
                                        <div key={comment.id} className="flex space-x-3">
                                            <img
                                                src={comment.userAvatar || 'https://via.placeholder.com/32'}
                                                alt={comment.userName}
                                                className="w-8 h-8 rounded-full object-cover"
                                            />
                                            <div className="flex-1">
                                                <div className="bg-gray-50 rounded-2xl p-3">
                                                    <span className="font-semibold text-gray-900">{comment.userName}</span>
                                                    <p className="text-gray-800 mt-1">{comment.content}</p>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1 ml-3">
                                                    {comment.createdAt && new Date(comment.createdAt.seconds * 1000).toLocaleDateString('ja-JP')}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Fullscreen Modal */}
            <AnimatePresence>
                {showFullscreen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black z-50 flex items-center justify-center"
                    >
                        <div className="relative w-full h-full flex items-center justify-center">
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setShowFullscreen(false)}
                                className="absolute top-4 right-4 p-3 bg-white/20 backdrop-blur-md rounded-full text-white z-10"
                                data-testid="button-close-fullscreen"
                            >
                                <X size={24} />
                            </motion.button>
                            
                            <img
                                src={imageData.imageUrls[currentImageIndex]}
                                alt={imageData.title}
                                className="max-w-full max-h-full object-contain"
                            />
                            
                            {imageData.imageUrls.length > 1 && (
                                <>
                                    <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={handlePreviousImage}
                                        disabled={currentImageIndex === 0}
                                        className="absolute left-4 top-1/2 transform -translate-y-1/2 p-3 bg-white/20 backdrop-blur-md rounded-full text-white disabled:opacity-30"
                                    >
                                        <ChevronLeft size={24} />
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={handleNextImage}
                                        disabled={currentImageIndex === imageData.imageUrls.length - 1}
                                        className="absolute right-4 top-1/2 transform -translate-y-1/2 p-3 bg-white/20 backdrop-blur-md rounded-full text-white disabled:opacity-30"
                                    >
                                        <ChevronRight size={24} />
                                    </motion.button>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Options Modal */}
            <AnimatePresence>
                {showOptionsModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                        onClick={() => setShowOptionsModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-3"
                        >
                            <h3 className="text-lg font-bold text-gray-900 mb-4">投稿オプション</h3>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleDeletePost}
                                disabled={isDeleting}
                                className="w-full flex items-center justify-center space-x-2 p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
                                data-testid="button-delete-post"
                            >
                                <span>{isDeleting ? '削除中...' : '投稿を削除'}</span>
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setShowOptionsModal(false)}
                                className="w-full p-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                キャンセル
                            </motion.button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="pb-24">
                <BottomNavigationWithCreator active="home" />
            </div>
        </div>
    );
};

export default ImagePage;
