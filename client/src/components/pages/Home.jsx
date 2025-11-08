import React, { useState, useEffect } from 'react';
// import { motion } from 'framer-motion';
// import { signOut } from 'firebase/auth';
// import { auth } from '../../firebase';
// import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, query, where, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Header from '../../Header/Header';
// import Notifications from '../../Header/Notifications';
import UserNotifications from '../UserNotifications';
import FeaturedCreators from '../FeaturedCreators';
import RecommendedGenres from '../RecommendedGenres';
import CleanCreatorPage from '../FollowCreatorPage';
import BottomNavigationWithCreator from '../BottomNavigationWithCreator';

const Home = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('home');
    const [likedItems, setLikedItems] = useState(new Set());
    const [, setIsMobile] = useState(false);
    const [verticalPosts, setVerticalPosts] = useState([]);
    const [approvedCreators, setApprovedCreators] = useState([]);
    const [postsWithCreators, setPostsWithCreators] = useState([]);
    // const { currentUser } = useAuth();

    // Logout function
    // const handleLogout = async () => {
    //     try {
    //         await signOut(auth);
    //         // Clear age verification from localStorage on logout
    //         localStorage.removeItem('ageVerified');
    //         console.log("User logged out successfully");
    //     } catch (error) {
    //         console.error("Logout error:", error.message);
    //     }
    // };

    const handleNavigation = (path) => {
        console.log('Navigation clicked:', path);
        if (path === 'home') {
            setActiveTab('home');
        } else if (path === 'favorites') {
            // navigate('/feed');
        } else if (path === 'ranking') {
            setActiveTab('ranking');
            console.log('Ranking navigation not implemented yet');
        } else if (path === 'messages') {
            console.log('Navigating to messages...');
            // navigate('/msg');
        } else if (path === 'account') {
            setActiveTab('account');
            console.log('Account navigation not implemented yet');
        } else {
            setActiveTab(path);
            console.log(`Navigate to: ${path}`);
        }
    };

    const checkMobile = () => {
        setIsMobile(window.innerWidth < 768);
    };

    useEffect(() => {
        checkMobile();
        window.addEventListener('resize', checkMobile);

        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // URLをプロキシURLに変換する関数
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

    // クリエイターの縦型コンテンツを取得
    useEffect(() => {
        const postsQuery = query(
            collection(db, 'posts'),
            where('visibility', '==', 'public'),
            orderBy('createdAt', 'desc'),
            limit(10)
        );

        const unsubscribe = onSnapshot(postsQuery, async (snapshot) => {
            try {
                const posts = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setVerticalPosts(posts);
                
                // クリエイター情報のキャッシュ（同じクリエイターの重複取得を防ぐ）
                const creatorCache = new Map();
                
                // 投稿のクリエイター情報を取得
                const postsWithCreatorData = await Promise.all(
                    posts.map(async (post) => {
                        if (post.userId) {
                            // キャッシュをチェック
                            if (creatorCache.has(post.userId)) {
                                return {
                                    ...post,
                                    creator: creatorCache.get(post.userId)
                                };
                            }
                            
                            try {
                                const userDoc = await getDoc(doc(db, 'users', post.userId));
                                if (userDoc.exists()) {
                                    const creatorData = {
                                        id: userDoc.id,
                                        displayName: userDoc.data().displayName,
                                        avatar: userDoc.data().avatar
                                    };
                                    creatorCache.set(post.userId, creatorData);
                                    return {
                                        ...post,
                                        creator: creatorData
                                    };
                                }
                            } catch (error) {
                                console.error(`Failed to fetch creator ${post.userId}:`, error);
                            }
                        }
                        return post;
                    })
                );
                
                console.log('✅ Fetched', postsWithCreatorData.length, 'posts with creators');
                setPostsWithCreators(postsWithCreatorData);
            } catch (error) {
                console.error('Error fetching posts with creators:', error);
                setPostsWithCreators([]);
            }
        });

        return () => unsubscribe();
    }, []);

    // 承認されたクリエイターを取得
    useEffect(() => {
        const creatorsQuery = query(
            collection(db, 'users'),
            where('isCreator', '==', true),
            where('creatorStatus', '==', 'approved'),
            limit(10)
        );

        const unsubscribe = onSnapshot(creatorsQuery, (snapshot) => {
            const creators = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setApprovedCreators(creators);
        });

        return () => unsubscribe();
    }, []);

    const toggleLike = (id) => {
        const newLiked = new Set(likedItems);
        if (newLiked.has(id)) {
            newLiked.delete(id);
        } else {
            newLiked.add(id);
        }
        setLikedItems(newLiked);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-pink-50 dark:from-black dark:via-gray-950 dark:to-black transition-colors duration-300">
            {/* Make header fixed */}
            <div className="fixed top-0 left-0 w-full z-50 bg-white dark:bg-black shadow dark:shadow-gray-900">
                <Header />
            </div>

            {/* Add padding-top to prevent content hiding behind header */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-4 pt-18 lg:mt-10">

                {/* User Welcome Section */}
                {/* {currentUser && (
                    <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-800">
                                    Welcome back, {currentUser.displayName || currentUser.email}!
                                </h2>
                                <p className="text-sm text-gray-600">
                                    You're successfully logged in
                                </p>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                )} */}

                {/* プッシュ通知表示 */}
                <UserNotifications />

                <FeaturedCreators />
                
                {/* 縦型カード10個 - 横スクロール（クリエイターコンテンツ） */}
                <div className="overflow-x-auto scrollbar-hide mb-6 -mx-4 px-4" style={{ scrollSnapType: 'x mandatory' }}>
                    <div className="flex gap-3 pb-2">
                        {postsWithCreators.map((post, index) => {
                            // 投稿の最初のファイルを取得
                            const firstFile = post.files && post.files.length > 0 ? post.files[0] : null;
                            const isVideo = firstFile && firstFile.type && firstFile.type.startsWith('video/');
                            
                            // サムネイルURLを決定
                            let thumbnailUrl = null;
                            let videoUrl = null;
                            if (firstFile) {
                                if (isVideo) {
                                    // 動画の場合: まず動画URLを常に作成（フォールバック用）
                                    const rawVideoUrl = firstFile.secure_url || firstFile.url || (firstFile.storageUri ? `/api/proxy/${firstFile.storageUri}` : null);
                                    const proxyUrl = convertToProxyUrl(rawVideoUrl);
                                    // #t=0.001を追加して最初のフレームを表示
                                    videoUrl = proxyUrl ? `${proxyUrl}#t=0.001` : null;
                                    
                                    // thumbnailUrlが画像ファイルならそれを優先的に使用
                                    if (firstFile.thumbnailUrl && !firstFile.thumbnailUrl.match(/\.(mp4|webm|mov|avi)$/i)) {
                                        thumbnailUrl = convertToProxyUrl(firstFile.thumbnailUrl);
                                    }
                                } else {
                                    // 画像の場合: 通常通り
                                    const rawUrl = firstFile.thumbnailUrl || firstFile.secure_url || firstFile.url || (firstFile.storageUri ? `/api/proxy/${firstFile.storageUri}` : null);
                                    thumbnailUrl = convertToProxyUrl(rawUrl);
                                }
                            }
                            
                            return (
                                <div 
                                    key={post.id}
                                    className="group relative flex-none w-[calc(30%-8px)] rounded-2xl overflow-hidden shadow-[0_8px_32px_-8px_rgba(236,72,153,0.3)] hover:shadow-[0_12px_48px_-12px_rgba(236,72,153,0.5)] transition-all duration-300 hover:-translate-y-2 cursor-pointer" 
                                    style={{ scrollSnapAlign: 'start' }}
                                    data-testid={`card-vertical-${index + 1}`}
                                    onClick={() => navigate(`/video/${post.id}`)}
                                >
                                    <div className="relative w-full h-56 bg-gradient-to-br from-pink-200 to-purple-200">
                                        {thumbnailUrl ? (
                                            <img 
                                                src={thumbnailUrl}
                                                alt={post.title || `Post ${index + 1}`}
                                                className={`w-full h-full object-cover ${post.isExclusiveContent ? 'blur-md' : ''}`}
                                                loading="lazy"
                                                data-video-url={videoUrl || ''}
                                                onError={(e) => {
                                                    const fallbackVideoUrl = e.target.getAttribute('data-video-url');
                                                    if (fallbackVideoUrl) {
                                                        const container = e.target.parentElement;
                                                        const video = document.createElement('video');
                                                        video.src = fallbackVideoUrl;
                                                        video.className = e.target.className;
                                                        video.preload = 'metadata';
                                                        video.muted = true;
                                                        video.playsInline = true;
                                                        container.replaceChild(video, e.target);
                                                    } else {
                                                        e.target.src = '/genre-1.png';
                                                    }
                                                }}
                                            />
                                        ) : videoUrl ? (
                                            <video
                                                src={videoUrl}
                                                className={`w-full h-full object-cover ${post.isExclusiveContent ? 'blur-md' : ''}`}
                                                preload="metadata"
                                                muted
                                                playsInline
                                            />
                                        ) : (
                                            <img 
                                                src="/genre-1.png" 
                                                alt="Fallback"
                                                className={`w-full h-full object-cover ${post.isExclusiveContent ? 'blur-md' : ''}`}
                                            />
                                        )}
                                        {post.isExclusiveContent && (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-black/30">
                                                <svg className="w-12 h-12 text-white mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                </svg>
                                                <div className="bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs px-3 py-1 rounded-full font-bold">
                                                    {post.requiredPlanLevel === 'vip' ? 'VIP限定' : post.requiredPlanLevel === 'premium' ? 'プレミアム限定' : 'サブスク限定'}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* クリエイターアイコン10個 - 横スクロール */}
                <div className="overflow-x-auto scrollbar-hide mb-8 -mx-4 px-4" style={{ scrollSnapType: 'x mandatory' }}>
                    <div className="flex gap-4 pb-2">
                        {approvedCreators.map((creator, index) => (
                            <div 
                                key={creator.id}
                                className="flex-none" 
                                style={{ scrollSnapAlign: 'start' }}
                                data-testid={`user-icon-${index + 1}`}
                                onClick={() => navigate(`/creator-profile/${creator.id}`)}
                            >
                                <div className="group relative cursor-pointer">
                                    <div className="w-20 h-20 rounded-full overflow-hidden shadow-md transition-all duration-300 group-hover:shadow-lg group-hover:scale-110 border-2 border-pink-200 group-hover:border-pink-400">
                                        {creator.avatar ? (
                                            <img 
                                                src={creator.avatar}
                                                alt={creator.displayName || `Creator ${index + 1}`}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-pink-200 to-purple-200 flex items-center justify-center text-gray-400 text-xs">
                                                {creator.displayName?.[0] || 'U'}
                                            </div>
                                        )}
                                    </div>
                                    {creator.displayName && (
                                        <p className="text-xs text-center mt-1 text-gray-600 dark:text-gray-400 truncate w-20">
                                            {creator.displayName}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <RecommendedGenres likedItems={likedItems} toggleLike={toggleLike} />
                <CleanCreatorPage />
            </div>

            <BottomNavigationWithCreator active="home" />

            {/* Padding for fixed nav */}
            <div className="h-20"></div>
        </div>
    );
};

export default Home;
