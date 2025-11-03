import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { 
    ArrowLeft, 
    Share2, 
    Heart, 
    MessageCircle, 
    Play, 
    Filter, 
    ChevronDown,
    Edit3,
    CheckCircle,
    Star,
    Video,
    Image,
    Eye,
    EyeOff,
    UserPlus,
    UserMinus,
    Users,
    Copy,
    ExternalLink,
    Sparkles,
    X,
    Trash2,
    Globe,
    Twitter,
    Instagram,
    Youtube,
    Lock
} from 'lucide-react';
import BottomNavigationWithCreator from '../BottomNavigationWithCreator';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, increment, arrayUnion, arrayRemove, deleteDoc, orderBy, limit, addDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { canAccessContent, getExclusiveLabel } from '../../utils/planAccess';

// Initialize Stripe - only if public key is configured
const stripePromise = import.meta.env.VITE_STRIPE_PUBLIC_KEY 
    ? loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY)
    : null;

// Payment Form Component
const PaymentForm = ({ plan, onSuccess, onCancel }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [errorMessage, setErrorMessage] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setIsProcessing(true);
        setErrorMessage('');

        try {
            const { error: submitError } = await elements.submit();
            if (submitError) {
                setErrorMessage(submitError.message || '決済情報の確認に失敗しました');
                setIsProcessing(false);
                return;
            }

            console.log('💳 決済処理を開始します...');
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: `${window.location.origin}/profile/${plan.creatorId}?subscription=success&plan=${plan.id}`,
                },
                redirect: 'if_required',
            });

            if (error) {
                console.error('❌ 決済エラー:', error);
                setErrorMessage(error.message || '決済に失敗しました');
                setIsProcessing(false);
            } else if (paymentIntent && paymentIntent.status === 'succeeded') {
                // Payment successful
                console.log('✅ 決済成功！ PaymentIntent:', paymentIntent.id);
                onSuccess();
            } else {
                console.warn('⚠️ 決済ステータス:', paymentIntent?.status);
                setErrorMessage('決済の処理中です。しばらくお待ちください。');
                setIsProcessing(false);
            }
        } catch (err) {
            console.error('Payment error:', err);
            setErrorMessage('決済処理中にエラーが発生しました');
            setIsProcessing(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <PaymentElement />
            {errorMessage && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {errorMessage}
                </div>
            )}
            <div className="flex space-x-3">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isProcessing}
                    className="flex-1 bg-gray-200 text-gray-700 py-4 rounded-xl font-bold disabled:opacity-50"
                >
                    キャンセル
                </button>
                <button
                    type="submit"
                    disabled={!stripe || isProcessing}
                    className="flex-1 bg-gradient-to-r from-pink-500 to-pink-600 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50"
                >
                    {isProcessing ? '処理中...' : `¥${plan.total.toLocaleString()}を支払う`}
                </button>
            </div>
        </form>
    );
};

