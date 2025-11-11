import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Bookmark, Share, MoreHorizontal, Play, Pause, Volume2, VolumeX, ArrowLeft, ArrowUp, ArrowDown, ChevronUp, ChevronDown, Film, Maximize, Minimize, User } from 'lucide-react';
import VideoPlayer from '../VideoPlayer';
import BottomNavigationWithCreator from '../BottomNavigationWithCreator';
import { db } from '../../firebase';
import { collection, query, where, orderBy, getDocs, limit, doc, addDoc, onSnapshot, updateDoc, increment } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useUserInteractions } from '../../hooks/useUserInteractions';
import { useUserStats } from '../../context/UserStatsContext';
import { useCreatorCache } from '../../hooks/useCreatorCache';
import logger from '../../utils/logger';

const SocialFeedScreen = () => {
  const navigate = useNavigate();
  const { likedPosts, savedPosts, toggleLike, toggleSave, isLiked, isSaved } = useUserInteractions();
  
  const convertToProxyUrl = useMemo(() => (url) => {
    if (!url) return url;
    
    if (url.startsWith('/objects/')) {
      const filename = url.replace('/objects/', '');
      return `/api/proxy/public/${filename}`;
    }
    
    if (url.includes('only-u.fun/') || url.includes('b-cdn.net/')) {
      const bunnyPattern = /https?:\/\/[^/]+\/(public|private)\/(.+)/;
      const match = url.match(bunnyPattern);
      if (match) {
        const folder = match[1];
        const filename = match[2];
        return `/api/proxy/${folder}/${filename}`;
      }
    }
    
    const objectStoragePattern = /https:\/\/storage\.googleapis\.com\/[^/]+\/(public|\.private)\/(.+)/;
    const match = url.match(objectStoragePattern);
    
    if (match) {
      const folder = match[1];
      const filename = match[2];
      return `/api/proxy/${folder}/${filename}`;
    }
    
    return url;
  }, []);
  
  // Calculate time ago from post creation date
  const getTimeAgo = (date) => {
    if (!date) return '';
    const now = new Date();
    const postDate = new Date(date);
    const diffInMs = now - postDate;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}分前`;
    } else if (diffInHours < 24) {
      return `${diffInHours}時間前`;
    } else {
      return `${diffInDays}日前`;
    }
  };
  
  // Format date for expiration display
  const getExpirationDate = (date) => {
    if (!date) return '';
    const postDate = new Date(date);
    const expirationDate = new Date(postDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from post
    const month = expirationDate.getMonth() + 1;
    const day = expirationDate.getDate();
    return `${month}/${day} まで公開`;
  };
  
  const { getCreatorsBatch } = useCreatorCache();
  
  let updateLikedCount, updateSavedCount;
  try {
    const userStats = useUserStats();
    updateLikedCount = userStats.updateLikedCount;
    updateSavedCount = userStats.updateSavedCount;
  } catch (error) {
    logger.warn('UserStats not available:', error);
    updateLikedCount = () => {};
    updateSavedCount = () => {};
  }
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPostIndex, setCurrentPostIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [localLikedPosts, setLocalLikedPosts] = useState(new Set());
  const [localSavedPosts, setLocalSavedPosts] = useState(new Set());
  const [touchStartY, setTouchStartY] = useState(0);
  const [touchEndY, setTouchEndY] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [isVerticalVideo, setIsVerticalVideo] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekTime, setSeekTime] = useState(0);
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const progressRef = useRef(null);
  const { currentUser } = useAuth();

  // サンプルデータ（Firebaseが利用できない場合のフォールバック）
  const samplePosts = [
    {
      id: 'sample_1',
      title: '大人気 絶頂動画を...',
      description: '【全員にプレゼント付き🎁】参加は一回限り💖特別...',
      type: 'video',
      imageUrl: '/sample-1.png',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      thumbnail: '/sample-1.png',
      likes: 2000,
      bookmarks: 1800,
      comments: 1900,
      userId: 'creator_1',
      userName: 'クリエイター名',
      userAvatar: 'https://images.unsplash.com/photo-1494790108755-2616c933448c?w=150&h=150&fit=crop&crop=face',
      userFollowers: 12500,
      tags: ['巨乳', '素人', '個人撮影'],
      createdAt: new Date(Date.now() - 1000 * 60 * 30) // 30分前
    },
    {
      id: 'sample_2',
      title: 'Sweet Dreams Video',
      description: 'Giveaway Event - 限定コンテンツ',
      type: 'video',
      imageUrl: '/sample-2.png',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
      thumbnail: '/sample-2.png',
      likes: 308,
      bookmarks: 293,
      comments: 156,
      userId: 'creator_2',
      userName: 'Yuki',
      userAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      userFollowers: 8500,
      tags: ['可愛い', 'ギャル', '個人撮影'],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2) // 2時間前
    },
    {
      id: 'sample_3',
      title: 'Private Moment',
      description: 'Exclusive Content - 特別な瞬間',
      type: 'video',
      imageUrl: '/sample-3.jpg',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      thumbnail: '/sample-3.jpg',
      likes: 477,
      bookmarks: 402,
      comments: 234,
      userId: 'creator_3',
      userName: 'Airi',
      userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face',
      userFollowers: 15200,
      tags: ['美少女', '制服', '個人撮影'],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6) // 6時間前
    },
    {
      id: 'sample_4',
      title: 'Live Stream',
      description: 'Active Now - ライブ配信中',
      type: 'video',
      imageUrl: '/sample-1.png',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      thumbnail: '/sample-1.png',
      likes: 405,
      bookmarks: 375,
      comments: 189,
      userId: 'creator_4',
      userName: 'Miu',
      userAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
      userFollowers: 9800,
      tags: ['ライブ', 'リアルタイム', '個人撮影'],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12) // 12時間前
    }
  ];

  // Fetch posts from Firebase
  const fetchPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      logger.log('Fetching posts for feed...');
      
      // Firebaseからデータを取得
      try {
        const postsQuery = query(
          collection(db, 'posts'),
          where('visibility', '==', 'public'),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
        
        // タイムアウトを設定（10秒）
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Firebase timeout')), 10000)
        );
        
        const queryPromise = getDocs(postsQuery);
        const postsSnapshot = await Promise.race([queryPromise, timeoutPromise]);
        
        logger.log('Posts snapshot size:', postsSnapshot.size);
        
        // 投稿データを処理
        const postsData = [];
        const userIds = new Set();
        
        for (const docSnapshot of postsSnapshot.docs) {
          const postData = docSnapshot.data();
          
          // 限定コンテンツはフィードから除外
          if (postData.isExclusiveContent === true) {
            continue;
          }
          
          logger.log('📄 Post data:', {
            id: docSnapshot.id,
            hasFiles: !!(postData.files),
            filesLength: postData.files?.length,
            visibility: postData.visibility,
            userId: postData.userId,
            isExclusiveContent: postData.isExclusiveContent
          });
          
          // Only include posts with images
          if (postData.files && Array.isArray(postData.files) && postData.files.length > 0) {
            const firstFile = postData.files[0];
            const originalUrl = firstFile.url || firstFile.secure_url;
            const fileUrl = convertToProxyUrl(originalUrl);
            
            logger.log('🖼️ First file:', firstFile, 'Original URL:', originalUrl, 'Proxy URL:', fileUrl);
            
            if (fileUrl) {
              const isVideo = firstFile.type && firstFile.type.startsWith('video/');
              
              // サムネイルURLを決定（優先順位: customThumbnail > 自動生成サムネイル > ファイル自体）
              let thumbnailUrl = fileUrl;
              if (postData.customThumbnail) {
                thumbnailUrl = convertToProxyUrl(postData.customThumbnail);
              } else if (firstFile.thumbnailUrl && !firstFile.thumbnailUrl.match(/\.(mp4|webm|mov|avi)$/i)) {
                thumbnailUrl = convertToProxyUrl(firstFile.thumbnailUrl);
              }
              
              postsData.push({
                id: docSnapshot.id,
                ...postData,
                imageUrl: fileUrl,
                videoUrl: isVideo ? fileUrl : undefined,
                thumbnail: thumbnailUrl,
                type: isVideo ? 'video' : 'image',
                date: postData.createdAt ? 
                  (postData.createdAt.seconds ? 
                    new Date(postData.createdAt.seconds * 1000) : 
                    new Date(postData.createdAt)
                  ) : new Date(),
                title: postData.explanation || 'Untitled Post',
                description: postData.description || postData.explanation || '',
                likes: postData.likes || 0,
                bookmarks: postData.bookmarks || 0,
                comments: postData.comments || 0,
                userId: postData.userId || 'anonymous',
                userName: postData.userName || 'Anonymous',
                userAvatar: null,
                userFollowers: 0,
                genres: postData.genres || [],
                tags: postData.tags || []
              });
              
              if (postData.userId) {
                userIds.add(postData.userId);
              }
            }
          }
        }
        
        let creatorMap = {};
        if (userIds.size > 0) {
          try {
            creatorMap = await getCreatorsBatch(Array.from(userIds));
            logger.log(`Fetched ${Object.keys(creatorMap).length} creators via cache`);
          } catch (cacheError) {
            logger.error('Error fetching creators from cache:', cacheError);
          }
        }
        
        const fetchedPosts = postsData.map(post => {
          const creator = creatorMap[post.userId];
          if (creator) {
            return {
              ...post,
              userName: creator.displayName || creator.username || post.userName,
              userAvatar: creator.photoURL || creator.avatar || post.userAvatar,
              userFollowers: post.userFollowers
            };
          }
          return post;
        });
        
        logger.log('Processed feed posts:', fetchedPosts);
        
        if (fetchedPosts.length > 0) {
          // 新着順にソートしてFirebaseデータで更新
          const sortedPosts = fetchedPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setPosts(sortedPosts);
          logger.log('Firebase data loaded successfully');
        } else {
          // Firebaseにデータがない場合はサンプルデータを使用
          const sortedSamplePosts = samplePosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setPosts(sortedSamplePosts);
          logger.log('No Firebase data, using sample posts');
        }
        
        setLoading(false);
        
      } catch (firebaseError) {
        logger.log('Firebase timeout or error, using sample data:', firebaseError.message);
        // タイムアウトまたはエラーの場合はサンプルデータを使用
        const sortedSamplePosts = samplePosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setPosts(sortedSamplePosts);
        setLoading(false);
      }
      
    } catch (error) {
      logger.error('Error fetching feed posts:', error);
      // エラーが発生した場合はサンプルデータを使用
      setPosts(samplePosts);
      setLoading(false);
    }
  };

  // Load posts when component mounts
  useEffect(() => {
    fetchPosts();
  }, []);

  // コメントをリアルタイムで読み込む
  useEffect(() => {
    if (!posts[currentPostIndex]?.id) return;

    const postId = posts[currentPostIndex].id;
    setLoadingComments(true);
    const commentsRef = collection(db, 'posts', postId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setComments(commentsData);
      setLoadingComments(false);
    }, (error) => {
      logger.error('Error loading comments:', error);
      setLoadingComments(false);
    });

    return () => unsubscribe();
  }, [currentPostIndex, posts]);

  // コメント送信
  const handleSendComment = async () => {
    if (!newComment.trim() || !currentUser || !posts[currentPostIndex]?.id) return;

    try {
      const postId = posts[currentPostIndex].id;
      const commentsRef = collection(db, 'posts', postId, 'comments');
      await addDoc(commentsRef, {
        text: newComment,
        userId: currentUser.uid,
        userName: currentUser.displayName || 'ユーザー',
        userAvatar: currentUser.photoURL || 'https://via.placeholder.com/150',
        createdAt: new Date()
      });

      // コメント数をインクリメント
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        commentCount: increment(1)
      });

      setNewComment('');
      
      // ローカル状態を更新
      setPosts(prevPosts => {
        const updatedPosts = [...prevPosts];
        if (updatedPosts[currentPostIndex]) {
          updatedPosts[currentPostIndex] = {
            ...updatedPosts[currentPostIndex],
            comments: updatedPosts[currentPostIndex].comments + 1
          };
        }
        return updatedPosts;
      });
    } catch (error) {
      logger.error('Error sending comment:', error);
      alert('コメントの送信に失敗しました');
    }
  };

  // Handle video playback when post changes
  useEffect(() => {
    setVideoLoaded(false);
    if (videoRef.current && posts[currentPostIndex]?.type === 'video') {
      logger.log('Playing video:', posts[currentPostIndex].videoUrl);
      videoRef.current.play().catch(e => {
        logger.log('Auto-play failed:', e);
        setIsVideoPlaying(false);
      });
    }
  }, [currentPostIndex, posts]);

  // Handle like toggle with local state and stats
  const handleToggleLike = async (postId, e) => {
    try {
      e.stopPropagation();
      const wasLiked = localLikedPosts.has(postId);
      
      setLocalLikedPosts(prev => {
        const newSet = new Set(prev);
        if (newSet.has(postId)) {
          newSet.delete(postId);
          try {
            updateLikedCount(-1);
          } catch (statsError) {
            logger.warn('Error updating liked count:', statsError);
          }
        } else {
          newSet.add(postId);
          try {
            updateLikedCount(1);
          } catch (statsError) {
            logger.warn('Error updating liked count:', statsError);
          }
        }
        return newSet;
      });
      
      // 非同期でFirebaseにも保存
      toggleLike(postId).catch(error => {
        logger.error('Error toggling like:', error);
        try {
          updateLikedCount(wasLiked ? 1 : -1);
        } catch (statsError) {
          logger.warn('Error reverting liked count:', statsError);
        }
      });
    } catch (error) {
      logger.error('Error in handleToggleLike:', error);
    }
  };

  // Handle bookmark toggle with local state and stats
  const handleToggleBookmark = async (postId, e) => {
    try {
      e.stopPropagation();
      const wasSaved = localSavedPosts.has(postId);
      
      setLocalSavedPosts(prev => {
        const newSet = new Set(prev);
        if (newSet.has(postId)) {
          newSet.delete(postId);
          try {
            updateSavedCount(-1);
          } catch (statsError) {
            logger.warn('Error updating saved count:', statsError);
          }
        } else {
          newSet.add(postId);
          try {
            updateSavedCount(1);
          } catch (statsError) {
            logger.warn('Error updating saved count:', statsError);
          }
        }
        return newSet;
      });
      
      // 非同期でFirebaseにも保存
      toggleSave(postId).catch(error => {
        logger.error('Error toggling save:', error);
        try {
          updateSavedCount(wasSaved ? 1 : -1);
        } catch (statsError) {
          logger.warn('Error reverting saved count:', statsError);
        }
      });
    } catch (error) {
      logger.error('Error in handleToggleBookmark:', error);
    }
  };

  // Handle video play/pause
  const toggleVideoPlayback = () => {
    if (videoRef.current) {
      try {
        if (isVideoPlaying) {
          logger.log('Pausing video');
          videoRef.current.pause();
          setIsVideoPlaying(false);
        } else {
          logger.log('Playing video');
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
            playPromise.then(() => {
              logger.log('Video started playing');
              setIsVideoPlaying(true);
            }).catch(error => {
              logger.log("Playback failed:", error);
              setIsVideoPlaying(false);
            });
          }
        }
      } catch (error) {
        logger.error("Error in toggleVideoPlayback:", error);
        setIsVideoPlaying(false);
      }
    }
  };

  // Handle mute toggle
  const toggleMute = () => {
    if (videoRef.current) {
      try {
        videoRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
      } catch (error) {
        logger.error("Error in toggleMute:", error);
      }
    }
  };

  // Seek bar handlers
  const formatTime = (time) => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeekStart = (e) => {
    e.preventDefault();
    setIsSeeking(true);
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
    }
  };

  const handleSeekMove = (e) => {
    if (!isSeeking || !progressRef.current) return;

    const rect = progressRef.current.getBoundingClientRect();
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const newTime = (clickX / rect.width) * duration;

    setSeekTime(newTime);
  };

  const handleSeekEnd = () => {
    if (!isSeeking) return;

    const video = videoRef.current;
    if (video) {
      video.currentTime = seekTime;
      if (isVideoPlaying) {
        video.play().catch(console.error);
      }
    }

    setIsSeeking(false);
  };

  const handleProgressClick = (e) => {
    if (!videoRef.current || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    videoRef.current.currentTime = newTime;
  };

  // Seek bar drag listeners
  useEffect(() => {
    if (isSeeking) {
      const handleMove = (e) => handleSeekMove(e);
      const handleEnd = () => handleSeekEnd();

      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleMove);
      document.addEventListener('touchend', handleEnd);

      return () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('touchend', handleEnd);
      };
    }
  }, [isSeeking, seekTime, duration, isVideoPlaying]);

  // Auto-play video when post changes
  useEffect(() => {
    if (posts.length > 0 && currentPostIndex < posts.length) {
      setIsVideoPlaying(true);
    }
  }, [currentPostIndex, posts]);

  // Handle navigation
  const handleBottomNavClick = (path) => {
    if (path === 'home') navigate('/');
    else if (path === 'ranking') navigate('/live');
    else if (path === 'account') navigate('/account');
    else navigate('/');
  };

  // Handle post navigation
  const goToNextPost = () => {
    if (currentPostIndex < posts.length - 1 && !isTransitioning) {
      setIsTransitioning(true);
      setCurrentPostIndex(currentPostIndex + 1);
      setTimeout(() => setIsTransitioning(false), 300);
    }
  };

  const goToPreviousPost = () => {
    if (currentPostIndex > 0 && !isTransitioning) {
      setIsTransitioning(true);
      setCurrentPostIndex(currentPostIndex - 1);
      setTimeout(() => setIsTransitioning(false), 300);
    }
  };

  // Touch handlers for swipe
  const handleTouchStart = (e) => {
    setTouchStartY(e.targetTouches[0].clientY);
  };

  const handleTouchMove = (e) => {
    setTouchEndY(e.targetTouches[0].clientY);
  };

  const handleTouchEnd = () => {
    if (!touchStartY || !touchEndY) return;
    
    const distance = touchStartY - touchEndY;
    const isUpSwipe = distance > 50;  // 指を上に動かす
    const isDownSwipe = distance < -50; // 指を下に動かす

    // 上スワイプ（指を上に動かす）→ 画面が下にスクロール → 次の投稿
    // 下スワイプ（指を下に動かす）→ 画面が上にスクロール → 前の投稿
    if (isUpSwipe) {
      goToNextPost();
    } else if (isDownSwipe) {
      goToPreviousPost();
    }
    
    // タッチ位置をリセット
    setTouchStartY(null);
    setTouchEndY(null);
  };

  // Handle video click to navigate to creator profile
  const handleVideoClick = () => {
    try {
      navigate(`/profile/${posts[currentPostIndex].userId}`);
    } catch (error) {
      logger.error('Error navigating to profile:', error);
    }
  };

  // Handle account click to navigate to profile
  const handleAccountClick = (post) => {
    try {
      navigate(`/profile/${post.userId}`);
    } catch (error) {
      logger.error('Error navigating to profile:', error);
    }
  };

  // Handle fullscreen toggle
  const handleFullscreen = async (e) => {
    try {
      e.stopPropagation();
      e.preventDefault();
      
      logger.log('Fullscreen button clicked');
      
      if (!document.fullscreenElement) {
        // Enter fullscreen
        const element = containerRef.current;
        if (element) {
          if (element.requestFullscreen) {
            await element.requestFullscreen();
          } else if (element.webkitRequestFullscreen) {
            await element.webkitRequestFullscreen();
          } else if (element.msRequestFullscreen) {
            await element.msRequestFullscreen();
          }
          setIsFullscreen(true);
          logger.log('Entered fullscreen mode');
        }
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
        setIsFullscreen(false);
        logger.log('Exited fullscreen mode');
      }
    } catch (error) {
      logger.error('Error toggling fullscreen:', error);
    }
  };
  
  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Get Cloudinary optimized URL
  const getOptimizedImageUrl = (originalUrl, width = 400, height = 600) => {
    if (!originalUrl) return null;
    
    if (originalUrl.includes('cloudinary.com')) {
      try {
        const transformedUrl = originalUrl.replace(
          '/upload/',
          `/upload/w_${width},h_${height},c_fill,q_auto,f_auto/`
        );
        return transformedUrl;
      } catch (error) {
        logger.warn('Error transforming Cloudinary URL:', error);
        return originalUrl;
      }
    }
    
    return originalUrl;
  };

  // Loading state
  if (loading) {
    return (
      <div className="relative w-full h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-pink-100 flex items-center justify-center">
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.div 
            className="rounded-full h-16 w-16 border-4 border-pink-500 border-t-transparent mx-auto mb-4"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          ></motion.div>
          <motion.p 
            className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-pink-700 font-bold text-lg"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            コンテンツを読み込み中...
          </motion.p>
        </motion.div>
        <BottomNavigationWithCreator active="feed" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="relative w-full h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-pink-100 flex items-center justify-center">
        <motion.div 
          className="text-center p-6 max-w-md"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.div 
            className="text-6xl mb-4"
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
          >
            ⚠️
          </motion.div>
          <h2 className="text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-pink-800 text-xl font-bold mb-2">
            読み込みエラー
          </h2>
          <p className="text-red-500 mb-4 text-sm break-words font-medium">{error}</p>
          <div className="space-y-2">
            <motion.button 
              onClick={fetchPosts}
              className="w-full px-6 py-3 bg-gradient-to-r from-pink-500 to-pink-700 text-white rounded-full font-bold shadow-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              再試行
            </motion.button>
            <motion.button 
              onClick={() => navigate('/create-post')}
              className="w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-700 text-white rounded-full font-bold shadow-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              投稿を作成
            </motion.button>
          </div>
          <p className="text-gray-500 text-xs mt-4">
            詳細はブラウザのコンソール（F12）をご確認ください
          </p>
        </motion.div>
        <BottomNavigationWithCreator active="feed" />
      </div>
    );
  }

  // No posts state
  if (posts.length === 0) {
    return (
      <div className="relative w-full h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-pink-100 flex items-center justify-center">
        <motion.div 
          className="text-center p-6"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.div 
            className="text-6xl mb-4"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            📷
          </motion.div>
          <p className="text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-pink-800 text-lg font-bold mb-4">
            コンテンツがありません
          </p>
          <motion.button 
            onClick={() => navigate('/create-post')}
            className="px-6 py-3 bg-gradient-to-r from-pink-500 to-pink-700 text-white rounded-full font-bold shadow-lg"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            最初の投稿を作成
          </motion.button>
        </motion.div>
        <BottomNavigationWithCreator active="feed" />
      </div>
    );
  }

  // 投稿がない場合の処理
  if (!posts || posts.length === 0) {
    return (
      <div className="relative w-full h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-pink-100 flex items-center justify-center">
        <motion.div 
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-pink-800 text-lg font-bold mb-4">
            投稿がありません
          </p>
          <p className="text-gray-600 text-sm">新しい投稿をお待ちください</p>
        </motion.div>
        <BottomNavigationWithCreator active="feed" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-screen bg-black overflow-hidden">
      {/* Top Navigation */}
      <motion.div 
        className="absolute top-0 left-0 right-0 z-20 p-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center justify-end">
          <div className="flex items-center space-x-3">
            <motion.button 
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.1 }}
              onClick={(e) => {
                e.stopPropagation();
                try {
                  const postUrl = `${window.location.origin}/posts/${posts[currentPostIndex]?.id}`;
                  const shareText = `${posts[currentPostIndex]?.title}\n${postUrl}`;
                  
                  if (navigator.share) {
                    navigator.share({
                      title: posts[currentPostIndex]?.title,
                      text: posts[currentPostIndex]?.description,
                      url: postUrl
                    }).then(() => {
                      logger.log('Successfully shared');
                    }).catch(error => {
                      logger.log('Error sharing:', error);
                    });
                  } else {
                    navigator.clipboard.writeText(postUrl).then(() => {
                      logger.log('URL copied to clipboard');
                    }).catch(error => {
                      logger.log('Error copying to clipboard:', error);
                    });
                  }
                } catch (error) {
                  logger.error('Error in share action:', error);
                }
              }}
              className="cursor-pointer"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              data-testid="button-share"
            >
              <Share size={24} className="text-white" strokeWidth={2} />
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.1 }}
              onClick={(e) => {
                e.stopPropagation();
                try {
                  logger.log('More options clicked');
                  // Show options: Report, Not Interested, Block, etc.
                  const options = ['通報する', '興味なし', 'このユーザーをブロック', 'キャンセル'];
                  const selectedOption = confirm('投稿オプション\n\n1. 通報する\n2. 興味なし\n3. このユーザーをブロック\n4. キャンセル');
                  if (selectedOption) {
                    logger.log('Option selected');
                  }
                } catch (error) {
                  logger.error('Error in more options action:', error);
                }
              }}
              className="cursor-pointer"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              data-testid="button-more-options"
            >
              <MoreHorizontal size={24} className="text-white" strokeWidth={2} />
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div 
        className="w-full h-full relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >

        {/* Current Post */}
        {posts[currentPostIndex] && (
          <motion.div 
            className="absolute inset-0"
            key={currentPostIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Background Video/Image */}
            <div className="absolute inset-0">
              {posts[currentPostIndex].type === 'video' ? (
                <>
                  <video
                    ref={videoRef}
                    src={posts[currentPostIndex].videoUrl}
                    poster={posts[currentPostIndex].thumbnail || posts[currentPostIndex].imageUrl}
                    className={`w-full h-full ${isVerticalVideo ? 'object-cover' : 'object-contain'}`}
                    playsInline
                    loop
                    muted={isMuted}
                    autoPlay
                    preload="auto"
                    onLoadedMetadata={(e) => {
                      const video = e.target;
                      setIsVerticalVideo(video.videoHeight > video.videoWidth);
                      setDuration(video.duration);
                    }}
                    onTimeUpdate={(e) => {
                      if (!isSeeking) {
                        setCurrentTime(e.target.currentTime);
                      }
                    }}
                    onLoadedData={() => {
                      setVideoLoaded(true);
                    }}
                    onError={(e) => {
                      logger.error('Video error:', e);
                      setVideoLoaded(true);
                      e.target.style.display = 'none';
                    }}
                  />
                  {!videoLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full"
                      />
                    </div>
                  )}
                </>
              ) : (
                <img
                  src={posts[currentPostIndex].thumbnail || posts[currentPostIndex].imageUrl}
                  alt={posts[currentPostIndex].title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    logger.error('Image load error:', e);
                    e.target.src = '/logo192.png';
                  }}
                />
              )}
            </div>

            {/* Center Play Button for videos */}
            {posts[currentPostIndex].type === 'video' && !isVideoPlaying && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute inset-0 flex items-center justify-center z-10"
              >
                <button
                  onClick={toggleVideoPlayback}
                  className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center"
                >
                  <Play size={32} className="text-white ml-1" />
                </button>
              </motion.div>
            )}

            {/* Right Side Actions */}
            <div className="absolute right-4 bottom-40 z-30 flex flex-col items-center space-y-5">
              {/* Swipe Indicator */}
              <motion.div 
                className="flex flex-col items-center cursor-pointer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.1 }}
                onClick={() => {
                  logger.log('Swipe indicator clicked');
                  goToNextPost();
                }}
                data-testid="button-swipe-next"
              >
                <motion.div 
                  className="flex flex-col items-center"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <ChevronDown size={28} className="text-white" strokeWidth={1.5} />
                  <span className="text-white text-[11px] font-medium mt-0.5">Swipe</span>
                </motion.div>
              </motion.div>

              {/* Creator Profile */}
              <motion.div 
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.1 }}
                onClick={() => handleAccountClick(posts[currentPostIndex])}
                className="cursor-pointer relative"
                data-testid="button-creator-profile"
              >
                {posts[currentPostIndex].userAvatar ? (
                  <motion.img
                    src={posts[currentPostIndex].userAvatar}
                    alt={posts[currentPostIndex].userName}
                    className="w-12 h-12 rounded-full border-2 border-white shadow-lg object-cover"
                    animate={{ 
                      boxShadow: [
                        "0 0 0 0 rgba(255, 255, 255, 0.4)",
                        "0 0 0 8px rgba(255, 255, 255, 0)",
                        "0 0 0 0 rgba(255, 255, 255, 0)"
                      ]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                ) : (
                  <motion.div
                    className="w-12 h-12 rounded-full border-2 border-white shadow-lg bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center"
                    animate={{ 
                      boxShadow: [
                        "0 0 0 0 rgba(255, 255, 255, 0.4)",
                        "0 0 0 8px rgba(255, 255, 255, 0)",
                        "0 0 0 0 rgba(255, 255, 255, 0)"
                      ]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <User className="w-6 h-6 text-white" />
                  </motion.div>
                )}
                <motion.div 
                  className="absolute -bottom-1 -right-1 w-5 h-5 bg-gradient-to-br from-pink-400 to-pink-600 rounded-full flex items-center justify-center shadow-lg"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <span className="text-white text-[11px] font-bold">+</span>
                </motion.div>
              </motion.div>

              {/* Like Button */}
              <motion.div
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.15 }}
                onClick={(e) => handleToggleLike(posts[currentPostIndex].id, e)}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                className="flex flex-col items-center cursor-pointer"
                data-testid="button-like"
              >
                <motion.div
                  animate={localLikedPosts.has(posts[currentPostIndex].id) ? {
                    scale: [1, 1.3, 1],
                    rotate: [0, -15, 15, 0]
                  } : {
                    y: [0, -2, 0]
                  }}
                  transition={localLikedPosts.has(posts[currentPostIndex].id) ? 
                    { duration: 0.5 } : 
                    { duration: 2, repeat: Infinity, ease: "easeInOut" }
                  }
                >
                  <Heart
                    size={32}
                    className={`${localLikedPosts.has(posts[currentPostIndex].id) ? 'text-pink-500 fill-pink-500' : 'text-white'}`}
                    strokeWidth={1.5}
                  />
                </motion.div>
                <motion.span 
                  className="text-white text-xs font-semibold mt-0.5"
                  key={posts[currentPostIndex].likes}
                  initial={{ scale: 1.2, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  data-testid="count-likes"
                >
                  {posts[currentPostIndex].likes}
                </motion.span>
              </motion.div>

              {/* Bookmark Button */}
              <motion.div
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.15 }}
                onClick={(e) => handleToggleBookmark(posts[currentPostIndex].id, e)}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                className="flex flex-col items-center cursor-pointer"
                data-testid="button-bookmark"
              >
                <motion.div
                  animate={localSavedPosts.has(posts[currentPostIndex].id) ? {
                    scale: [1, 1.3, 1],
                    rotate: [0, -15, 15, 0]
                  } : {
                    y: [0, -2, 0]
                  }}
                  transition={localSavedPosts.has(posts[currentPostIndex].id) ? 
                    { duration: 0.5 } : 
                    { duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }
                  }
                >
                  <Bookmark
                    size={32}
                    className={`${localSavedPosts.has(posts[currentPostIndex].id) ? 'text-pink-500 fill-pink-500' : 'text-white'}`}
                    strokeWidth={1.5}
                  />
                </motion.div>
                <motion.span 
                  className="text-white text-xs font-semibold mt-0.5"
                  key={posts[currentPostIndex].bookmarks}
                  initial={{ scale: 1.2, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  data-testid="count-bookmarks"
                >
                  {posts[currentPostIndex].bookmarks}
                </motion.span>
              </motion.div>

              {/* Comment Button */}
              <motion.div
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.15 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCommentModal(true);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                className="flex flex-col items-center cursor-pointer"
                data-testid="button-comment"
              >
                <motion.div
                  animate={{ y: [0, -2, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
                >
                  <MessageCircle size={32} className="text-white" strokeWidth={1.5} />
                </motion.div>
                <span className="text-white text-xs font-semibold mt-0.5" data-testid="count-comments">{posts[currentPostIndex].comments}</span>
              </motion.div>

              {/* Mute Button for videos */}
              {posts[currentPostIndex].type === 'video' && (
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ scale: 1.15 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMute();
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  className="flex flex-col items-center cursor-pointer"
                  data-testid="button-mute"
                >
                  <motion.div
                    animate={{ y: [0, -2, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.9 }}
                  >
                    {isMuted ? (
                      <VolumeX size={32} className="text-white" strokeWidth={1.5} />
                    ) : (
                      <Volume2 size={32} className="text-white" strokeWidth={1.5} />
                    )}
                  </motion.div>
                </motion.div>
              )}

              {/* Fullscreen Button */}
              <motion.div
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.15 }}
                onClick={handleFullscreen}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                className="flex flex-col items-center cursor-pointer"
                data-testid="button-fullscreen"
              >
                <motion.div 
                  animate={{ y: [0, -2, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
                >
                  {isFullscreen ? (
                    <Minimize size={32} className="text-white" strokeWidth={1.5} />
                  ) : (
                    <Maximize size={32} className="text-white" strokeWidth={1.5} />
                  )}
                </motion.div>
              </motion.div>
            </div>

            {/* Bottom Content */}
            <motion.div 
              className="absolute bottom-32 left-0 right-0 z-20 p-4 pb-4"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              {/* Watch Main Video Button */}
              <motion.div 
                className="mb-3 flex"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
              >
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={handleVideoClick}
                  className="bg-gradient-to-r from-pink-500 to-pink-600 text-white py-2.5 px-4 rounded-lg flex items-center shadow-lg"
                  data-testid="button-watch-main-video"
                >
                  <Film size={16} className="mr-1.5" strokeWidth={2.5} />
                  <span className="font-bold text-xs">本編を視聴する</span>
                  <ChevronDown size={14} className="ml-1 rotate-[-90deg]" strokeWidth={2.5} />
                </motion.button>
              </motion.div>

              {/* Video Title */}
              <motion.div 
                className="text-white text-sm font-bold mb-1.5 text-left"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                data-testid="video-title"
              >
                {posts[currentPostIndex]?.title || 'タイトル'}
              </motion.div>

              {/* Video Description */}
              <motion.div 
                className="text-white/90 text-xs mb-2 line-clamp-2 text-left"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.4 }}
                data-testid="video-description"
              >
                {posts[currentPostIndex]?.description || '説明'}
              </motion.div>

              {/* Tags */}
              <motion.div 
                className="flex flex-wrap gap-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                {(() => {
                  const tags = Array.isArray(posts[currentPostIndex]?.tags) ? posts[currentPostIndex].tags :
                             Array.isArray(posts[currentPostIndex]?.genres) ? posts[currentPostIndex].genres :
                             typeof posts[currentPostIndex]?.tags === 'string' && posts[currentPostIndex].tags ? [posts[currentPostIndex].tags] :
                             [];
                  return tags.map((tag, index) => (
                    <motion.span
                      key={tag}
                      className="px-2 py-0.5 bg-white/20 backdrop-blur-sm text-white text-[10px] rounded border border-white/30"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.6 + index * 0.1 }}
                      whileTap={{ scale: 0.95 }}
                      data-testid={`tag-${tag}`}
                    >
                      {tag}
                    </motion.span>
                  ));
                })()}
              </motion.div>
            </motion.div>
          </motion.div>
        )}


      </div>

      {/* Seek Bar - Above Bottom Navigation */}
      {posts[currentPostIndex]?.type === 'video' && duration > 0 && (
        <motion.div 
          className="fixed bottom-20 left-0 right-0 z-30 px-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="bg-black/60 backdrop-blur-sm rounded-2xl p-3">
            {/* Progress Bar with Draggable Thumb */}
            <div 
              ref={progressRef}
              className="relative w-full h-2 bg-white/20 rounded-full cursor-pointer group/progress mb-2"
              onClick={handleProgressClick}
            >
              {/* Progress Fill */}
              <div 
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-pink-500 to-purple-600 rounded-full transition-all"
                style={{ width: `${((isSeeking ? seekTime : currentTime) / duration) * 100}%` }}
              />
              
              {/* Draggable Thumb */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full cursor-grab active:cursor-grabbing transform transition-all group-hover/progress:scale-125 hover:scale-150"
                style={{ 
                  left: `${((isSeeking ? seekTime : currentTime) / duration) * 100}%`,
                  marginLeft: '-8px'
                }}
                onMouseDown={handleSeekStart}
                onTouchStart={handleSeekStart}
              >
                {/* Inner gradient */}
                <div className="absolute inset-0.5 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full" />
              </div>

              {/* Time tooltip on seeking */}
              {isSeeking && (
                <div 
                  className="absolute -top-10 bg-black/80 text-white text-xs px-2 py-1 rounded backdrop-blur-sm"
                  style={{ 
                    left: `${(seekTime / duration) * 100}%`,
                    transform: 'translateX(-50%)'
                  }}
                >
                  {formatTime(seekTime)}
                </div>
              )}
            </div>

            {/* Time Display */}
            <div className="flex items-center justify-between text-white text-xs">
              <span className="font-medium">{formatTime(currentTime)}</span>
              <span className="text-white/60">{formatTime(duration)}</span>
            </div>
          </div>
        </motion.div>
      )}

      <BottomNavigationWithCreator active="feed" onNavClick={handleBottomNavClick} />

      {/* Comment Modal */}
      <AnimatePresence>
        {showCommentModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end bg-black/50"
            onClick={() => setShowCommentModal(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full bg-white dark:bg-gray-900 rounded-t-3xl max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                <h3 className="text-lg font-bold dark:text-gray-100">コメント {comments.length}</h3>
                <button
                  onClick={() => setShowCommentModal(false)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  data-testid="button-close-comments"
                >
                  <MoreHorizontal size={24} className="rotate-90" />
                </button>
              </div>

              {/* Comments List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingComments ? (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-8">読み込み中...</div>
                ) : comments.length === 0 ? (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                    まだコメントがありません<br />最初のコメントを投稿しましょう！
                  </div>
                ) : (
                  comments.map((comment) => (
                    <motion.div
                      key={comment.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex space-x-3"
                      data-testid={`comment-${comment.id}`}
                    >
                      <img
                        src={comment.userAvatar}
                        alt={comment.userName}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-sm dark:text-gray-200">{comment.userName}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {comment.createdAt && new Date(comment.createdAt.seconds * 1000).toLocaleDateString('ja-JP')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800 dark:text-gray-300 mt-1">{comment.text}</p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Comment Input */}
              {currentUser ? (
                <div className="p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-900">
                  <div className="flex space-x-3">
                    <img
                      src={currentUser.photoURL || 'https://via.placeholder.com/150'}
                      alt={currentUser.displayName || 'You'}
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                    />
                    <div className="flex-1 flex space-x-2">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && newComment.trim()) {
                            handleSendComment();
                          }
                        }}
                        placeholder="コメントを入力..."
                        className="flex-1 px-4 py-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-pink-500"
                        data-testid="input-comment"
                      />
                      <button
                        onClick={handleSendComment}
                        disabled={!newComment.trim()}
                        className="bg-gradient-to-r from-pink-500 to-pink-600 text-white px-6 py-2 rounded-full font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        data-testid="button-send-comment"
                      >
                        送信
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center">
                  <p className="text-gray-600 dark:text-gray-400 text-sm">コメントするにはログインしてください</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SocialFeedScreen;