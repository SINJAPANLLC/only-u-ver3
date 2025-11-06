import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, Star, Bookmark, UserPlus, Check } from 'lucide-react';
import { t } from 'i18next';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';

const FeaturedAdminPage = () => {
    const navigate = useNavigate();
    const [likedPosts, setLikedPosts] = useState(new Set());
    const [bookmarkedPosts, setBookmarkedPosts] = useState(new Set());
    const [followedUsers, setFollowedUsers] = useState(new Set());
    const [featuredPosts, setFeaturedPosts] = useState([]);
    const [featuredUsers, setFeaturedUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [videoDurations, setVideoDurations] = useState({});

    // サムネイル画像
    const thumbnailImages = [
        '/genre-1.png',
        '/genre-2.png',
        '/genre-3.png',
    ];

    // 動画の再生時間を取得する関数
    const getVideoDuration = (videoUrl) => {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            
            video.onloadedmetadata = () => {
                const duration = video.duration;
                const minutes = Math.floor(duration / 60);
                const seconds = Math.floor(duration % 60);
                const formattedDuration = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                resolve(formattedDuration);
            };
            
            video.onerror = () => {
                resolve('00:00');
            };
            
            video.src = videoUrl;
        });
    };

    // Load featured pickups from API and creators from Firestore
    useEffect(() => {
        loadFeaturedPickups();
        loadFeaturedCreators();
    }, []);

    // Load featured creators from Firestore
    const loadFeaturedCreators = async () => {
        try {
            // Query approved creators only (to avoid composite index requirement)
            const creatorsQuery = query(
                collection(db, 'users'),
                where('isCreator', '==', true),
                where('creatorStatus', '==', 'approved'),
                limit(20)
            );

            const snapshot = await getDocs(creatorsQuery);
            
            // Map and sort by follower count on the client side
            const creatorsData = snapshot.docs
                .map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        name: data.displayName || data.username || 'Anonymous',
                        avatar: data.photoURL || '/logo192.png',
                        likes: formatNumber(data.totalLikes || 0),
                        followers: formatNumber(data.followerCount || 0),
                        followerCount: data.followerCount || 0,
                        isVerified: data.isVerified || false
                    };
                })
                .sort((a, b) => b.followerCount - a.followerCount)
                .slice(0, 6)
                .map(({ followerCount, ...rest }) => rest);

            setFeaturedUsers(creatorsData);
        } catch (error) {
            console.error('Error loading featured creators:', error);
            // If composite index error, inform user
            if (error.code === 'failed-precondition') {
                console.warn('Firestore composite index required. Please create an index in Firebase Console.');
            }
            // Fallback to empty array if error
            setFeaturedUsers([]);
        }
    };

    // Format number to K format (e.g., 1000 -> 1K)
    const formatNumber = (num) => {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    };

    // URLをプロキシURLに変換する関数（HOMEページと同じロジック）
    const convertToProxyUrl = (url) => {
        if (!url) return null;
        
        // すでにプロキシURLの場合、重複パスをチェック
        if (url.startsWith('/api/proxy/')) {
            // public/public/ または private/private/ の重複を修正
            if (url.includes('/public/public/')) {
                return url.replace('/public/public/', '/public/');
            }
            if (url.includes('/private/private/')) {
                return url.replace('/private/private/', '/private/');
            }
            return url;
        }
        
        if (url.startsWith('/api/bunny-stream-thumbnail/')) return url;
        
        // 完全URL（https://...）の場合、パス部分のみを抽出
        if (url.startsWith('https://') || url.startsWith('http://')) {
            try {
                const urlObj = new URL(url);
                const pathname = urlObj.pathname;
                
                // /objects/ を含む場合
                if (pathname.includes('/objects/')) {
                    const filename = pathname.split('/objects/')[1];
                    return `/api/proxy/public/${filename}`;
                }
                
                // /api/proxy/ を含む場合
                if (pathname.includes('/api/proxy/')) {
                    return pathname; // パス部分のみを返す
                }
                
                // /public/ を含む場合（重複パス修正）
                if (pathname.includes('/public/')) {
                    const lastPublicIndex = pathname.lastIndexOf('/public/');
                    const filename = pathname.substring(lastPublicIndex + '/public/'.length);
                    return `/api/proxy/public/${filename}`;
                }
            } catch (e) {
                console.error('URL parsing error:', e);
            }
        }
        
        // /objects/ で始まるURLは /api/proxy/public/ に変換
        if (url.startsWith('/objects/')) {
            return url.replace('/objects/', '/api/proxy/public/');
        }
        
        // そのまま返す
        return url;
    };

    const loadFeaturedPickups = async () => {
        try {
            setIsLoading(true);
            
            // Fetch pickups directly from Firestore
            const pickupsQuery = query(
                collection(db, 'featuredPickups'),
                where('isActive', '==', true),
                limit(20)
            );

            const pickupsSnapshot = await getDocs(pickupsQuery);
            
            // Fetch post details for each pickup
            const postsWithData = await Promise.all(
                pickupsSnapshot.docs.map(async (pickupDoc) => {
                    const pickupData = pickupDoc.data();
                    const postId = pickupData.postId;
                    
                    try {
                        const postRef = doc(db, 'posts', postId);
                        const postSnap = await getDoc(postRef);
                        
                        if (!postSnap.exists()) {
                            return null;
                        }
                        
                        const postData = postSnap.data();
                        const timeAgo = calculateTimeAgo(postData.createdAt?.toDate() || new Date());
                        
                        // Fetch user data from users collection
                        let userAvatar = postData.userAvatar || '/logo192.png';
                        let userName = postData.userName || 'Anonymous';
                        const userId = postData.userId || postData.uid;
                        
                        if (userId) {
                            try {
                                const userRef = doc(db, 'users', userId);
                                const userSnap = await getDoc(userRef);
                                if (userSnap.exists()) {
                                    const userData = userSnap.data();
                                    userAvatar = userData.photoURL || userData.avatar || userAvatar;
                                    userName = userData.displayName || userData.username || userName;
                                }
                            } catch (userError) {
                                console.error('Error fetching user data:', userId, userError);
                            }
                        }
                        
                        return {
                            id: postSnap.id,
                            userId: userId,
                            title: postData.title || postData.explanation || 'Untitled',
                            duration: postData.files?.[0]?.duration || postData.duration || '00:00',
                            thumbnail: postData.thumbnailUrl || postData.files?.[0]?.thumbnailUrl || '/genre-1.png',
                            files: postData.files || [],
                            user: {
                                id: userId,
                                name: userName,
                                avatar: userAvatar,
                                timeAgo: timeAgo,
                                followers: postData.userFollowers || 0
                            },
                            likes: postData.likes || 0,
                            bookmarks: postData.bookmarks || 0,
                            isNew: postData.isNew !== false,
                            position: pickupData.position
                        };
                    } catch (error) {
                        console.error('Error fetching post:', postId, error);
                        return null;
                    }
                })
            );
            
            const validPosts = postsWithData
                .filter(post => post !== null)
                .sort((a, b) => a.position - b.position)
                .slice(0, 10);
            setFeaturedPosts(validPosts);
            
            // ✅ 最適化: Firestoreにdurationがない動画のみ、動画の再生時間を取得
            validPosts.forEach(async (post) => {
                // 既にFirestoreからdurationを取得している場合はスキップ
                if (post.duration && post.duration !== '00:00') {
                    return;
                }
                
                if (post.files && post.files.length > 0) {
                    const firstFile = post.files[0];
                    if (firstFile.type?.includes('video') || firstFile.resourceType === 'video') {
                        let videoUrl = firstFile.url;
                        
                        // Replit Object Storageの場合はプロキシURLに変換
                        if (videoUrl.includes('replit-objstore')) {
                            // 最後の /public/ 以降を取得
                            const lastPublicIndex = videoUrl.lastIndexOf('/public/');
                            if (lastPublicIndex !== -1) {
                                const filename = videoUrl.substring(lastPublicIndex + '/public/'.length);
                                videoUrl = `/api/proxy/public/${filename}`;
                            }
                        }
                        
                        const duration = await getVideoDuration(videoUrl);
                        setVideoDurations(prev => ({
                            ...prev,
                            [post.id]: duration
                        }));
                    }
                }
            });
        } catch (error) {
            console.error('Error loading featured pickups:', error);
            // Fallback to default posts if error
            setFeaturedPosts(getDefaultPosts());
        } finally {
            setIsLoading(false);
        }
    };

    const calculateTimeAgo = (date) => {
        const now = new Date();
        const diffInMs = now - date;
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
        
        if (diffInDays === 0) {
            const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
            if (diffInHours === 0) {
                const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
                return `${diffInMinutes}分前`;
            }
            return `${diffInHours}時間前`;
        } else if (diffInDays === 1) {
            return '1日前';
        } else if (diffInDays < 7) {
            return `${diffInDays}日前`;
        } else if (diffInDays < 30) {
            const weeks = Math.floor(diffInDays / 7);
            return `${weeks}週間前`;
        } else if (diffInDays < 365) {
            const months = Math.floor(diffInDays / 30);
            return `${months}ヶ月前`;
        } else {
            const years = Math.floor(diffInDays / 365);
            return `${years}年前`;
        }
    };

    const getDefaultPosts = () => {
        // Default posts when no API data available
        return [
            {
                id: 1,
                title: "Boing boing",
                duration: "00:06",
                user: {
                    name: "Sakura",
                    avatar: "/logo192.png",
                    timeAgo: "3日前",
                    followers: 25300
                },
                likes: 32,
                bookmarks: 19,
                isNew: true
            },
            {
                id: 2,
                title: "After groping her I-cup breasts with their lewdly huge areolas and interviewing her...",
                duration: "49:30",
                user: {
                    name: "Big Breasts Academy",
                    avatar: "/logo192.png",
                    timeAgo: "1日前",
                    followers: 101600
                },
                likes: 11,
                bookmarks: 11,
                isNew: false
            },
            {
                id: 3,
                title: "Obon Limited!! Giveaway!! [Please read carefully to the end] Special price.",
                duration: "Limited",
                user: {
                    name: "Yoga Teacher",
                    avatar: "/logo192.png",
                    timeAgo: "2日前",
                    followers: 78900
                },
                likes: 57,
                bookmarks: 50,
                isNew: true
            },
            {
                id: 4,
                title: "A short elementary school teacher with big tits came to the room, so I hugged he...",
                duration: "26:31",
                user: {
                    name: "Kei",
                    avatar: "/logo192.png",
                    timeAgo: "1ヶ月前",
                    followers: 45200
                },
                likes: 111,
                bookmarks: 111,
                isNew: false
            }
        ];
    };

    const toggleLike = (postId) => {
        setLikedPosts(prev => {
            const newSet = new Set(prev);
            if (newSet.has(postId)) {
                newSet.delete(postId);
            } else {
                newSet.add(postId);
            }
            return newSet;
        });
    };

    const toggleBookmark = (postId) => {
        setBookmarkedPosts(prev => {
            const newSet = new Set(prev);
            if (newSet.has(postId)) {
                newSet.delete(postId);
            } else {
                newSet.add(postId);
            }
            return newSet;
        });
    };

    const toggleFollow = (userId) => {
        setFollowedUsers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(userId)) {
                newSet.delete(userId);
            } else {
                newSet.add(userId);
            }
            return newSet;
        });
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: {
                duration: 0.5,
                ease: "easeOut"
            }
        }
    };

    if (isLoading) {
        return (
            <div className="mb-12">
                <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center">
                    <motion.div
                        whileHover={{ scale: 1.1, rotate: 180 }}
                        transition={{ duration: 0.3 }}
                        className="mr-2 p-1.5 rounded-lg bg-gradient-to-br from-pink-400 to-pink-600 shadow-md"
                    >
                        <Star className="w-4 h-4 sm:w-5 sm:h-5 text-white fill-white" strokeWidth={2.5} />
                    </motion.div>
                    {t('featuredAdmin.header')}
                </h2>
                <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-gray-200 animate-pulse rounded-lg aspect-square"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="mb-12">
            {/* 運営Pickup投稿セクション */}
            <div className="mb-8">
                <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center">
                    <motion.div
                        whileHover={{ scale: 1.1, rotate: 180 }}
                        transition={{ duration: 0.3 }}
                        className="mr-2 p-1.5 rounded-lg bg-gradient-to-br from-pink-400 to-pink-600 shadow-md"
                        data-testid="icon-featured-star"
                    >
                        <Star className="w-4 h-4 sm:w-5 sm:h-5 text-white fill-white" strokeWidth={2.5} />
                    </motion.div>
                    {t('featuredAdmin.header')}
                </h2>

                {/* Posts Grid */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid grid-cols-2 gap-4"
                >
                    {featuredPosts.map((post, index) => {
                        // 動画ファイル（.mp4など）の場合はデフォルト画像を使用
                        const isVideoFile = post.thumbnail?.toLowerCase().endsWith('.mp4') || post.thumbnail?.toLowerCase().endsWith('.mov') || post.thumbnail?.toLowerCase().endsWith('.avi');
                        const thumbnailUrl = (post.thumbnail && !isVideoFile) ? post.thumbnail : thumbnailImages[index % thumbnailImages.length];
                        
                        return (
                            <motion.div
                                key={post.id}
                                variants={itemVariants}
                                whileHover={{ y: -8, scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => navigate(`/video/${post.id}`)}
                                className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm hover:shadow-xl transition-all cursor-pointer group"
                                data-testid={`featured-card-${post.id}`}
                            >
                                {/* サムネイル */}
                                <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-pink-200 to-purple-200">
                                    {(() => {
                                        const firstFile = post.files?.[0];
                                        const isVideo = firstFile?.type?.includes('video') || firstFile?.resourceType === 'video';
                                        
                                        // サムネイルURLを決定
                                        let thumbnailSrc = null;
                                        let videoSrc = null;
                                        
                                        if (firstFile) {
                                            if (isVideo) {
                                                // 動画の場合: まず動画URLを常に作成（フォールバック用）
                                                const rawVideoUrl = firstFile.secure_url || firstFile.url || (firstFile.storageUri ? `/api/proxy/${firstFile.storageUri}` : null);
                                                videoSrc = convertToProxyUrl(rawVideoUrl);
                                                if (videoSrc) videoSrc += '#t=0.001'; // 最初のフレームを表示
                                                
                                                // thumbnailUrlが画像ファイルならそれを優先的に使用
                                                if (firstFile.thumbnailUrl && !firstFile.thumbnailUrl.match(/\.(mp4|webm|mov|avi)$/i)) {
                                                    thumbnailSrc = convertToProxyUrl(firstFile.thumbnailUrl);
                                                }
                                            } else {
                                                // 画像の場合: 通常通り
                                                const rawUrl = firstFile.thumbnailUrl || firstFile.secure_url || firstFile.url || (firstFile.storageUri ? `/api/proxy/${firstFile.storageUri}` : null);
                                                thumbnailSrc = convertToProxyUrl(rawUrl);
                                            }
                                        }
                                        
                                        // サムネイル画像がある場合（動画・画像共通）
                                        if (thumbnailSrc) {
                                            return (
                                                <motion.img
                                                    src={thumbnailSrc}
                                                    alt={post.title}
                                                    className="w-full h-full object-cover"
                                                    animate={{ 
                                                        scale: [1, 1.05, 1],
                                                        x: [0, -5, 0],
                                                        y: [0, 3, 0]
                                                    }}
                                                    transition={{ 
                                                        duration: 8,
                                                        repeat: Infinity,
                                                        ease: "easeInOut",
                                                        delay: index * 0.2
                                                    }}
                                                    whileHover={{ scale: 1.15 }}
                                                    onError={(e) => {
                                                        console.error('Thumbnail image failed to load:', e.target.src);
                                                        // 動画URLにフォールバック
                                                        if (videoSrc) {
                                                            const container = e.target.parentElement;
                                                            const video = document.createElement('video');
                                                            video.src = videoSrc;
                                                            video.className = e.target.className;
                                                            video.preload = 'metadata';
                                                            video.muted = true;
                                                            video.playsInline = true;
                                                            container.replaceChild(video, e.target);
                                                        } else {
                                                            e.target.src = thumbnailImages[index % thumbnailImages.length];
                                                        }
                                                    }}
                                                />
                                            );
                                        }
                                        
                                        // 動画URLのみがある場合（サムネイル画像なし）
                                        if (videoSrc) {
                                            return (
                                                <motion.video
                                                    src={videoSrc}
                                                    className="w-full h-full object-cover"
                                                    muted
                                                    playsInline
                                                    preload="metadata"
                                                    animate={{ 
                                                        scale: [1, 1.05, 1],
                                                        x: [0, -5, 0],
                                                        y: [0, 3, 0]
                                                    }}
                                                    transition={{ 
                                                        duration: 8,
                                                        repeat: Infinity,
                                                        ease: "easeInOut",
                                                        delay: index * 0.2
                                                    }}
                                                    whileHover={{ scale: 1.15 }}
                                                    onError={(e) => {
                                                        console.error('Video thumbnail failed to load:', videoSrc);
                                                        e.target.style.display = 'none';
                                                        const fallbackImg = document.createElement('img');
                                                        fallbackImg.src = thumbnailImages[index % thumbnailImages.length];
                                                        fallbackImg.className = 'w-full h-full object-cover';
                                                        fallbackImg.alt = post.title || 'Fallback';
                                                        e.target.parentElement.appendChild(fallbackImg);
                                                    }}
                                                />
                                            );
                                        }
                                        
                                        // フォールバック: デフォルト画像
                                        return (
                                            <motion.img
                                                src={thumbnailImages[index % thumbnailImages.length]}
                                                alt={post.title}
                                                className="w-full h-full object-cover"
                                                animate={{ 
                                                    scale: [1, 1.05, 1],
                                                    x: [0, -5, 0],
                                                    y: [0, 3, 0]
                                                }}
                                                transition={{ 
                                                    duration: 8,
                                                    repeat: Infinity,
                                                    ease: "easeInOut",
                                                    delay: index * 0.2
                                                }}
                                                whileHover={{ scale: 1.15 }}
                                            />
                                        );
                                    })()}
                                    
                                    {/* ランキングバッジ */}
                                    <motion.div 
                                        whileHover={{ scale: 1.1, rotate: 5 }}
                                        className="absolute top-2 left-2 w-9 h-9 bg-gradient-to-br from-pink-400 via-pink-500 to-pink-600 rounded-full flex items-center justify-center"
                                        style={{ boxShadow: '0 4px 12px rgba(236, 72, 153, 0.4)' }}
                                        data-testid={`rank-badge-featured-${index + 1}`}
                                    >
                                        <span className="text-white font-black text-sm drop-shadow-md">{index + 1}</span>
                                    </motion.div>
                                    
                                    {/* NEWバッジ */}
                                    {post.isNew && (
                                        <motion.div 
                                            initial={{ scale: 0, rotate: -180 }}
                                            animate={{ scale: 1, rotate: 0 }}
                                            transition={{ 
                                                type: "spring",
                                                stiffness: 260,
                                                damping: 20,
                                                delay: index * 0.1 + 0.3 
                                            }}
                                            className="absolute top-2 right-2 bg-gradient-to-r from-pink-500 to-pink-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg"
                                            data-testid={`new-badge-featured-${post.id}`}
                                        >
                                            <motion.span
                                                animate={{ scale: [1, 1.1, 1] }}
                                                transition={{ duration: 2, repeat: Infinity }}
                                            >
                                                NEW
                                            </motion.span>
                                        </motion.div>
                                    )}
                                    
                                    {/* 動画時間 */}
                                    <motion.div 
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.1 + 0.4 }}
                                        className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm text-white text-xs px-2 py-1 rounded font-semibold"
                                        data-testid={`duration-${post.id}`}
                                    >
                                        {videoDurations[post.id] || post.duration || '00:00'}
                                    </motion.div>
                                </div>

                                {/* カード情報 */}
                                <div className="p-3">
                                    {/* タイトル */}
                                    <h3 className="text-sm font-medium line-clamp-2 mb-2 text-gray-800 dark:text-gray-100 leading-snug" data-testid={`title-${post.id}`}>
                                        {post.title}
                                    </h3>

                                    {/* クリエイター情報 */}
                                    <div className="flex items-center mb-2">
                                        {post.user.avatar ? (
                                            <img
                                                src={post.user.avatar}
                                                alt={post.user.name}
                                                className="w-6 h-6 rounded-full mr-2 object-cover cursor-pointer hover:opacity-80 transition-opacity ring-1 ring-pink-100"
                                                data-testid={`avatar-${post.id}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (post.user.id || post.userId) {
                                                        navigate(`/profile/${post.user.id || post.userId}`);
                                                    }
                                                }}
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.nextSibling.style.display = 'flex';
                                                }}
                                            />
                                        ) : null}
                                        <div 
                                            className={`w-6 h-6 rounded-full mr-2 bg-gradient-to-br from-pink-400 to-pink-600 items-center justify-center text-white font-bold text-xs cursor-pointer hover:opacity-80 transition-opacity ring-1 ring-pink-100 ${post.user.avatar ? 'hidden' : 'flex'}`}
                                            style={{ display: post.user.avatar ? 'none' : 'flex' }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (post.user.id || post.userId) {
                                                    navigate(`/profile/${post.user.id || post.userId}`);
                                                }
                                            }}
                                        >
                                            {post.user.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p 
                                                className="text-xs text-gray-600 truncate cursor-pointer hover:text-pink-500 transition-colors" 
                                                data-testid={`username-${post.id}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (post.user.id || post.userId) {
                                                        navigate(`/profile/${post.user.id || post.userId}`);
                                                    }
                                                }}
                                            >
                                                {post.user.name}
                                            </p>
                                            <div className="flex items-center gap-1 text-xs text-gray-400">
                                                <span data-testid={`time-ago-${post.id}`}>{post.user.timeAgo}</span>
                                                {post.user.followers && (
                                                    <>
                                                        <span>•</span>
                                                        <span data-testid={`followers-${post.id}`}>
                                                            {post.user.followers.toLocaleString()} フォロワー
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 統計情報 */}
                                    <div className="flex items-center gap-3 text-xs">
                                        <button 
                                            className="flex items-center gap-1 hover:bg-gray-50 p-1 rounded transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleLike(post.id);
                                            }}
                                            data-testid={`like-button-featured-${post.id}`}
                                        >
                                            <Heart 
                                                className={`w-4 h-4 ${likedPosts.has(post.id) ? 'fill-pink-500 text-pink-500' : 'text-gray-400'}`}
                                            />
                                            <span className="text-gray-600">{post.likes + (likedPosts.has(post.id) ? 1 : 0)}</span>
                                        </button>
                                        <button 
                                            className="flex items-center gap-1 hover:bg-gray-50 p-1 rounded transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleBookmark(post.id);
                                            }}
                                            data-testid={`save-button-featured-${post.id}`}
                                        >
                                            <Bookmark 
                                                className={`w-4 h-4 ${bookmarkedPosts.has(post.id) ? 'fill-pink-500 text-pink-500' : 'text-gray-400'}`}
                                            />
                                            <span className="text-gray-600">{post.bookmarks + (bookmarkedPosts.has(post.id) ? 1 : 0)}</span>
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </motion.div>
            </div>

            {/* ユーザーカードリスト */}
            <div>
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-3"
                >
                    {featuredUsers.map((user, index) => {
                        return (
                            <motion.div
                                key={user.id}
                                variants={itemVariants}
                                whileHover={{ scale: 1.005 }}
                                className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700 hover:shadow-sm transition-all"
                                data-testid={`user-list-card-${user.id}`}
                            >
                                <div className="flex items-center gap-2.5">
                                    {/* ランキングバッジ - 数字表示 */}
                                    <motion.div 
                                        whileHover={{ scale: 1.15, rotate: 5 }}
                                        className="w-11 h-11 rounded-full bg-gradient-to-br from-pink-400 via-pink-500 to-pink-600 text-white flex items-center justify-center flex-shrink-0"
                                        style={{ boxShadow: '0 4px 12px rgba(236, 72, 153, 0.4)' }}
                                        data-testid={`rank-badge-user-${index + 1}`}
                                    >
                                        <span className="text-sm font-black drop-shadow-md">{index + 1}</span>
                                    </motion.div>

                                    {/* アバターと認証マーク */}
                                    <div 
                                        className="relative flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/profile/${user.id}`);
                                        }}
                                    >
                                        {user.avatar ? (
                                            <img
                                                src={user.avatar}
                                                alt={user.name}
                                                className="w-11 h-11 rounded-full object-cover ring-2 ring-pink-100"
                                                data-testid={`avatar-user-${user.id}`}
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.nextSibling.style.display = 'flex';
                                                }}
                                            />
                                        ) : null}
                                        <div 
                                            className={`w-11 h-11 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 items-center justify-center text-white font-bold text-lg ring-2 ring-pink-100 ${user.avatar ? 'hidden' : 'flex'}`}
                                            style={{ display: user.avatar ? 'none' : 'flex' }}
                                        >
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                        {user.isVerified && (
                                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white" data-testid={`verified-badge-${user.id}`}>
                                                <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                                            </div>
                                        )}
                                    </div>

                                    {/* ユーザー情報 */}
                                    <div className="flex-1 min-w-0">
                                        <h3 
                                            className="font-medium text-gray-800 dark:text-gray-100 text-sm truncate mb-0.5 leading-tight cursor-pointer hover:text-pink-500 transition-colors" 
                                            data-testid={`username-user-${user.id}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/profile/${user.id}`);
                                            }}
                                        >
                                            {user.name}
                                        </h3>

                                        <div className="flex items-center gap-2 text-xs">
                                            <div className="flex items-center gap-0.5 text-pink-500">
                                                <Heart size={12} className="fill-current" />
                                                <span className="font-medium" data-testid={`likes-user-${user.id}`}>{user.likes}</span>
                                            </div>
                                            <div className="text-gray-400" data-testid={`followers-user-${user.id}`}>
                                                {user.followers} フォロワー
                                            </div>
                                        </div>
                                    </div>

                                    {/* フォローボタン */}
                                    <button
                                        onClick={() => toggleFollow(user.id)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border-2 flex items-center gap-1 flex-shrink-0 ${
                                            followedUsers.has(user.id)
                                                ? "bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200"
                                                : "bg-white border-pink-500 text-pink-500 hover:bg-pink-50"
                                        }`}
                                        data-testid={`follow-button-user-${user.id}`}
                                    >
                                        <UserPlus size={14} />
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })}
                </motion.div>
            </div>
        </div>
    );
};

export default FeaturedAdminPage;