const ProfilePage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState('posts');
    const [showRankings, setShowRankings] = useState(true);
    const [showAllPlans, setShowAllPlans] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState('all');
    const [isFollowing, setIsFollowing] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showPlanModal, setShowPlanModal] = useState(null);
    const [clientSecret, setClientSecret] = useState('');
    const [contentData, setContentData] = useState([]);
    const [profileData, setProfileData] = useState(null);
    const [subscriptionPlans, setSubscriptionPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userPosts, setUserPosts] = useState([]);
    const [userNotFound, setUserNotFound] = useState(false);
    const [videoDurations, setVideoDurations] = useState({});
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [userPlanLevel, setUserPlanLevel] = useState(null);
    
    // Format duration to mm:ss
    const formatDuration = (seconds) => {
        if (!seconds || isNaN(seconds)) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    
    // Handle video metadata loaded
    const handleVideoMetadata = (e, contentId) => {
        const duration = e.target.duration;
        if (duration && !isNaN(duration)) {
            setVideoDurations(prev => ({
                ...prev,
                [contentId]: formatDuration(duration)
            }));
        }
    };

    // Check for subscription status from URL params
    useEffect(() => {
        const processPaymentSuccess = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const subscriptionStatus = urlParams.get('subscription');
            const planId = urlParams.get('plan');

            if (subscriptionStatus === 'success' && planId && profileData && currentUser && subscriptionPlans.length > 0) {
                console.log('🔄 リダイレクト後の決済成功処理を開始...', { planId, profileId: profileData.id });
                
                // Clean up URL first
                window.history.replaceState({}, document.title, window.location.pathname);

                // Find the plan
                const plan = subscriptionPlans.find(p => p.id === planId);
                if (!plan) {
                    console.error('プランが見つかりません:', planId);
                    alert('決済は完了しましたが、プラン情報の取得に失敗しました。サポートにお問い合わせください。');
                    return;
                }

                // Process payment success with the plan info
                try {
                    // プランの価格を解析（カンマを除去してから数値化）
                    // plan.priceはクリエイター受取額（basePrice）
                    const priceStr = String(plan.price || '0');
                    const priceMatch = priceStr.match(/[\d,]+/);
                    if (!priceMatch) {
                        console.error('価格の解析に失敗しました');
                        return;
                    }
                    const basePrice = parseInt(priceMatch[0].replace(/,/g, '')); // クリエイター受取額（例：50円）
                    
                    // ユーザー支払い総額を計算
                    // totalAmount = basePrice + platformFee + tax
                    // totalAmount = basePrice + (basePrice * 0.1) + (basePrice * 0.1)
                    // totalAmount = basePrice * 1.2
                    const platformFee = Math.floor(basePrice * 0.10); // 10% プラットフォーム手数料（例：5円）
                    const tax = Math.floor(basePrice * 0.10); // 10% 消費税（例：5円）
                    const totalAmount = basePrice + platformFee + tax; // ユーザー支払い総額（例：60円）
                    const creatorAmount = basePrice; // クリエイターが受け取る金額（例：50円）

                    // 1. 購入履歴を保存
                    await addDoc(collection(db, 'purchases'), {
                        userId: currentUser.uid,
                        creatorId: profileData.id,
                        creatorName: profileData.name,
                        planId: plan.id,
                        planTitle: plan.title,
                        amount: totalAmount,
                        creatorAmount: creatorAmount,
                        platformFee: platformFee,
                        tax: tax,
                        currency: 'JPY',
                        status: 'completed',
                        paymentMethod: 'stripe',
                        type: 'subscription',
                        createdAt: serverTimestamp()
                    });

                    // 2. クリエイターの残高を更新
                    const creatorRef = doc(db, 'users', profileData.id);
                    await updateDoc(creatorRef, {
                        availableBalance: increment(creatorAmount),
                        totalEarnings: increment(creatorAmount)
                    });

                    // プランIDからplanLevelを決定
                    let planLevel = plan.planLevel;
                    if (!planLevel) {
                        if (plan.id.toLowerCase().includes('vip')) {
                            planLevel = 3;
                        } else if (plan.id.toLowerCase().includes('premium')) {
                            planLevel = 2;
                        } else {
                            planLevel = 1; // basic
                        }
                    }

                    // 3. サブスクリプション情報を保存
                    await setDoc(doc(db, 'users', currentUser.uid, 'subscriptions', profileData.id), {
                        creatorId: profileData.id,
                        creatorName: profileData.name,
                        planId: plan.id,
                        planTitle: plan.title,
                        planLevel: planLevel,
                        price: basePrice,
                        status: 'active',
                        startDate: serverTimestamp(),
                        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30日後
                    });

                    // 購入者の名前を取得
                    const buyerDoc = await getDoc(doc(db, 'users', currentUser.uid));
                    const buyerName = buyerDoc.exists() ? buyerDoc.data().name || buyerDoc.data().displayName || currentUser.email : currentUser.email;

                    // 4. トランザクション記録を保存（Admin用）
                    await addDoc(collection(db, 'transactions'), {
                        type: 'subscription',
                        userId: currentUser.uid,
                        userName: buyerName,
                        creatorId: profileData.id,
                        creatorName: profileData.name,
                        amount: totalAmount,
                        creatorAmount: creatorAmount,
                        platformFee: platformFee,
                        tax: tax,
                        status: 'completed',
                        description: `サブスクリプション購入: ${plan.title}`,
                        paymentMethod: 'stripe',
                        sourcePage: 'プロフィールページ', // 購入元ページを記録
                        createdAt: serverTimestamp()
                    });

                    console.log('✅ リダイレクト後の決済処理完了:', {
                        totalAmount,
                        creatorAmount,
                        platformFee,
                        tax
                    });

                    alert('決済が完了しました！サブスクリプションが有効になりました。');
                    window.location.reload();
                } catch (error) {
                    console.error('決済後の処理に失敗しました:', error);
                    alert('決済は完了しましたが、データの保存に失敗しました。カスタマーサポートにお問い合わせください。');
                }
                
            } else if (subscriptionStatus === 'cancelled') {
                alert('決済がキャンセルされました。');
                // Clean up URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        };

        processPaymentSuccess();
    }, [profileData, subscriptionPlans]);

    // Firestore からユーザーデータを取得
    useEffect(() => {
        const fetchUserData = async () => {
            if (!id && !currentUser) return;
            
            const userId = id || currentUser?.uid;
            setLoading(true);

            try {
                // ユーザードキュメントを取得
                const userDocRef = doc(db, 'users', userId);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    
                    // 実際の投稿数を取得
                    const postsQuery = query(
                        collection(db, 'posts'),
                        where('userId', '==', userId)
                    );
                    const postsSnapshot = await getDocs(postsQuery);
                    const actualPostsCount = postsSnapshot.size;
                    
                    // 実際のいいね数を計算（全投稿のlikesの合計）
                    let actualLikesCount = 0;
                    postsSnapshot.forEach(doc => {
                        const postData = doc.data();
                        const likes = postData.likes;
                        // likesが配列の場合は長さ、数値の場合はそのまま、undefinedの場合は0
                        if (Array.isArray(likes)) {
                            actualLikesCount += likes.length;
                        } else if (typeof likes === 'number') {
                            actualLikesCount += likes;
                        }
                    });
                    
                    // 実際のフォロワー数とフォロー中数を取得
                    const followers = userData.followers || [];
                    const following = userData.following || [];
                    const actualFollowersCount = followers.length;
                    const actualFollowingCount = following.length;
                    
                    setProfileData({
                        id: userId,
                        name: userData.displayName || userData.name || 'ユーザー',
                        emoji: userData.emoji || '',
                        username: userData.username || `@user${userId.slice(0, 6)}`,
                        bio: userData.bio || '',
                        website: userData.website || '',
                        twitter: userData.twitter || '',
                        instagram: userData.instagram || '',
                        youtube: userData.youtube || '',
                        avatar: userData.photoURL || userData.avatar || 'https://via.placeholder.com/150',
                        coverImage: userData.coverImage || '/images/sample-1.png',
                        isVerified: userData.isVerified || false,
                        stats: {
                            posts: actualPostsCount,
                            likes: actualLikesCount,
                            followers: actualFollowersCount,
                            following: actualFollowingCount
                        },
                        genreRankings: userData.genreRankings || [],
                        subscriptionPlans: userData.subscriptionPlans || []
                    });

                    setSubscriptionPlans(userData.subscriptionPlans || []);
                    
                    // フォロー状態とサブスクリプション状態を確認
                    if (currentUser && currentUser.uid !== userId) {
                        const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid));
                        if (currentUserDoc.exists()) {
                            const currentUserData = currentUserDoc.data();
                            const currentUserFollowing = currentUserData.following || [];
                            setIsFollowing(currentUserFollowing.includes(userId));
                            
                            // サブスクリプション状態とプランレベルを確認
                            const subscriptions = currentUserData.subscriptions || [];
                            const userSubscription = subscriptions.find(sub => sub.creatorId === userId);
                            
                            if (userSubscription) {
                                setIsSubscribed(true);
                                // プランレベルを設定（planLevel フィールドから取得）
                                setUserPlanLevel(userSubscription.planLevel || 'basic');
                                console.log('🔑 User subscription plan level:', userSubscription.planLevel || 'basic');
                            } else {
                                setIsSubscribed(false);
                                setUserPlanLevel(null);
                            }
                        }
                    } else if (currentUser && currentUser.uid === userId) {
                        // 自分のプロフィールの場合は全てのコンテンツにアクセス可能
                        setIsSubscribed(true);
                        setUserPlanLevel('vip'); // 最高レベルとして扱う
                    }
                } else {
                    // ユーザーが見つからない場合はデフォルトデータ
                    setProfileData({
                        id: userId,
                        name: 'ユーザー',
                        emoji: '',
                        username: '@user',
                        bio: '',
                        avatar: 'https://via.placeholder.com/150',
                        coverImage: '/images/sample-1.png',
                        isVerified: false,
                        stats: {
                            posts: 0,
                            likes: 0,
                            followers: 0,
                            following: 0
                        },
                        genreRankings: [],
                        subscriptionPlans: []
                    });
                }

                // ユーザーの投稿を取得（エラーが発生しても処理を継続）
                try {
                    await fetchUserPosts(userId);
                } catch (postError) {
                    console.error('Error in fetchUserPosts:', postError);
                }

            } catch (error) {
                console.error('Error fetching user data:', error);
                // Firestoreエラーの場合でもデフォルトデータを設定
                setUserNotFound(true);
                setProfileData({
                    id: userId,
                    name: 'ユーザー',
                    emoji: '',
                    username: '@user',
                    bio: 'このユーザーは存在しないか、データの取得に失敗しました。',
                    avatar: 'https://via.placeholder.com/150',
                    coverImage: '/images/sample-1.png',
                    isVerified: false,
                    stats: {
                        posts: 0,
                        likes: 0,
                        followers: 0,
                        following: 0
                    },
                    genreRankings: [],
                    subscriptionPlans: []
                });
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [id, currentUser]);

    // Convert Object Storage URL to proxy URL
    const convertToProxyUrl = (url) => {
        if (!url) return url;
        
        // Skip conversion if already a proxy URL
        if (url.startsWith('/api/proxy/')) {
            return url;
        }
        
        // Handle /objects/ paths (old format)
        if (url.startsWith('/objects/')) {
            // Extract filename: /objects/filename.mp4 → filename.mp4
            const filename = url.replace('/objects/', '');
            // Default to public folder
            return `/api/proxy/public/${filename}`;
        }
        
        // Handle Object Storage URLs
        if (url.includes('storage.googleapis.com') && url.includes('replit-objstore')) {
            // Extract the path after the bucket name
            // Format: https://storage.googleapis.com/bucket-name/folder/filename
            const match = url.match(/replit-objstore-[^/]+\/(.+)$/);
            if (match) {
                const path = match[1]; // e.g., "public/xxx.mp4" or ".private/xxx.mp4"
                return `/api/proxy/${path}`;
            }
        }
        
        // Return original URL if not Object Storage
        return url;
    };

    // ユーザーの投稿を取得
    const fetchUserPosts = async (userId) => {
        try {
            // Firestoreから投稿を取得
            // Note: orderByを削除してインデックス不要にし、クライアント側でソート
            const postsRef = collection(db, 'posts');
            const q = query(
                postsRef, 
                where('userId', '==', userId)
            );
            const querySnapshot = await getDocs(q);

            const posts = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                
                // filesが存在しない投稿はスキップ
                if (!data.files || data.files.length === 0) {
                    console.log('⚠️ Skipping post without files:', doc.id);
                    return;
                }
                
                const originalUrl = data.files && data.files[0]?.url;
                const proxyUrl = convertToProxyUrl(originalUrl);
                
                console.log('ProfilePage - Original URL:', originalUrl, '→ Proxy URL:', proxyUrl);
                
                posts.push({
                    ...data,
                    id: doc.id,
                    type: data.files && data.files[0]?.type?.startsWith('video') ? 'video' : 'image',
                    thumbnail: proxyUrl,
                    duration: data.duration || '',
                    likes: data.likes || 0,
                    comments: data.comments || 0,
                    isFree: data.isFree || false,
                    isLiked: false,
                    watermark: data.watermark || '',
                    title: data.title || data.explanation,
                    createdAt: data.createdAt
                });
            });

            // クライアント側で作成日時の降順にソート（新しい投稿が上）
            posts.sort((a, b) => {
                const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                return bTime - aTime;
            });
            
            // 最新50件に制限
            const limitedPosts = posts.slice(0, 50);
            
            console.log('📋 Posts array:', limitedPosts.map(p => ({ id: p.id, thumbnail: p.thumbnail })));
            
            setUserPosts(limitedPosts);
            setContentData(limitedPosts);
        } catch (error) {
            console.error('Error fetching user posts:', error);
            // エラー時は空の配列を設定
            setUserPosts([]);
            setContentData([]);
        }
    };

    const handleShare = async () => {
        if (!profileData) return;

        const shareData = {
            title: `${profileData.name}のプロフィール`,
            text: `${profileData.name}のOnlyUプロフィールをチェック！`,
            url: window.location.href
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(shareData.url);
                alert('プロフィールURLをクリップボードにコピーしました！');
            }
        } catch (error) {
            console.error('シェアに失敗しました:', error);
            setShowShareModal(true);
        }
    };

    const handleFollow = async () => {
        if (!currentUser || !profileData) return;

        try {
            const currentUserRef = doc(db, 'users', currentUser.uid);
            const targetUserRef = doc(db, 'users', profileData.id);

            if (isFollowing) {
                // フォロー解除
                await updateDoc(currentUserRef, {
                    following: arrayRemove(profileData.id),
                    followingCount: increment(-1)
                });
                await updateDoc(targetUserRef, {
                    followers: arrayRemove(currentUser.uid),
                    followersCount: increment(-1)
                });
                setIsFollowing(false);
                alert(`${profileData.name}のフォローを解除しました。`);
            } else {
                // フォロー
                await updateDoc(currentUserRef, {
                    following: arrayUnion(profileData.id),
                    followingCount: increment(1)
                });
                await updateDoc(targetUserRef, {
                    followers: arrayUnion(currentUser.uid),
                    followersCount: increment(1)
                });
                setIsFollowing(true);
                alert(`${profileData.name}をフォローしました！`);
            }

            // プロフィールデータを再取得
            const updatedDoc = await getDoc(targetUserRef);
            if (updatedDoc.exists()) {
                const userData = updatedDoc.data();
                setProfileData(prev => ({
                    ...prev,
                    stats: {
                        ...prev.stats,
                        followers: userData.followersCount || 0
                    }
                }));
            }
        } catch (error) {
            console.error('フォロー操作に失敗しました:', error);
            alert('フォロー操作に失敗しました。しばらくしてからお試しください。');
        }
    };

    const handleMessage = () => {
        if (!profileData) return;
        navigate(`/messages?user=${profileData.username}`);
    };

    const handlePlanConfirm = (planId) => {
        if (!currentUser) {
            alert('サブスクリプションに加入するにはログインが必要です。');
            navigate('/login');
            return;
        }
        
        // Show payment modal and prepare payment
        setShowPlanModal(planId);
    };

    // Create Payment Intent when modal opens
    useEffect(() => {
        const preparePayment = async () => {
            if (!showPlanModal || !currentUser || !profileData) return;

            try {
                const plan = subscriptionPlans.find(p => p.id === showPlanModal);
                if (!plan) return;

                const priceStr = String(plan.price || '0');
                const priceMatch = priceStr.match(/\d+/);
                const basePrice = priceMatch ? parseInt(priceMatch[0]) : 0;
                const tax = Math.floor(basePrice * 0.10);
                const platformFee = Math.floor(basePrice * 0.10);
                const totalAmount = basePrice + tax + platformFee;

                // Create Subscription with Payment Intent
                const response = await fetch('/api/create-subscription-payment-intent', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        planId: plan.id,
                        planTitle: plan.title,
                        planPrice: plan.price,
                        creatorId: profileData.id,
                        creatorName: profileData.name,
                        userId: currentUser.uid,
                        userEmail: currentUser.email,
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    const errorMsg = errorData.error || 'Payment Intentの作成に失敗しました';
                    throw new Error(errorMsg);
                }

                const data = await response.json();
                if (!data.clientSecret) {
                    throw new Error('Client Secretが取得できませんでした');
                }
                setClientSecret(data.clientSecret);
            } catch (error) {
                console.error('決済準備エラー:', error);
                alert(error.message || '決済の準備中にエラーが発生しました');
                setShowPlanModal(null);
            }
        };

        preparePayment();
    }, [showPlanModal, currentUser, profileData, subscriptionPlans]);

    const handlePaymentSuccess = async () => {
        if (!currentUser || !profileData || !showPlanModal) return;

        try {
            const plan = subscriptionPlans.find(p => p.id === showPlanModal);
            if (!plan) return;

            // プランの価格を解析（カンマを除去してから数値化）
            // plan.priceはクリエイター受取額（basePrice）
            const priceStr = String(plan.price || '0');
            const priceMatch = priceStr.match(/[\d,]+/);
            if (!priceMatch) return;
            const basePrice = parseInt(priceMatch[0].replace(/,/g, '')); // クリエイター受取額（例：50円）
            
            // ユーザー支払い総額を計算
            // totalAmount = basePrice + platformFee + tax
            // totalAmount = basePrice + (basePrice * 0.1) + (basePrice * 0.1)
            // totalAmount = basePrice * 1.2
            const platformFee = Math.floor(basePrice * 0.10); // 10% プラットフォーム手数料（例：5円）
            const tax = Math.floor(basePrice * 0.10); // 10% 消費税（例：5円）
            const totalAmount = basePrice + platformFee + tax; // ユーザー支払い総額（例：60円）
            const creatorAmount = basePrice; // クリエイターが受け取る金額（例：50円）

            // 1. 購入履歴を保存
            await addDoc(collection(db, 'purchases'), {
                userId: currentUser.uid,
                creatorId: profileData.id,
                creatorName: profileData.name,
                planId: plan.id,
                planTitle: plan.title,
                amount: totalAmount,
                creatorAmount: creatorAmount,
                platformFee: platformFee,
                tax: tax,
                currency: 'JPY',
                status: 'completed',
                paymentMethod: 'stripe',
                type: 'subscription',
                createdAt: serverTimestamp()
            });

            // 2. クリエイターの残高を更新
            const creatorRef = doc(db, 'users', profileData.id);
            await updateDoc(creatorRef, {
                availableBalance: increment(creatorAmount),
                totalEarnings: increment(creatorAmount)
            });

            // プランIDからplanLevelを決定（planLevelフィールドがない場合のフォールバック）
            let planLevel = plan.planLevel;
            if (!planLevel) {
                // planIdからplanLevelを推定
                if (plan.id.toLowerCase().includes('vip')) {
                    planLevel = 3;
                } else if (plan.id.toLowerCase().includes('premium')) {
                    planLevel = 2;
                } else {
                    planLevel = 1; // basic
                }
            }

            // 3. サブスクリプション情報を保存
            await setDoc(doc(db, 'users', currentUser.uid, 'subscriptions', profileData.id), {
                creatorId: profileData.id,
                creatorName: profileData.name,
                planId: plan.id,
                planTitle: plan.title,
                planLevel: planLevel, // planLevelを保存
                price: basePrice,
                status: 'active',
                startDate: serverTimestamp(),
                nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30日後
            });

            // 購入者の名前を取得
            const buyerDoc = await getDoc(doc(db, 'users', currentUser.uid));
            const buyerName = buyerDoc.exists() ? buyerDoc.data().name || buyerDoc.data().displayName || currentUser.email : currentUser.email;

            // 4. トランザクション記録を保存（Admin用）
            await addDoc(collection(db, 'transactions'), {
                type: 'subscription',
                userId: currentUser.uid,
                userName: buyerName,
                creatorId: profileData.id,
                creatorName: profileData.name,
                amount: totalAmount,
                creatorAmount: creatorAmount,
                platformFee: platformFee,
                tax: tax,
                status: 'completed',
                description: `サブスクリプション購入: ${plan.title}`,
                paymentMethod: 'stripe',
                sourcePage: 'プロフィールページ', // 購入元ページを記録
                createdAt: serverTimestamp()
            });

            console.log('✅ Payment success処理完了:', {
                totalAmount,
                creatorAmount,
                platformFee,
                tax
            });

            alert('決済が完了しました！サブスクリプションが有効になりました。');
            setShowPlanModal(null);
            setClientSecret('');
            window.location.reload();
        } catch (error) {
            console.error('決済後の処理に失敗しました:', error);
            alert('決済は完了しましたが、データの保存に失敗しました。カスタマーサポートにお問い合わせください。');
        }
    };

    const handlePaymentCancel = () => {
        setShowPlanModal(null);
        setClientSecret('');
    };

    const handleContentLike = async (contentId) => {
        setContentData(prev => prev.map(item => {
            if (item.id === contentId) {
                return {
                    ...item,
                    isLiked: !item.isLiked,
                    likes: item.isLiked ? item.likes - 1 : item.likes + 1
                };
            }
            return item;
        }));
    };

    const handleContentClick = (contentId) => {
        const content = contentData.find(item => item.id === contentId);
        if (content.type === 'video') {
            navigate(`/video/${contentId}`);
        } else {
            navigate(`/image/${contentId}`);
        }
    };

    const handleEditProfile = () => {
        navigate('/edit-profile');
    };

    const handleFilterChange = (filter) => {
        setSelectedFilter(filter);
        let filteredData = userPosts;
        
        if (filter === 'video') {
            filteredData = userPosts.filter(item => item.type === 'video');
        } else if (filter === 'image') {
            filteredData = userPosts.filter(item => item.type === 'image');
        }
        
        setContentData(filteredData);
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            alert('プロフィールURLをクリップボードにコピーしました！');
            setShowShareModal(false);
        } catch (error) {
            console.error('コピーに失敗しました:', error);
        }
    };

    const handleDeletePost = async (postId, event) => {
        event.stopPropagation();
        
        if (!window.confirm('この投稿を削除してもよろしいですか？')) {
            return;
        }

        try {
            await deleteDoc(doc(db, 'posts', postId));
            
            // Update local state
            setUserPosts(prev => prev.filter(post => post.id !== postId));
            setContentData(prev => prev.filter(post => post.id !== postId));
            
            alert('投稿を削除しました');
        } catch (error) {
            console.error('投稿削除エラー:', error);
            alert('投稿の削除に失敗しました');
        }
    };

    // Calculate total price with tax and platform fee
    const calculateTotalPrice = (basePrice) => {
        const priceMatch = basePrice.match(/\d+/);
        if (!priceMatch) return basePrice;
        
        const price = parseInt(priceMatch[0]);
        const tax = Math.floor(price * 0.10); // 10% tax
        const platformFee = Math.floor(price * 0.10); // 10% platform fee
        const total = price + tax + platformFee;
        
        return `${total.toLocaleString()}円`;
    };

    const displayedPlans = showAllPlans ? subscriptionPlans : subscriptionPlans.slice(0, 3);

    const isOwnProfile = currentUser && profileData && currentUser.uid === profileData.id;

    if (loading || !profileData) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-pink-100 flex items-center justify-center">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full"
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-pink-100 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-pink-500 to-pink-600 text-white sticky top-0 z-20 shadow-lg">
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="p-2 hover:bg-white/20 rounded-full" data-testid="button-back">
                    <ArrowLeft size={20} />
                </motion.button>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleShare} className="p-2 hover:bg-white/20 rounded-full" data-testid="button-share">
                    <Share2 size={20} />
                </motion.button>
            </div>

            {/* Cover Image */}
            <div className="h-56 bg-gradient-to-br from-pink-400 via-pink-500 to-pink-600 relative overflow-hidden">
                <img 
                    src={profileData.coverImage} 
                    alt="Cover" 
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-pink-500/10 to-pink-600/30" />
            </div>

            {/* Profile Info */}
            <div className="px-4 pb-4 -mt-20 relative">
                <div className="flex items-start justify-between mb-4">
                    {/* Avatar with verification - Animated */}
                    <motion.div 
                        className="relative"
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    >
                        <motion.div
                            whileHover={{ scale: 1.1, rotate: [0, -5, 5, -5, 0] }}
                            transition={{ duration: 0.5 }}
                            className="relative"
                        >
                            <motion.div
                                animate={{ 
                                    boxShadow: [
                                        "0 0 20px rgba(236, 72, 153, 0.3)",
                                        "0 0 40px rgba(236, 72, 153, 0.5)",
                                        "0 0 20px rgba(236, 72, 153, 0.3)"
                                    ]
                                }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                className="rounded-full"
                            >
                                <img 
                                    src={profileData.avatar} 
                                    alt={profileData.name} 
                                    className="w-32 h-32 rounded-full border-4 border-white object-cover" 
                                    data-testid="img-avatar" 
                                />
                            </motion.div>
                            {profileData.isVerified && (
                                <motion.div 
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.3, type: "spring", stiffness: 500 }}
                                    className="absolute bottom-0 right-0 z-20"
                                >
                                    <motion.div
                                        animate={{ 
                                            scale: [1, 1.2, 1],
                                            rotate: [0, 360]
                                        }}
                                        transition={{ 
                                            scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                                            rotate: { duration: 20, repeat: Infinity, ease: "linear" }
                                        }}
                                        className="w-8 h-8 bg-gradient-to-br from-pink-400 to-pink-600 text-white rounded-full flex items-center justify-center shadow-lg"
                                        data-testid="verified-badge"
                                    >
                                        <CheckCircle size={20} />
                                    </motion.div>
                                </motion.div>
                            )}
                        </motion.div>
                    </motion.div>

                    {/* Action Buttons */}
                    {isOwnProfile ? (
                        <motion.button 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2, type: "spring" }}
                            whileHover={{ 
                                scale: 1.08,
                                boxShadow: "0 10px 30px rgba(236, 72, 153, 0.4)"
                            }} 
                            whileTap={{ scale: 0.95 }}
                            onClick={handleEditProfile}
                            className="bg-gradient-to-r from-pink-500 to-pink-600 text-white px-6 py-2 rounded-full font-bold shadow-lg mt-16 relative overflow-hidden group"
                            data-testid="button-edit-profile"
                        >
                            <motion.div
                                animate={{
                                    x: ["-100%", "100%"]
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "linear"
                                }}
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                            />
                            <motion.span 
                                className="relative z-10 flex items-center"
                                animate={{ rotate: [0, -10, 10, -10, 0] }}
                                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3 }}
                            >
                                <Edit3 className="w-4 h-4 inline mr-2" />
                                編集
                            </motion.span>
                        </motion.button>
                    ) : (
                        <div className="flex space-x-3 mt-16">
                            <motion.button 
                                whileHover={{ scale: 1.08, y: -2 }} 
                                whileTap={{ scale: 0.92 }}
                                onClick={handleFollow}
                                className={`relative overflow-hidden px-8 py-3 rounded-full font-bold shadow-xl ${
                                    isFollowing 
                                        ? 'bg-white text-pink-600 border-2 border-pink-600' 
                                        : 'bg-gradient-to-r from-pink-500 via-pink-600 to-purple-600 text-white'
                                }`}
                                data-testid="button-follow"
                            >
                                {!isFollowing && (
                                    <motion.div
                                        animate={{
                                            x: ["-100%", "100%"]
                                        }}
                                        transition={{
                                            duration: 2,
                                            repeat: Infinity,
                                            ease: "linear"
                                        }}
                                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                                    />
                                )}
                                <motion.span 
                                    className="relative z-10 flex items-center"
                                    animate={!isFollowing ? { scale: [1, 1.05, 1] } : {}}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                >
                                    {isFollowing ? <UserMinus className="w-5 h-5 mr-2" /> : <UserPlus className="w-5 h-5 mr-2" />}
                                    {isFollowing ? 'フォロー中' : 'フォロー'}
                                </motion.span>
                            </motion.button>
                            <motion.button 
                                whileHover={{ scale: 1.08, y: -2 }} 
                                whileTap={{ scale: 0.92 }}
                                onClick={handleMessage}
                                className="relative overflow-hidden bg-white text-pink-600 border-2 border-pink-600 px-8 py-3 rounded-full font-bold shadow-xl hover:bg-pink-50 transition-colors"
                                data-testid="button-message"
                            >
                                <MessageCircle className="w-5 h-5 inline mr-2" />
                                メッセージ
                            </motion.button>
                        </div>
                    )}
                </div>

                {/* Name Card - Ultra Premium Style */}
                <motion.div 
                    initial={{ opacity: 0, y: 20, scale: 0.95 }} 
                    animate={{ opacity: 1, y: 0, scale: 1 }} 
                    transition={{ delay: 0.3, type: "spring", stiffness: 100 }}
                    className="mb-6 bg-gradient-to-br from-white via-pink-50/30 to-white backdrop-blur-2xl rounded-3xl p-8 shadow-[0_20px_60px_-15px_rgba(236,72,153,0.3)] border-2 border-white/80 relative overflow-hidden group"
                >
                    <motion.div 
                        animate={{ 
                            x: [-100, 100, -100],
                            y: [-50, 50, -50],
                            scale: [1, 1.3, 1]
                        }} 
                        transition={{ duration: 25, repeat: Infinity, ease: "linear" }} 
                        className="absolute -top-32 -right-32 w-64 h-64 bg-gradient-to-br from-pink-300/30 via-purple-300/20 to-pink-400/30 rounded-full blur-3xl" 
                    />
                    <motion.div 
                        animate={{ 
                            x: [100, -100, 100],
                            y: [50, -50, 50],
                            scale: [1.3, 1, 1.3]
                        }} 
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }} 
                        className="absolute -bottom-20 -left-20 w-48 h-48 bg-gradient-to-br from-purple-400/25 to-pink-500/25 rounded-full blur-3xl" 
                    />
                    <div className="relative z-10">
                        <motion.h1 
                            whileHover={{ scale: 1.02 }}
                            className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-pink-500 via-pink-600 to-purple-600 bg-clip-text text-transparent flex items-center drop-shadow-sm" 
                            data-testid="text-profile-name"
                        >
                            {profileData.name} 
                            {profileData.emoji && (
                                <motion.span 
                                    animate={{ rotate: [0, 10, -10, 0] }}
                                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                                    className="ml-2 text-2xl"
                                >
                                    {profileData.emoji}
                                </motion.span>
                            )}
                        </motion.h1>
                    </div>
                </motion.div>

                {/* Stats - Modern 3D Cards */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: 0.4 }} 
                    className="grid grid-cols-4 gap-2.5 sm:gap-3 mb-6"
                >
                    <motion.div 
                        whileHover={{ scale: 1.05, y: -6, rotateX: 5 }} 
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300 }}
                        className="bg-gradient-to-br from-white to-pink-50/50 backdrop-blur-xl rounded-2xl p-3 sm:p-4 text-center shadow-[0_8px_30px_-6px_rgba(236,72,153,0.25)] border-2 border-white relative overflow-hidden group"
                        style={{ transformStyle: "preserve-3d" }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-pink-400/15 to-pink-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <motion.div 
                            className="absolute top-1 right-1 w-8 h-8 bg-pink-100/80 rounded-full flex items-center justify-center"
                            whileHover={{ rotate: 360 }}
                            transition={{ duration: 0.6 }}
                        >
                            <Image className="w-4 h-4 text-pink-500" />
                        </motion.div>
                        <div className="relative z-10 pt-4">
                            <motion.div 
                                className="font-black text-2xl sm:text-3xl bg-gradient-to-br from-pink-500 to-pink-600 bg-clip-text text-transparent drop-shadow-sm" 
                                data-testid="text-posts-count"
                            >
                                {profileData.stats.posts}
                            </motion.div>
                            <div className="text-[10px] sm:text-xs text-pink-700 font-bold mt-1 tracking-wide">投稿</div>
                        </div>
                    </motion.div>
                    
                    <motion.div 
                        whileHover={{ scale: 1.05, y: -6, rotateX: 5 }} 
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300 }}
                        className="bg-gradient-to-br from-white to-pink-50/50 backdrop-blur-xl rounded-2xl p-3 sm:p-4 text-center shadow-[0_8px_30px_-6px_rgba(236,72,153,0.25)] border-2 border-white relative overflow-hidden group"
                        style={{ transformStyle: "preserve-3d" }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-pink-500/15 to-pink-700/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <motion.div 
                            className="absolute top-1 right-1 w-8 h-8 bg-pink-100/80 rounded-full flex items-center justify-center"
                            whileHover={{ rotate: 360 }}
                            transition={{ duration: 0.6 }}
                        >
                            <Heart className="w-4 h-4 text-pink-600 fill-pink-600" />
                        </motion.div>
                        <div className="relative z-10 pt-4">
                            <motion.div 
                                className="font-black text-2xl sm:text-3xl bg-gradient-to-br from-pink-600 to-pink-700 bg-clip-text text-transparent drop-shadow-sm" 
                                data-testid="text-likes-count"
                            >
                                {profileData.stats.likes}
                            </motion.div>
                            <div className="text-[10px] sm:text-xs text-pink-700 font-bold mt-1 tracking-wide">いいね</div>
                        </div>
                    </motion.div>
                    
                    <motion.div 
                        whileHover={{ scale: 1.05, y: -6, rotateX: 5 }} 
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300 }}
                        className="bg-gradient-to-br from-white to-purple-50/50 backdrop-blur-xl rounded-2xl p-3 sm:p-4 text-center shadow-[0_8px_30px_-6px_rgba(168,85,247,0.25)] border-2 border-white relative overflow-hidden group"
                        style={{ transformStyle: "preserve-3d" }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-pink-600/15 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <motion.div 
                            className="absolute top-1 right-1 w-8 h-8 bg-purple-100/80 rounded-full flex items-center justify-center"
                            whileHover={{ rotate: 360 }}
                            transition={{ duration: 0.6 }}
                        >
                            <Users className="w-4 h-4 text-purple-600" />
                        </motion.div>
                        <div className="relative z-10 pt-4">
                            <motion.div 
                                className="font-black text-2xl sm:text-3xl bg-gradient-to-br from-pink-700 to-purple-600 bg-clip-text text-transparent drop-shadow-sm" 
                                data-testid="text-followers-count"
                            >
                                {profileData.stats.followers}
                            </motion.div>
                            <div className="text-[10px] sm:text-xs text-purple-700 font-bold mt-1 tracking-wide">フォロワー</div>
                        </div>
                    </motion.div>
                    
                    <motion.div 
                        whileHover={{ scale: 1.05, y: -6, rotateX: 5 }} 
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300 }}
                        className="bg-gradient-to-br from-white to-purple-50/50 backdrop-blur-xl rounded-2xl p-3 sm:p-4 text-center shadow-[0_8px_30px_-6px_rgba(168,85,247,0.25)] border-2 border-white relative overflow-hidden group"
                        style={{ transformStyle: "preserve-3d" }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/15 to-purple-700/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <motion.div 
                            className="absolute top-1 right-1 w-8 h-8 bg-purple-100/80 rounded-full flex items-center justify-center"
                            whileHover={{ rotate: 360 }}
                            transition={{ duration: 0.6 }}
                        >
                            <UserPlus className="w-4 h-4 text-purple-700" />
                        </motion.div>
                        <div className="relative z-10 pt-4">
                            <motion.div 
                                className="font-black text-2xl sm:text-3xl bg-gradient-to-br from-purple-600 to-purple-700 bg-clip-text text-transparent drop-shadow-sm" 
                                data-testid="text-following-count"
                            >
                                {profileData.stats.following}
                            </motion.div>
                            <div className="text-[10px] sm:text-xs text-purple-700 font-bold mt-1 tracking-wide">フォロー</div>
                        </div>
                    </motion.div>
                </motion.div>

                {/* Bio - Premium Card */}
                {profileData.bio && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20, scale: 0.95 }} 
                        animate={{ opacity: 1, y: 0, scale: 1 }} 
                        transition={{ delay: 0.5, type: "spring" }} 
                        className="mb-6 bg-gradient-to-br from-white via-pink-50/40 to-white backdrop-blur-xl rounded-3xl p-6 shadow-[0_15px_50px_-10px_rgba(236,72,153,0.2)] border-2 border-pink-100/60 relative overflow-hidden group"
                    >
                        <motion.div 
                            animate={{ 
                                scale: [1, 1.2, 1],
                                rotate: [0, 180, 360]
                            }} 
                            transition={{ duration: 30, repeat: Infinity, ease: "linear" }} 
                            className="absolute -top-16 -right-16 w-48 h-48 bg-gradient-to-br from-pink-200/20 via-pink-300/15 to-pink-400/20 rounded-full blur-3xl" 
                        />
                        <div className="relative z-10">
                            <div className="flex items-center mb-3">
                                <motion.div
                                    whileHover={{ rotate: 360 }}
                                    transition={{ duration: 0.6 }}
                                    className="w-8 h-8 bg-gradient-to-br from-pink-400 to-pink-500 rounded-full flex items-center justify-center mr-2 shadow-md"
                                >
                                    <Sparkles className="w-4 h-4 text-white" />
                                </motion.div>
                                <span className="text-sm font-black bg-gradient-to-r from-pink-600 to-pink-700 bg-clip-text text-transparent">プロフィール</span>
                            </div>
                            <p className="text-gray-700 dark:text-gray-300 text-sm font-medium whitespace-pre-line leading-relaxed" data-testid="text-bio">{profileData.bio}</p>
                        </div>
                    </motion.div>
                )}

                {/* Social Links */}
                {(profileData.website || profileData.twitter || profileData.instagram || profileData.youtube) && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20, scale: 0.95 }} 
                        animate={{ opacity: 1, y: 0, scale: 1 }} 
                        transition={{ delay: 0.55, type: "spring" }} 
                        className="mb-6 bg-gradient-to-br from-white via-pink-50/40 to-white backdrop-blur-xl rounded-3xl p-6 shadow-[0_15px_50px_-10px_rgba(236,72,153,0.2)] border-2 border-pink-100/60 relative overflow-hidden"
                    >
                        <motion.div 
                            animate={{ 
                                scale: [1.2, 1, 1.2],
                                rotate: [360, 180, 0]
                            }} 
                            transition={{ duration: 30, repeat: Infinity, ease: "linear" }} 
                            className="absolute -bottom-16 -left-16 w-48 h-48 bg-gradient-to-br from-pink-200/20 to-purple-200/15 rounded-full blur-3xl" 
                        />
                        <div className="relative z-10">
                            <div className="flex items-center mb-4">
                                <motion.div
                                    whileHover={{ rotate: 360 }}
                                    transition={{ duration: 0.6 }}
                                    className="w-8 h-8 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center mr-2 shadow-md"
                                >
                                    <Globe className="w-4 h-4 text-white" />
                                </motion.div>
                                <span className="text-sm font-black bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">ソーシャルリンク</span>
                            </div>
                            <div className="space-y-2.5">
                                {profileData.website && (
                                    <motion.a 
                                        href={profileData.website} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        whileHover={{ scale: 1.02, x: 6 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="flex items-center text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 text-sm font-semibold bg-gradient-to-r from-pink-50/90 to-pink-100/80 dark:from-pink-900/20 dark:to-pink-800/20 px-4 py-3 rounded-2xl transition-all shadow-md hover:shadow-lg border border-pink-100 dark:border-pink-800/30"
                                        data-testid="link-website"
                                    >
                                        <motion.div 
                                            whileHover={{ rotate: 360 }}
                                            transition={{ duration: 0.5 }}
                                            className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-pink-400 to-pink-500 rounded-full mr-3 shadow-lg"
                                        >
                                            <Globe className="w-5 h-5 text-white" />
                                        </motion.div>
                                        <span className="truncate flex-1">{profileData.website}</span>
                                        <ExternalLink className="w-4 h-4 text-pink-400 ml-2 flex-shrink-0" />
                                    </motion.a>
                                )}
                                {profileData.twitter && (
                                    <motion.a 
                                        href={profileData.twitter} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        whileHover={{ scale: 1.02, x: 6 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-semibold bg-gradient-to-r from-blue-50/90 to-blue-100/80 dark:from-blue-900/20 dark:to-blue-800/20 px-4 py-3 rounded-2xl transition-all shadow-md hover:shadow-lg border border-blue-100 dark:border-blue-800/30"
                                        data-testid="link-twitter"
                                    >
                                        <motion.div 
                                            whileHover={{ rotate: 360 }}
                                            transition={{ duration: 0.5 }}
                                            className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full mr-3 shadow-lg"
                                        >
                                            <Twitter className="w-5 h-5 text-white" />
                                        </motion.div>
                                        <span className="truncate flex-1">{profileData.twitter}</span>
                                        <ExternalLink className="w-4 h-4 text-blue-400 ml-2 flex-shrink-0" />
                                    </motion.a>
                                )}
                                {profileData.instagram && (
                                    <motion.a 
                                        href={profileData.instagram} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        whileHover={{ scale: 1.02, x: 6 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="flex items-center text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 text-sm font-semibold bg-gradient-to-r from-purple-50/90 to-pink-50/90 dark:from-purple-900/20 dark:to-pink-900/20 px-4 py-3 rounded-2xl transition-all shadow-md hover:shadow-lg border border-purple-100 dark:border-purple-800/30"
                                        data-testid="link-instagram"
                                    >
                                        <motion.div 
                                            whileHover={{ rotate: 360 }}
                                            transition={{ duration: 0.5 }}
                                            className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-purple-400 via-pink-400 to-orange-400 rounded-full mr-3 shadow-lg"
                                        >
                                            <Instagram className="w-5 h-5 text-white" />
                                        </motion.div>
                                        <span className="truncate flex-1">{profileData.instagram}</span>
                                        <ExternalLink className="w-4 h-4 text-purple-400 ml-2 flex-shrink-0" />
                                    </motion.a>
                                )}
                                {profileData.youtube && (
                                    <motion.a 
                                        href={profileData.youtube} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        whileHover={{ scale: 1.02, x: 6 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="flex items-center text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-semibold bg-gradient-to-r from-red-50/90 to-red-100/80 dark:from-red-900/20 dark:to-red-800/20 px-4 py-3 rounded-2xl transition-all shadow-md hover:shadow-lg border border-red-100 dark:border-red-800/30"
                                        data-testid="link-youtube"
                                    >
                                        <motion.div 
                                            whileHover={{ rotate: 360 }}
                                            transition={{ duration: 0.5 }}
                                            className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-full mr-3 shadow-lg"
                                        >
                                            <Youtube className="w-5 h-5 text-white" />
                                        </motion.div>
                                        <span className="truncate flex-1">{profileData.youtube}</span>
                                        <ExternalLink className="w-4 h-4 text-red-400 ml-2 flex-shrink-0" />
                                    </motion.a>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Genre Rankings */}
                {profileData.genreRankings && profileData.genreRankings.length > 0 && showRankings && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="bg-gradient-to-br from-pink-100 to-pink-200 rounded-2xl p-5 mb-4 shadow-xl border-2 border-pink-200 relative overflow-hidden">
                        <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute -top-10 -right-10 w-32 h-32 bg-white/30 rounded-full blur-2xl" />
                        <div className="relative z-10">
                            <h3 className="font-bold text-pink-900 mb-3 text-lg flex items-center">
                                <Sparkles className="w-5 h-5 mr-2" />
                                ジャンル別ランキング(日間)
                            </h3>
                            <div className="space-y-2">
                                {profileData.genreRankings.map((item, index) => (
                                    <motion.div key={index} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 + index * 0.05 }} className="flex justify-between items-center bg-gradient-to-r from-pink-50/80 to-pink-100/80 rounded-lg p-2">
                                        <span className="text-pink-900 font-medium" data-testid={`text-genre-${index}`}>{item.genre}</span>
                                        <span className="font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent" data-testid={`text-rank-${index}`}>{item.rank}位</span>
                                    </motion.div>
                                ))}
                            </div>
                            
                            {isOwnProfile && (
                                <div className="flex items-center justify-between mt-4 pt-3 border-t border-pink-200">
                                    <span className="text-sm text-pink-800 font-medium">ジャンル別ランキング(日間)を他ユーザーに表示する</span>
                                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowRankings(!showRankings)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showRankings ? 'bg-gradient-to-r from-pink-500 to-pink-600' : 'bg-gradient-to-r from-pink-200 to-pink-300'}`} data-testid="button-toggle-rankings">
                                        <motion.span animate={{ x: showRankings ? 20 : 4 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} className="inline-block h-4 w-4 rounded-full bg-white shadow-md" />
                                    </motion.button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* Subscription Plans - Ultra Premium Design */}
                {subscriptionPlans.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20, scale: 0.95 }} 
                        animate={{ opacity: 1, y: 0, scale: 1 }} 
                        transition={{ delay: 0.6, type: "spring" }} 
                        className="mb-6 bg-gradient-to-br from-white via-pink-50/40 to-white backdrop-blur-xl rounded-3xl p-6 shadow-[0_15px_50px_-10px_rgba(236,72,153,0.2)] border-2 border-pink-100/60 relative overflow-hidden"
                    >
                        <motion.div 
                            animate={{ 
                                scale: [1, 1.2, 1],
                                rotate: [0, 180, 360]
                            }} 
                            transition={{ duration: 30, repeat: Infinity, ease: "linear" }} 
                            className="absolute -top-16 -right-16 w-48 h-48 bg-gradient-to-br from-pink-200/20 via-purple-200/15 to-pink-400/20 rounded-full blur-3xl" 
                        />
                        
                        <div className="relative z-10">
                            <div className="flex items-center mb-5">
                                <motion.div
                                    whileHover={{ rotate: 360 }}
                                    transition={{ duration: 0.6 }}
                                    className="w-8 h-8 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center mr-2 shadow-md"
                                >
                                    <Star className="w-4 h-4 text-white" />
                                </motion.div>
                                <h3 className="text-sm font-black bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">サブスクリプションプラン</h3>
                            </div>

                            <div className="space-y-3">
                                {displayedPlans.map((plan, index) => (
                                    <motion.div
                                        key={plan.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.65 + index * 0.05, type: "spring" }}
                                        whileHover={{ scale: 1.02, y: -2 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handlePlanConfirm(plan.id)}
                                        className={`bg-gradient-to-br ${
                                            plan.isRecommended 
                                                ? 'from-pink-50 via-white to-purple-50/50 border-pink-300 shadow-[0_8px_30px_-6px_rgba(236,72,153,0.4)]' 
                                                : 'from-white to-pink-50/30 border-pink-200 shadow-[0_8px_30px_-6px_rgba(236,72,153,0.2)]'
                                        } rounded-2xl p-4 border-2 cursor-pointer relative overflow-hidden group`}
                                        data-testid={`subscription-plan-${plan.id}`}
                                    >
                                        {plan.isRecommended && (
                                            <motion.div
                                                animate={{ 
                                                    x: ["-100%", "200%"]
                                                }}
                                                transition={{
                                                    duration: 3,
                                                    repeat: Infinity,
                                                    ease: "linear"
                                                }}
                                                className="absolute inset-0 bg-gradient-to-r from-transparent via-pink-200/30 to-transparent"
                                            />
                                        )}
                                        
                                        <div className="relative z-10 flex items-center justify-between">
                                            <div className="flex-1 pr-3">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <h4 className="font-black text-base text-gray-800 dark:text-gray-200 flex items-center">
                                                        {plan.emoji && <span className="mr-1.5 text-xl">{plan.emoji}</span>}
                                                        {plan.title}
                                                    </h4>
                                                    {plan.isRecommended && (
                                                        <motion.div 
                                                            animate={{ scale: [1, 1.1, 1] }}
                                                            transition={{ duration: 2, repeat: Infinity }}
                                                            className="bg-gradient-to-r from-pink-500 to-pink-600 text-white text-[10px] px-2.5 py-1 rounded-full font-bold shadow-md flex items-center"
                                                        >
                                                            <Sparkles className="w-3 h-3 mr-0.5" />
                                                            おすすめ
                                                        </motion.div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs mb-2">
                                                    <div className="flex items-center bg-gradient-to-r from-pink-100 to-pink-200 dark:from-pink-900/30 dark:to-pink-800/30 px-2.5 py-1 rounded-full">
                                                        <Video className="w-3.5 h-3.5 mr-1 text-pink-600" />
                                                        <span className="font-semibold text-pink-700 dark:text-pink-400">{plan.posts}投稿</span>
                                                    </div>
                                                </div>
                                                {plan.description && (
                                                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{plan.description}</p>
                                                )}
                                            </div>
                                            <div className="flex flex-col items-end gap-2.5">
                                                <div className="text-right">
                                                    <div className="font-black text-2xl bg-gradient-to-br from-pink-600 to-purple-600 bg-clip-text text-transparent drop-shadow-sm">
                                                        {calculateTotalPrice(plan.price)}
                                                    </div>
                                                    <div className="text-[10px] text-pink-500 dark:text-pink-400 font-semibold">税込</div>
                                                </div>
                                                <motion.button
                                                    whileHover={{ scale: 1.08, boxShadow: "0 8px 25px rgba(236, 72, 153, 0.4)" }}
                                                    whileTap={{ scale: 0.95 }}
                                                    className="relative bg-gradient-to-r from-pink-500 via-pink-600 to-purple-600 text-white px-6 py-2 rounded-full font-bold shadow-lg text-xs whitespace-nowrap overflow-hidden group"
                                                    data-testid={`button-subscribe-${plan.id}`}
                                                >
                                                    <motion.div
                                                        animate={{
                                                            x: ["-100%", "100%"]
                                                        }}
                                                        transition={{
                                                            duration: 2,
                                                            repeat: Infinity,
                                                            ease: "linear"
                                                        }}
                                                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                                                    />
                                                    <span className="relative z-10">加入する</span>
                                                </motion.button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                            
                            {subscriptionPlans.length > 3 && !showAllPlans && (
                                <motion.button
                                    whileHover={{ scale: 1.02, y: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setShowAllPlans(true)}
                                    className="w-full bg-gradient-to-r from-white to-pink-50 text-pink-600 border-2 border-pink-300 py-3 rounded-2xl font-bold shadow-md hover:shadow-lg hover:bg-pink-50 transition-all mt-3"
                                    data-testid="button-show-all-plans"
                                >
                                    すべてのプランを見る
                                </motion.button>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* Posts Section */}
                <div className="mt-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-pink-900 text-lg flex items-center">
                            <Video className="w-5 h-5 mr-2" />
                            投稿
                        </h3>
                        <div className="flex space-x-2">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleFilterChange('all')}
                                className={`px-4 py-2 rounded-full text-sm font-bold ${
                                    selectedFilter === 'all'
                                        ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white'
                                        : 'bg-white text-pink-600 border border-pink-300'
                                }`}
                                data-testid="button-filter-all"
                            >
                                すべて
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleFilterChange('video')}
                                className={`px-4 py-2 rounded-full text-sm font-bold ${
                                    selectedFilter === 'video'
                                        ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white'
                                        : 'bg-white text-pink-600 border border-pink-300'
                                }`}
                                data-testid="button-filter-video"
                            >
                                <Video className="w-4 h-4 inline mr-1" />
                                動画
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleFilterChange('image')}
                                className={`px-4 py-2 rounded-full text-sm font-bold ${
                                    selectedFilter === 'image'
                                        ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white'
                                        : 'bg-white text-pink-600 border border-pink-300'
                                }`}
                                data-testid="button-filter-image"
                            >
                                <Image className="w-4 h-4 inline mr-1" />
                                画像
                            </motion.button>
                        </div>
                    </div>

                    {/* Content Grid */}
                    {contentData.length > 0 ? (
                        <div className="grid grid-cols-3 gap-3">
                            {contentData.map((content, index) => {
                                // プランベースのアクセス制御チェック
                                const hasAccess = !content.isExclusiveContent || 
                                    canAccessContent(userPlanLevel, content.requiredPlanLevel, isOwnProfile, false);
                                const shouldBlur = !hasAccess;
                                
                                return (
                                <motion.div
                                    key={content.id}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: index * 0.05 }}
                                    whileHover={{ scale: 1.05 }}
                                    onClick={() => handleContentClick(content.id)}
                                    className="relative aspect-square bg-gradient-to-br from-pink-100 to-pink-200 rounded-lg overflow-hidden cursor-pointer shadow-md"
                                    data-testid={`content-${content.id}`}
                                >
                                    {content.type === 'video' ? (
                                        <video
                                            src={content.thumbnail}
                                            className={`w-full h-full object-cover ${shouldBlur ? 'blur-lg' : ''}`}
                                            muted
                                            playsInline
                                            preload="metadata"
                                            onLoadedMetadata={(e) => handleVideoMetadata(e, content.id)}
                                        />
                                    ) : (
                                        <img
                                            src={content.thumbnail || 'https://via.placeholder.com/300'}
                                            alt="Content"
                                            className={`w-full h-full object-cover ${shouldBlur ? 'blur-lg' : ''}`}
                                        />
                                    )}
                                    
                                    {/* 限定コンテンツのロックオーバーレイ */}
                                    {shouldBlur && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                                            <motion.div 
                                                initial={{ scale: 0.8, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                transition={{ delay: index * 0.05 + 0.2 }}
                                                className="flex flex-col items-center"
                                            >
                                                <motion.div
                                                    animate={{ scale: [1, 1.1, 1] }}
                                                    transition={{ duration: 2, repeat: Infinity }}
                                                    className="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg"
                                                >
                                                    <Lock className="w-6 h-6 text-white" />
                                                </motion.div>
                                                <span className="text-white text-xs font-bold mt-2 bg-black/50 px-2 py-1 rounded-full">
                                                    {content.requiredPlanLevel === 'vip' ? 'VIP限定' : 
                                                     content.requiredPlanLevel === 'premium' ? 'プレミアム限定' : '限定'}
                                                </span>
                                            </motion.div>
                                        </div>
                                    )}
                                    
                                    {content.type === 'video' && (
                                        <div className="absolute top-1.5 right-1.5 bg-black/60 text-white px-1.5 py-0.5 rounded text-[10px]" data-testid={`duration-${content.id}`}>
                                            {videoDurations[content.id] || content.duration || '00:00'}
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 hover:opacity-100 transition-opacity flex items-end p-2">
                                        <div className="flex items-center space-x-3 text-white text-xs">
                                            <span className="flex items-center">
                                                <Heart className="w-3 h-3 mr-1" />
                                                {content.likes}
                                            </span>
                                            <span className="flex items-center">
                                                <MessageCircle className="w-3 h-3 mr-1" />
                                                {content.comments}
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
                            <motion.div
                                animate={{ y: [0, -10, 0] }}
                                transition={{ duration: 3, repeat: Infinity }}
                            >
                                <Video className="w-16 h-16 mx-auto text-pink-300 mb-4" />
                            </motion.div>
                            <p className="text-pink-600 font-medium">まだ投稿がありません</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Share Modal */}
            <AnimatePresence>
                {showShareModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowShareModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
                        >
                            <div className="bg-gradient-to-r from-pink-500 to-pink-600 text-white p-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xl font-bold">プロフィールを共有</h3>
                                    <motion.button
                                        whileHover={{ scale: 1.1, rotate: 90 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => setShowShareModal(false)}
                                        className="p-2 hover:bg-white/20 rounded-full transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </motion.button>
                                </div>
                            </div>
                            <div className="p-6">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleCopyLink}
                                    className="w-full bg-gradient-to-r from-pink-500 to-pink-600 text-white py-3 rounded-xl font-bold shadow-lg flex items-center justify-center space-x-2"
                                    data-testid="button-copy-link"
                                >
                                    <Copy className="w-5 h-5" />
                                    <span>リンクをコピー</span>
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Plan Subscription Modal - Payment Details */}
            <AnimatePresence>
                {showPlanModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end"
                        onClick={() => setShowPlanModal(null)}
                    >
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-t-3xl shadow-2xl w-full overflow-y-auto max-h-[85vh] pb-24"
                        >
                            {(() => {
                                const plan = subscriptionPlans.find(p => p.id === showPlanModal);
                                if (!plan) return null;
                                
                                const priceStr = String(plan.price || '0');
                                const priceMatch = priceStr.match(/\d+/);
                                const basePrice = priceMatch ? parseInt(priceMatch[0]) : 0;
                                const tax = Math.floor(basePrice * 0.10);
                                const platformFee = Math.floor(basePrice * 0.10);
                                const total = basePrice + tax + platformFee;
                                
                                return (
                                    <>
                                        <div className="bg-gradient-to-r from-pink-500 to-pink-600 text-white p-6">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-xl font-bold">{plan.emoji} {plan.title}</h3>
                                                <button onClick={() => setShowPlanModal(null)} className="text-white">
                                                    <X className="w-6 h-6" />
                                                </button>
                                            </div>
                                            <p className="text-sm opacity-90">{plan.description}</p>
                                        </div>
                                        <div className="p-6">
                                            <h4 className="text-lg font-bold text-gray-800 mb-4">お支払い詳細</h4>
                                            
                                            {/* Price Breakdown */}
                                            <div className="space-y-3 mb-6">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-gray-600">プラン料金</span>
                                                    <span className="font-bold text-gray-800">¥{basePrice.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-gray-600">消費税（10%）</span>
                                                    <span className="font-bold text-gray-800">¥{tax.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-gray-600">購入手数料（10%）</span>
                                                    <span className="font-bold text-gray-800">¥{platformFee.toLocaleString()}</span>
                                                </div>
                                                <div className="border-t-2 border-pink-200 pt-3 mt-3">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-lg font-bold text-gray-800">お支払い合計</span>
                                                        <span className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent">¥{total.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Stripe Payment Form */}
                                            {clientSecret ? (
                                                <Elements
                                                    stripe={stripePromise}
                                                    options={{
                                                        clientSecret,
                                                        appearance: {
                                                            theme: 'stripe',
                                                            variables: {
                                                                colorPrimary: '#ec4899',
                                                                colorBackground: '#ffffff',
                                                                colorText: '#1f2937',
                                                                colorDanger: '#ef4444',
                                                                borderRadius: '12px',
                                                            },
                                                        },
                                                    }}
                                                >
                                                    <PaymentForm
                                                        plan={{ ...plan, total, creatorId: profileData.id }}
                                                        onSuccess={handlePaymentSuccess}
                                                        onCancel={handlePaymentCancel}
                                                    />
                                                </Elements>
                                            ) : (
                                                <div className="flex items-center justify-center py-8">
                                                    <div className="animate-spin w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full" />
                                                </div>
                                            )}
                                        </div>
                                    </>
                                );
                            })()}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <BottomNavigationWithCreator active="profile" />
        </div>
    );
};

export default ProfilePage;
