import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Crown, Bookmark, Clock, Sparkles } from 'lucide-react';
import { t } from 'i18next';
import { useNavigate } from 'react-router-dom';
import { useUserInteractions } from '../hooks/useUserInteractions';
import { useUserStats } from '../context/UserStatsContext';
import { collection, query, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const Ranking = () => {
    const navigate = useNavigate();
    const { likedPosts, savedPosts, toggleLike, toggleSave, isLiked, isSaved } = useUserInteractions();
    const { updateLikedCount, updateSavedCount } = useUserStats();
    const [localLikedPosts, setLocalLikedPosts] = useState(new Set());
    const [localSavedPosts, setLocalSavedPosts] = useState(new Set());
    const [posts, setPosts] = useState([]);
    const [loadingPosts, setLoadingPosts] = useState(true);
    const [videoDurations, setVideoDurations] = useState({});

    // クリック機能
    const handleVideoClick = (post) => {
        navigate(`/video/${post.id}`);
    };

    const handleAccountClick = (post, e) => {
        e.stopPropagation();
        navigate(`/profile/${post.user.id}`);
    };

    const handleLikeClick = (postId, e) => {
        e.stopPropagation();
        const wasLiked = localLikedPosts.has(postId);
        
        // ローカルステートを更新
        setLocalLikedPosts(prev => {
            const newSet = new Set(prev);
            if (newSet.has(postId)) {
                newSet.delete(postId);
            } else {
                newSet.add(postId);
            }
            return newSet;
        });
        
        // 投稿データのいいね数を更新
        setPosts(prevPosts => 
            prevPosts.map(post => 
                post.id === postId 
                    ? { ...post, likes: wasLiked ? post.likes - 1 : post.likes + 1 }
                    : post
            )
        );
        
        // 統計を更新
        updateLikedCount(wasLiked ? -1 : 1);
        
        // Firestoreに保存
        toggleLike(postId).catch(error => {
            console.error('いいねの切り替えでエラーが発生しました:', error);
            // エラーの場合は元に戻す
            setLocalLikedPosts(prev => {
                const newSet = new Set(prev);
                if (wasLiked) newSet.add(postId);
                else newSet.delete(postId);
                return newSet;
            });
            setPosts(prevPosts => 
                prevPosts.map(post => 
                    post.id === postId 
                        ? { ...post, likes: wasLiked ? post.likes + 1 : post.likes - 1 }
                        : post
                )
            );
            updateLikedCount(wasLiked ? 1 : -1);
        });
    };

    const handleSaveClick = (postId, e) => {
        e.stopPropagation();
        const wasSaved = localSavedPosts.has(postId);
        
        // ローカルステートを更新
        setLocalSavedPosts(prev => {
            const newSet = new Set(prev);
            if (newSet.has(postId)) {
                newSet.delete(postId);
            } else {
                newSet.add(postId);
            }
            return newSet;
        });
        
        // 投稿データのブックマーク数を更新
        setPosts(prevPosts => 
            prevPosts.map(post => 
                post.id === postId 
                    ? { ...post, bookmarks: wasSaved ? post.bookmarks - 1 : post.bookmarks + 1 }
                    : post
            )
        );
        
        // 統計を更新
        updateSavedCount(wasSaved ? -1 : 1);
        
        // Firestoreに保存
        toggleSave(postId).catch(error => {
            console.error('保存の切り替えでエラーが発生しました:', error);
            // エラーの場合は元に戻す
            setLocalSavedPosts(prev => {
                const newSet = new Set(prev);
                if (wasSaved) newSet.add(postId);
                else newSet.delete(postId);
                return newSet;
            });
            setPosts(prevPosts => 
                prevPosts.map(post => 
                    post.id === postId 
                        ? { ...post, bookmarks: wasSaved ? post.bookmarks + 1 : post.bookmarks - 1 }
                        : post
                )
            );
            updateSavedCount(wasSaved ? 1 : -1);
        });
    };

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
                    const converted = `/api/proxy/public/${filename}`;
                    console.log('🔄 Converting full /objects/ URL:', url, '→', converted);
                    return converted;
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
            const converted = url.replace('/objects/', '/api/proxy/public/');
            console.log('🔄 Converting /objects/ URL:', url, '→', converted);
            return converted;
        }
        
        // Bunny Stream thumbnail URL（CORSエラーを防ぐためプロキシ経由に変換）
        // 例: https://vz-524827.b-cdn.net/1c4adc82-0ee4-4b72-9d53-f8fc634277eb/thumbnail.jpg
        if (url.includes('b-cdn.net') && url.includes('/thumbnail')) {
            const guidMatch = url.match(/\/([0-9a-f-]{36})\//i);
            if (guidMatch) {
                const videoGuid = guidMatch[1];
                return `/api/bunny-stream-thumbnail/${videoGuid}`;
            }
        }
        
        // Bunny CDN直接URL（CORSエラーを防ぐためプロキシ経由に変換）
        if (url.includes('only-u.fun/') || url.includes('b-cdn.net/')) {
            const bunnyPattern = /https?:\/\/[^/]+\/(public|private)\/(.+)/;
            const match = url.match(bunnyPattern);
            if (match) {
                const folder = match[1];
                const fileName = match[2];
                return `/api/proxy/${folder}/${fileName}`;
            }
        }
        
        // Google Cloud Storage URLをプロキシURLに変換
        // 例: https://storage.googleapis.com/BUCKET_NAME/public/file.mp4
        if (url.includes('storage.googleapis.com')) {
            const match = url.match(/\/(public|\.private)\/([^?]+)/);
            if (match) {
                const folder = match[1];  // 'public' または '.private'
                const fileName = match[2]; // ファイル名
                return `/api/proxy/${folder}/${fileName}`;
            }
        }
        
        return url;
    };

    // 新しさボーナスを計算する関数
    const calculateFreshnessBonus = (timestamp) => {
        if (!timestamp) return 0;
        
        const now = new Date();
        const postDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const diffInHours = (now - postDate) / (1000 * 60 * 60);
        
        // 24時間以内: +100ポイント
        if (diffInHours < 24) return 100;
        // 3日以内: +50ポイント
        if (diffInHours < 72) return 50;
        // 7日以内: +20ポイント
        if (diffInHours < 168) return 20;
        // それ以降: ボーナスなし
        return 0;
    };

    // Firestoreから人気投稿を取得
    useEffect(() => {
        const fetchRankingPosts = async () => {
            setLoadingPosts(true);
            try {
                const postsRef = collection(db, 'posts');
                
                // 最新の投稿を50件取得（createdAtで降順）
                const q = query(
                    postsRef,
                    orderBy('createdAt', 'desc'),
                    limit(50)
                );
                
                const querySnapshot = await getDocs(q);
                
                const fetchedPosts = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    
                    // 限定コンテンツはランキングから除外
                    if (data.isExclusiveContent === true || data.visibility !== 'public') {
                        return;
                    }
                    
                    // 新しさボーナスを計算
                    const freshnessBonus = calculateFreshnessBonus(data.createdAt);
                    
                    // サムネイルURLを取得（複数のフォールバックオプション）
                    let originalThumbnail = null;
                    let isVideo = false;
                    if (data.files && data.files.length > 0) {
                        const firstFile = data.files[0];
                        isVideo = firstFile.type && firstFile.type.startsWith('video/');
                        
                        // 動画の場合: 動画ファイル自体をサムネイルとして使用（ブラウザが最初のフレームを表示）
                        // 画像の場合: 通常通りサムネイルまたは画像URLを使用
                        if (isVideo) {
                            originalThumbnail = firstFile.secure_url || firstFile.url || null;
                        } else {
                            originalThumbnail = firstFile.thumbnailUrl || firstFile.secure_url || firstFile.url || null;
                        }
                        
                        // storageUriがある場合はプロキシURLを生成
                        if (!originalThumbnail && firstFile.storageUri) {
                            originalThumbnail = `/api/proxy/${firstFile.storageUri}`;
                        }
                    }
                    const proxyThumbnail = convertToProxyUrl(originalThumbnail);
                    
                    // デバッグ: サムネイルURL変換を確認
                    if (fetchedPosts.length < 2) {
                        console.log(`🖼️ Post ${fetchedPosts.length + 1} Thumbnail:`, 
                            'original:', originalThumbnail,
                            'proxy:', proxyThumbnail
                        );
                    }
                    
                    // 動画の実際のファイルURLを取得
                    let videoFileUrl = null;
                    if (data.files && data.files.length > 0) {
                        videoFileUrl = data.files[0].url || null;
                    }
                    
                    // 動画の再生時間を取得（filesから取得するか、durationフィールドを使用）
                    let videoDuration = '00:00';
                    if (data.files && data.files.length > 0 && data.files[0].duration) {
                        videoDuration = data.files[0].duration;
                    } else if (data.duration) {
                        videoDuration = data.duration;
                    }
                    
                    // 投稿データを整形
                    fetchedPosts.push({
                        id: doc.id,
                        title: data.title || 'タイトルなし',
                        likes: data.likes || 0,
                        bookmarks: data.bookmarks || 0,
                        duration: videoDuration,
                        thumbnail: proxyThumbnail,
                        videoUrl: convertToProxyUrl(videoFileUrl), // 実際の動画URL
                        user: {
                            id: data.userId,
                            name: data.userName || '匿名',
                            avatar: data.userAvatar || null
                        },
                        isNew: calculateIsNew(data.createdAt),
                        postedDate: calculateTimeAgo(data.createdAt),
                        // ランキング用スコア（likes + bookmarks + 新しさボーナス）
                        score: (data.likes || 0) + (data.bookmarks || 0) + freshnessBonus
                    });
                });
                
                // スコア順（likes + bookmarks + 新しさボーナス）でソート
                const sortedPosts = fetchedPosts.sort((a, b) => b.score - a.score);
                
                // デバッグ: トップ6件のスコア情報をログ出力
                console.log('📊 Top 6 posts by score:', sortedPosts.slice(0, 6).map(p => ({
                    title: p.title,
                    score: p.score,
                    likes: p.likes,
                    bookmarks: p.bookmarks,
                    postedDate: p.postedDate
                })));
                
                // 上位6件のみ表示
                const topPosts = sortedPosts.slice(0, 6);
                
                // 各投稿の投稿者の最新プロフィール情報を取得
                const postsWithUserInfo = await Promise.all(topPosts.map(async (post) => {
                    try {
                        const userDoc = await getDoc(doc(db, 'users', post.user.id));
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            return {
                                ...post,
                                user: {
                                    id: post.user.id,
                                    name: userData.displayName || userData.username || post.user.name,
                                    avatar: userData.photoURL || userData.avatar || post.user.avatar
                                }
                            };
                        }
                    } catch (error) {
                        console.error(`Error fetching user ${post.user.id}:`, error);
                    }
                    return post;
                }));
                
                // データがない場合はサンプルデータを1つ表示
                if (postsWithUserInfo.length === 0) {
                    const samplePosts = [
                        {
                            id: 'sample_1',
                            title: 'サンプル動画',
                            likes: 245,
                            bookmarks: 89,
                            duration: '05:32',
                            thumbnail: '/genre-1.png',
                            user: {
                                id: '1',
                                name: 'サンプルユーザー',
                                avatar: null
                            },
                            isNew: true,
                            postedDate: '3日前',
                            score: 334
                        }
                    ];
                    setPosts(samplePosts);
                    console.log('✅ Showing 1 sample post (no Firestore data)');
                } else {
                    console.log(`✅ Fetched ${postsWithUserInfo.length} ranking posts with user info`);
                    setPosts(postsWithUserInfo);
                }
            } catch (error) {
                console.error('Error fetching ranking posts:', error);
                // エラーの場合もサンプルデータを表示
                const samplePosts = [
                    {
                        id: 'sample_1',
                        title: 'サンプル動画',
                        likes: 245,
                        bookmarks: 89,
                        duration: '05:32',
                        thumbnail: '/genre-1.png',
                        user: {
                            id: '1',
                            name: 'サンプルユーザー',
                            avatar: null
                        },
                        isNew: true,
                        postedDate: '3日前',
                        score: 334
                    }
                ];
                setPosts(samplePosts);
            } finally {
                setLoadingPosts(false);
            }
        };

        fetchRankingPosts();
    }, []);
    
    // 各動画の再生時間を取得
    useEffect(() => {
        const loadVideoDurations = async () => {
            const durations = {};
            
            for (const post of posts) {
                // ✅ 最適化: Firestoreのfiles配列からdurationを取得
                const fileDuration = post.files?.[0]?.duration;
                if (fileDuration && fileDuration !== '00:00') {
                    durations[post.id] = fileDuration;
                    continue;
                }
                
                // 後方互換性: post.durationもチェック
                if (post.duration && post.duration !== '00:00') {
                    durations[post.id] = post.duration;
                    continue;
                }
                
                // デフォルト値（メタデータ読み込みは削除 - CORSエラーとパフォーマンス問題を回避）
                durations[post.id] = '00:00';
            }
            
            setVideoDurations(durations);
        };
        
        if (posts.length > 0) {
            loadVideoDurations();
        }
    }, [posts]);
    
    // 再生時間をフォーマットする関数
    const formatDuration = (seconds) => {
        if (!seconds || isNaN(seconds)) return '00:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

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
        if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}週間前`;
        return postDate.toLocaleDateString('ja-JP');
    };

    // NEWバッジを表示するかどうか（7日以内）
    const calculateIsNew = (timestamp) => {
        if (!timestamp) return false;
        
        const now = new Date();
        const postDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const diffInDays = Math.floor((now - postDate) / 86400000);
        
        return diffInDays <= 7;
    };

    const filteredPosts = posts;

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

    return (
        <div className="mb-12">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center">
                    <motion.div
                        whileHover={{ scale: 1.1, rotate: -10 }}
                        transition={{ duration: 0.3 }}
                        className="mr-2 p-1.5 rounded-lg bg-gradient-to-br from-pink-400 to-pink-600 shadow-md"
                    >
                        <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-white fill-white" strokeWidth={2.5} />
                    </motion.div>
                    総合ランキング
                </h2>
            </div>

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
                    <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">読み込み中...</p>
                </motion.div>
            ) : (
                <AnimatePresence mode="wait">
                    <motion.div
                        key="all"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="grid grid-cols-2 gap-4"
                    >
                        {filteredPosts.map((post, index) => (
                        <motion.div
                            key={post.id}
                            variants={itemVariants}
                            whileHover={{ y: -8, scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm hover:shadow-xl transition-all cursor-pointer group"
                            onClick={() => handleVideoClick(post)}
                            data-testid={`ranking-card-${post.id}`}
                        >
                            {/* サムネイル */}
                            <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-pink-200 to-purple-200">
                                {post.thumbnail ? (
                                    // Check if thumbnail is an image file (jpg, jpeg, png, webp, gif)
                                    post.thumbnail.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                                        // 画像サムネイルの場合
                                        <motion.img
                                            src={post.thumbnail}
                                            alt={post.title}
                                            loading={index < 4 ? "eager" : "lazy"}
                                            fetchpriority={index < 2 ? "high" : "auto"}
                                            decoding="async"
                                            className="w-full h-full object-cover"
                                            animate={{ 
                                                scale: [1, 1.05, 1],
                                                x: [0, 5, 0],
                                                y: [0, -3, 0]
                                            }}
                                            transition={{ 
                                                duration: 8,
                                                repeat: Infinity,
                                                ease: "easeInOut"
                                            }}
                                            whileHover={{ scale: 1.15 }}
                                            onError={(e) => {
                                                console.error('Image thumbnail failed to load:', e.target.src);
                                                e.target.src = '/genre-1.png';
                                            }}
                                        />
                                    ) : (
                                        // 動画ファイルの場合、videoタグで最初のフレームを表示
                                        <video
                                            src={post.thumbnail}
                                            className="w-full h-full object-cover"
                                            preload="metadata"
                                            muted
                                            playsInline
                                            onError={(e) => {
                                                console.error('Video thumbnail failed to load:', e.target.src);
                                                // エラー時はデフォルト画像に置き換え
                                                e.target.style.display = 'none';
                                                const fallbackImg = document.createElement('img');
                                                fallbackImg.src = '/genre-1.png';
                                                fallbackImg.className = 'w-full h-full object-cover';
                                                fallbackImg.alt = post.title || 'Fallback';
                                                e.target.parentElement.appendChild(fallbackImg);
                                            }}
                                        />
                                    )
                                ) : (
                                    // サムネイルがない場合のフォールバック画像
                                    <img 
                                        src="/genre-1.png" 
                                        alt={post.title}
                                        loading={index < 4 ? "eager" : "lazy"}
                                        fetchpriority={index < 2 ? "high" : "auto"}
                                        decoding="async"
                                        className="w-full h-full object-cover"
                                    />
                                )}
                                
                                {/* ランキングバッジ */}
                                <motion.div 
                                    whileHover={{ scale: 1.1, rotate: 5 }}
                                    className="absolute top-2 left-2 w-9 h-9 bg-gradient-to-br from-pink-400 via-pink-500 to-pink-600 rounded-full flex items-center justify-center shadow-lg"
                                    style={{ boxShadow: '0 4px 12px rgba(236, 72, 153, 0.4)' }}
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
                                        className="absolute top-2 right-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg"
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
                                >
                                    {videoDurations[post.id] || post.duration}
                                </motion.div>
                            </div>

                            {/* カード情報 */}
                            <div className="p-3">
                                {/* タイトル */}
                                <h3 className="text-sm font-medium line-clamp-2 mb-2 text-gray-800 dark:text-gray-100 leading-snug">
                                    {post.title}
                                </h3>

                                {/* クリエイター情報 */}
                                <div 
                                    className="flex items-center mb-2"
                                    onClick={(e) => handleAccountClick(post, e)}
                                >
                                    {post.user.avatar ? (
                                        <img
                                            src={post.user.avatar}
                                            alt={post.user.name}
                                            loading="lazy"
                                            decoding="async"
                                            className="w-6 h-6 rounded-full mr-2 object-cover ring-1 ring-pink-100"
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.nextSibling.style.display = 'flex';
                                            }}
                                        />
                                    ) : null}
                                    <div 
                                        className={`w-6 h-6 rounded-full mr-2 bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center text-white font-bold text-xs ring-1 ring-pink-100 ${post.user.avatar ? 'hidden' : 'flex'}`}
                                        style={{ display: post.user.avatar ? 'none' : 'flex' }}
                                    >
                                        {post.user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{post.user.name}</p>
                                        <p className="text-xs text-gray-400">{post.postedDate}</p>
                                    </div>
                                </div>

                                {/* 統計情報 */}
                                <div className="flex items-center gap-3 text-xs">
                                    <motion.button 
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.95 }}
                                        className="flex items-center gap-1 hover:bg-pink-50 p-1.5 rounded-lg transition-colors"
                                        onClick={(e) => handleLikeClick(post.id, e)}
                                        data-testid={`like-button-${post.id}`}
                                    >
                                        <Heart 
                                            className={`w-4 h-4 transition-all ${localLikedPosts.has(post.id) ? 'fill-pink-500 text-pink-500 scale-110' : 'text-gray-400'}`}
                                            strokeWidth={2.5}
                                        />
                                        <span className="text-gray-600 font-medium">{post.likes}</span>
                                    </motion.button>
                                    <motion.button 
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.95 }}
                                        className="flex items-center gap-1 hover:bg-pink-50 p-1.5 rounded-lg transition-colors"
                                        onClick={(e) => handleSaveClick(post.id, e)}
                                        data-testid={`save-button-${post.id}`}
                                    >
                                        <Bookmark 
                                            className={`w-4 h-4 transition-all ${localSavedPosts.has(post.id) ? 'fill-pink-500 text-pink-500 scale-110' : 'text-gray-400'}`}
                                            strokeWidth={2.5}
                                        />
                                        <span className="text-gray-600 font-medium">{post.bookmarks}</span>
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                        ))}
                    </motion.div>
                </AnimatePresence>
            )}

            {!loadingPosts && filteredPosts.length === 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-12"
                >
                    <div className="text-6xl mb-4">💕</div>
                    <p className="text-gray-500 text-lg">コンテンツがありません</p>
                </motion.div>
            )}
        </div>
    );
};

export default Ranking;
