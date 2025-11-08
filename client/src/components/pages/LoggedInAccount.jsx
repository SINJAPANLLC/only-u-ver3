import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, FileText, MoreHorizontal, CreditCard, UserCheck, Lock, BarChart, PenTool, Video, ChevronRight, Sparkles, Crown, Star, TrendingUp, DollarSign, Users, Bell, CheckCircle, Clock, XCircle, AlertTriangle, Radio } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import BottomNavigationWithCreator from '../BottomNavigationWithCreator';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';


const LoggedInAccountPage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [showLogoutModal, setShowLogoutModal] = React.useState(false);
    const [userData, setUserData] = useState(null);

    // Firestoreからユーザーデータを取得
    useEffect(() => {
        const fetchUserData = async () => {
            if (!currentUser) return;
            
            try {
                const userDocRef = doc(db, 'users', currentUser.uid);
                const userDoc = await getDoc(userDocRef);
                
                if (userDoc.exists()) {
                    setUserData(userDoc.data());
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
            }
        };
        
        fetchUserData();
    }, [currentUser]);

    // You can replace these with actual user data
    const user = {
        name: userData?.displayName || currentUser?.displayName || 'User Name',
        profileUrl: `/profile/${currentUser?.uid || 'default'}`,
        avatar: userData?.photoURL || userData?.avatar || currentUser?.photoURL || '/logo.webp',
        subscriptionStatus: t('account.purchaseSave.notSubscribed'),
    };

    const handleNavigation = (path) => {
        if (path === 'home') navigate('/');
        else if (path === 'feed') navigate('/feed');
        else if (path === 'messages') navigate('/messages');
        else if (path === 'ranking') navigate('/rankingpage');
        else if (path === 'account') navigate('/account');
        else if (path === '/logout') {/* Implement logout logic here */ navigate('/login'); }
        else if (path === '/register-creator') navigate('/register-creator');
        else if (path === '/creator-dashboard') navigate('/creator-dashboard');
        else if (path) navigate(path);
        else if (path === 'languages') navigate('/settings/language');
        else if (path === 'switch-account') navigate('/login');
        else navigate('/');
    };

    const handleCreatePost = () => {
        navigate('/create-post');
    };

    const [showModal] = React.useState(false);

    const handleRegisterModal = () => {
        navigate('/register-creator');
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            localStorage.removeItem('ageVerified');
            console.log("User logged out successfully");
            navigate('/login');
        } catch (error) {
            console.error("Logout error:", error.message);
        }
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3 }}
                className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 dark:from-gray-900 dark:via-black dark:to-gray-900 pb-20"
            >
                {/* User profile section with gradient */}
                <div className="bg-gradient-to-r from-pink-500 to-pink-600 pt-6 pb-20 px-6 relative overflow-hidden">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center space-x-4 relative z-10"
                    >
                        <div>
                            <img
                                src={user.avatar}
                                alt={user.name}
                                className="w-24 h-24 rounded-full border-4 border-white shadow-2xl object-cover"
                            />
                        </div>
                        <div className="flex-1">
                            <p className="font-bold text-2xl text-white mb-1">{user.name}</p>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="text-sm text-white bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/30 font-medium"
                                onClick={() => navigate(`/profile/${currentUser?.uid || 'default'}`)}
                                data-testid="button-view-profile"
                            >
                                {t('account.viewProfile')}
                            </motion.button>
                        </div>
                    </motion.div>
                </div>

                <div className="px-6 -mt-12 space-y-6 relative z-10">
                    {/* Creator Status/Registration Section */}
                    {!userData?.isCreator || userData?.creatorStatus !== 'approved' ? (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            whileHover={{ scale: 1.02, y: -2 }}
                            className={`bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border-2 ${
                                userData?.creatorStatus === 'pending' ? 'border-yellow-200 bg-yellow-50' :
                                userData?.creatorStatus === 'rejected' ? 'border-red-200 bg-red-50' :
                                'border-pink-100'
                            } cursor-pointer overflow-hidden relative`}
                            onClick={() => {
                                if (userData?.creatorStatus === 'pending') return;
                                if (userData?.creatorStatus === 'rejected') return;
                                handleNavigation('/register-creator');
                            }}
                            data-testid="card-creator-registration"
                        >
                            <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center space-x-4">
                                    <motion.div
                                        whileHover={{ scale: 1.1 }}
                                        className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg ${
                                            userData?.creatorStatus === 'pending' ? 'bg-gradient-to-br from-yellow-400 to-yellow-500' :
                                            userData?.creatorStatus === 'rejected' ? 'bg-gradient-to-br from-red-400 to-red-500' :
                                            'bg-gradient-to-br from-pink-500 to-pink-600'
                                        }`}
                                    >
                                        {userData?.creatorStatus === 'pending' ? (
                                            <Clock className="w-7 h-7 text-white" />
                                        ) : userData?.creatorStatus === 'rejected' ? (
                                            <XCircle className="w-7 h-7 text-white" />
                                        ) : (
                                            <UserCheck className="w-7 h-7 text-white" />
                                        )}
                                    </motion.div>
                                    <div>
                                        <h2 className={`text-xl font-bold ${
                                            userData?.creatorStatus === 'pending' ? 'text-yellow-600' :
                                            userData?.creatorStatus === 'rejected' ? 'text-red-600' :
                                            'bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent'
                                        }`}>
                                            {userData?.creatorStatus === 'pending' ? 'クリエイター申請審査中' :
                                             userData?.creatorStatus === 'rejected' ? 'クリエイター申請却下' :
                                             'クリエイター登録'}
                                        </h2>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                            {userData?.creatorStatus === 'pending' ? '承認までお待ちください' :
                                             userData?.creatorStatus === 'rejected' ? 'サポートにお問い合わせください' :
                                             'コンテンツを投稿するには登録が必要'}
                                        </p>
                                    </div>
                                </div>
                                {userData?.creatorStatus !== 'pending' && userData?.creatorStatus !== 'rejected' && (
                                    <div className="flex items-center space-x-2">
                                        <span className="text-sm font-medium text-pink-600">今すぐ登録</span>
                                        <ChevronRight className="w-5 h-5 text-pink-500" />
                                    </div>
                                )}
                            </div>
                            {userData?.creatorStatus === 'pending' && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="mt-4 p-3 bg-yellow-100 rounded-lg border border-yellow-200"
                                >
                                    <p className="text-sm text-yellow-800 flex items-center">
                                        <AlertTriangle className="w-4 h-4 mr-2" />
                                        管理者が申請を確認しています。承認されるまでコンテンツの投稿はできません。
                                    </p>
                                </motion.div>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border-2 border-green-200 dark:border-gray-700 overflow-hidden relative"
                        >
                            <div className="flex items-center space-x-4 relative z-10">
                                <motion.div
                                    whileHover={{ scale: 1.1 }}
                                    className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg"
                                >
                                    <CheckCircle className="w-7 h-7 text-white" />
                                </motion.div>
                                <div>
                                    <h2 className="text-xl font-bold text-green-600">
                                        クリエイター承認済み
                                    </h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">コンテンツの投稿が可能です</p>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Creator Dashboard Section - Only shown for approved creators */}
                    {userData?.isCreator && userData?.creatorStatus === 'approved' && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            whileHover={{ scale: 1.02, y: -2 }}
                            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border-2 border-pink-100 dark:border-gray-700 cursor-pointer overflow-hidden relative"
                            onClick={() => handleNavigation('/creator-dashboard')}
                            data-testid="card-creator-dashboard"
                        >
                            <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center space-x-4">
                                    <motion.div
                                        whileHover={{ scale: 1.1 }}
                                        className="w-14 h-14 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg"
                                    >
                                        <BarChart className="w-7 h-7 text-white" />
                                    </motion.div>
                                    <div>
                                        <h2 className="text-xl font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent">
                                            {t('account.creatorDashboard.title')}
                                        </h2>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">パフォーマンスを確認</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <span className="text-sm font-medium text-pink-600">{t('account.creatorDashboard.analysis')}</span>
                                    <ChevronRight className="w-5 h-5 text-pink-500" />
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Purchase/Save Section */}
                    <div>
                        <div className="flex items-center mb-4 px-2">
                            <motion.div
                                animate={{ 
                                    y: [0, -3, 0],
                                }}
                                transition={{ 
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                }}
                                className="w-8 h-8 bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg flex items-center justify-center mr-3 shadow-md"
                            >
                                <CreditCard className="w-4 h-4 text-white" />
                            </motion.div>
                            <h2 className="text-lg font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent">
                                {t('account.purchaseSave.title')}
                            </h2>
                        </div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-pink-100 dark:border-gray-700 overflow-hidden divide-y divide-pink-50 dark:divide-gray-700"
                        >
                            <motion.button 
                                whileHover={{ scale: 1.01, x: 5 }}
                                whileTap={{ scale: 0.98 }}
                                className="flex justify-between items-center py-4 px-5 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 w-full text-gray-800 dark:text-gray-200 transition-all duration-300"
                                onClick={() => handleNavigation('/high-quality-plan')}
                                data-testid="button-high-quality-plan"
                            >
                                <span className="font-semibold">高画質プラン</span>
                                <span className="bg-gradient-to-r from-pink-500 to-pink-600 text-white px-3 py-1 rounded-full text-sm font-medium">未加入</span>
                            </motion.button>
                            <motion.button 
                                whileHover={{ scale: 1.01, x: 5 }}
                                whileTap={{ scale: 0.98 }}
                                className="flex justify-between items-center py-4 px-5 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 w-full text-gray-800 dark:text-gray-200 transition-all duration-300"
                                onClick={() => handleNavigation('/current-plan')}
                                data-testid="button-current-plan"
                            >
                                <span className="font-semibold">加入中のプラン</span>
                                <ChevronRight className="w-5 h-5 text-pink-400" />
                            </motion.button>
                            <motion.button 
                                whileHover={{ scale: 1.01, x: 5 }}
                                whileTap={{ scale: 0.98 }}
                                className="flex justify-between items-center py-4 px-5 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 w-full text-gray-800 dark:text-gray-200 transition-all duration-300"
                                onClick={() => handleNavigation('/payment-methods')}
                                data-testid="button-payment-methods"
                            >
                                <span className="font-semibold">支払い方法</span>
                                <ChevronRight className="w-5 h-5 text-pink-400" />
                            </motion.button>
                            <motion.button 
                                whileHover={{ scale: 1.01, x: 5 }}
                                whileTap={{ scale: 0.98 }}
                                className="flex justify-between items-center py-4 px-5 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 w-full text-gray-800 dark:text-gray-200 transition-all duration-300"
                                onClick={() => handleNavigation('/purchase-history')}
                                data-testid="button-purchase-history"
                            >
                                <span className="font-semibold">購入履歴</span>
                                <ChevronRight className="w-5 h-5 text-pink-400" />
                            </motion.button>
                            <motion.button 
                                whileHover={{ scale: 1.01, x: 5 }}
                                whileTap={{ scale: 0.98 }}
                                className="flex justify-between items-center py-4 px-5 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 w-full text-gray-800 dark:text-gray-200 transition-all duration-300"
                                onClick={() => handleNavigation('/coupons')}
                                data-testid="button-coupons"
                            >
                                <span className="font-semibold">クーポン一覧</span>
                                <ChevronRight className="w-5 h-5 text-pink-400" />
                            </motion.button>
                        </motion.div>
                    </div>

                    {/* Live Button - Only shown for approved creators */}
                    {userData?.isCreator && userData?.creatorStatus === 'approved' && (
                        <motion.button
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.25 }}
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => navigate('/create-live')}
                            className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-2xl shadow-xl p-6 border-2 border-red-100 cursor-pointer overflow-hidden relative mb-6"
                            data-testid="button-start-live"
                        >
                            <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center space-x-4">
                                    <motion.div
                                        animate={{ 
                                            scale: [1, 1.2, 1],
                                        }}
                                        transition={{ 
                                            duration: 2,
                                            repeat: Infinity,
                                            ease: "easeInOut"
                                        }}
                                        className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg"
                                    >
                                        <Radio className="w-7 h-7 text-white" />
                                    </motion.div>
                                    <div className="text-left">
                                        <h2 className="text-xl font-bold text-white">
                                            ライブ配信を開始
                                        </h2>
                                        <p className="text-sm text-white/80 mt-1">リアルタイムでファンと交流</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <span className="text-sm font-medium text-white">配信する</span>
                                    <ChevronRight className="w-5 h-5 text-white" />
                                </div>
                            </div>
                            {/* Animated background effect */}
                            <motion.div
                                animate={{
                                    x: ["-100%", "100%"]
                                }}
                                transition={{
                                    duration: 3,
                                    repeat: Infinity,
                                    ease: "linear"
                                }}
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                            />
                        </motion.button>
                    )}

                    {/* Posts/Operations/Sales Section */}
                    <div>
                        <div className="flex items-center mb-4 px-2">
                            <motion.div
                                animate={{ 
                                    y: [0, -3, 0],
                                }}
                                transition={{ 
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                    delay: 0.2
                                }}
                                className="w-8 h-8 bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg flex items-center justify-center mr-3 shadow-md"
                            >
                                <UserCheck className="w-4 h-4 text-white" />
                            </motion.div>
                            <h2 className="text-lg font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent">
                                {t('account.postsOperations.title')}
                            </h2>
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 px-2">
                            {t('account.postsOperations.description')}
                        </p>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="space-y-3"
                        >
                            <motion.button 
                                whileHover={{ scale: 1.02, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                className="block w-full text-left px-5 py-4 bg-white dark:bg-gray-800 border-2 border-pink-100 dark:border-gray-700 rounded-2xl hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 text-gray-800 dark:text-gray-200 shadow-md transition-all duration-300 font-semibold"
                                onClick={() => handleNavigation('/register-creator')}
                                data-testid="button-register-creator"
                            >
                                {t('account.postsOperations.registerCreator')}
                            </motion.button>
                            
                            {/* Creator Management Features */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-pink-100 dark:border-gray-700 overflow-hidden divide-y divide-pink-50 dark:divide-gray-700">
                                <motion.button 
                                    whileHover={{ scale: 1.01, x: 5 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="block w-full text-left px-5 py-4 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 text-gray-800 dark:text-gray-200 transition-all duration-300 font-semibold" 
                                    onClick={() => handleNavigation('/creator-ranking')}
                                    data-testid="button-creator-ranking"
                                >
                                    クリエイターランキング
                                </motion.button>
                                <motion.button 
                                    whileHover={{ scale: 1.01, x: 5 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="block w-full text-left px-5 py-4 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 text-gray-800 dark:text-gray-200 transition-all duration-300 font-semibold" 
                                    onClick={() => handleNavigation('/active-plans')}
                                    data-testid="button-active-plans"
                                >
                                    運営中のプラン
                                </motion.button>
                                <motion.button 
                                    whileHover={{ scale: 1.01, x: 5 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="block w-full text-left px-5 py-4 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 text-gray-800 dark:text-gray-200 transition-all duration-300 font-semibold" 
                                    onClick={() => handleNavigation('/my-posts')}
                                    data-testid="button-my-posts"
                                >
                                    あなたの投稿
                                </motion.button>
                                <motion.button 
                                    whileHover={{ scale: 1.01, x: 5 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="block w-full text-left px-5 py-4 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 text-gray-800 dark:text-gray-200 transition-all duration-300 font-semibold" 
                                    onClick={() => handleNavigation('/post-comments')}
                                    data-testid="button-post-comments"
                                >
                                    投稿へのコメント
                                </motion.button>
                                <motion.button 
                                    whileHover={{ scale: 1.01, x: 5 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="block w-full text-left px-5 py-4 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 text-gray-800 dark:text-gray-200 transition-all duration-300 font-semibold" 
                                    onClick={() => handleNavigation('/sales-management')}
                                    data-testid="button-sales-management"
                                >
                                    売上管理
                                </motion.button>
                                <motion.button 
                                    whileHover={{ scale: 1.01, x: 5 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="block w-full text-left px-5 py-4 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 text-gray-800 dark:text-gray-200 transition-all duration-300 font-semibold" 
                                    onClick={() => handleNavigation('/bank-account-registration')}
                                    data-testid="button-bank-account"
                                >
                                    振込先口座の登録
                                </motion.button>
                                <motion.button 
                                    whileHover={{ scale: 1.01, x: 5 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="block w-full text-left px-5 py-4 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 text-gray-800 dark:text-gray-200 transition-all duration-300 font-semibold" 
                                    onClick={() => handleNavigation('/transfer-request')}
                                    data-testid="button-transfer-request"
                                >
                                    振込申請
                                </motion.button>
                                <motion.button 
                                    whileHover={{ scale: 1.01, x: 5 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="block w-full text-left px-5 py-4 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 text-gray-800 dark:text-gray-200 transition-all duration-300 font-semibold" 
                                    onClick={() => handleNavigation('/coupon-management')}
                                    data-testid="button-coupon-management"
                                >
                                    クーポン管理
                                </motion.button>
                            </div>
                        </motion.div>
                    </div>

                    {/* Settings Section */}
                    <div>
                        <div className="flex items-center mb-4 px-2">
                            <motion.div
                                animate={{ 
                                    rotate: [0, 360],
                                }}
                                transition={{ 
                                    duration: 10,
                                    repeat: Infinity,
                                    ease: "linear"
                                }}
                                className="w-8 h-8 bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg flex items-center justify-center mr-3 shadow-md"
                            >
                                <Settings className="w-4 h-4 text-white" />
                            </motion.div>
                            <h2 className="text-lg font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent">
                                {t('account.settings.title')}
                            </h2>
                        </div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-pink-100 dark:border-gray-700 overflow-hidden divide-y divide-pink-50 dark:divide-gray-700"
                        >
                            <motion.button 
                                whileHover={{ scale: 1.01, x: 5 }}
                                whileTap={{ scale: 0.98 }}
                                className="flex justify-between items-center py-4 px-5 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 w-full text-gray-800 dark:text-gray-200 transition-all duration-300 font-semibold"
                                onClick={() => handleNavigation('/settings/languages')}
                                data-testid="button-language"
                            >
                                <span>{t('account.settings.language')}</span>
                                <ChevronRight className="w-5 h-5 text-pink-400" />
                            </motion.button>
                            <div className="flex items-center justify-between py-4 px-5 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 w-full text-gray-800 dark:text-gray-200">
                                <span className="font-semibold">{t('account.settings.rejectMessage')}</span>
                                <label className="inline-flex relative items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-gradient-to-r peer-checked:from-pink-500 peer-checked:to-pink-600"></div>
                                    <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-5 shadow-md"></div>
                                </label>
                            </div>
                            <motion.button 
                                whileHover={{ scale: 1.01, x: 5 }}
                                whileTap={{ scale: 0.98 }}
                                className="flex justify-between items-center py-4 px-5 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 w-full text-gray-800 dark:text-gray-200 transition-all duration-300 font-semibold"
                                onClick={() => handleNavigation('/settings/email-notifications')}
                                data-testid="button-email-notifications"
                            >
                                <span>{t('account.settings.emailNotifications')}</span>
                                <ChevronRight className="w-5 h-5 text-pink-400" />
                            </motion.button>
                            <motion.button 
                                whileHover={{ scale: 1.01, x: 5 }}
                                whileTap={{ scale: 0.98 }}
                                className="flex justify-between items-center py-4 px-5 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 w-full text-gray-800 dark:text-gray-200 transition-all duration-300 font-semibold"
                                onClick={() => handleNavigation('/settings/follow-list')}
                                data-testid="button-following"
                            >
                                <span>{t('account.settings.following')}</span>
                                <ChevronRight className="w-5 h-5 text-pink-400" />
                            </motion.button>
                            <motion.button 
                                whileHover={{ scale: 1.01, x: 5 }}
                                whileTap={{ scale: 0.98 }}
                                className="flex justify-between items-center py-4 px-5 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 w-full text-gray-800 dark:text-gray-200 transition-all duration-300 font-semibold"
                                onClick={() => handleNavigation('/settings/blocked-users')}
                                data-testid="button-blocked-users"
                            >
                                <span>{t('account.settings.blockedUsers')}</span>
                                <ChevronRight className="w-5 h-5 text-pink-400" />
                            </motion.button>
                            <motion.button 
                                whileHover={{ scale: 1.01, x: 5 }}
                                whileTap={{ scale: 0.98 }}
                                className="flex justify-between items-center py-4 px-5 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 w-full text-gray-800 dark:text-gray-200 transition-all duration-300 font-semibold"
                                onClick={() => handleNavigation('/settings/personal-info')}
                                data-testid="button-personal-info"
                            >
                                <span>{t('account.settings.personalInfo')}</span>
                                <ChevronRight className="w-5 h-5 text-pink-400" />
                            </motion.button>
                            <motion.button 
                                whileHover={{ scale: 1.01, x: 5 }}
                                whileTap={{ scale: 0.98 }}
                                className="flex justify-between items-center py-4 px-5 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 w-full text-gray-800 dark:text-gray-200 transition-all duration-300 font-semibold"
                                onClick={() => handleNavigation('/settings/phone-verification')}
                                data-testid="button-phone-verification"
                            >
                                <span>{t('account.settings.phoneVerification')}</span>
                                <ChevronRight className="w-5 h-5 text-pink-400" />
                            </motion.button>
                            <motion.button 
                                whileHover={{ scale: 1.01, x: 5 }}
                                whileTap={{ scale: 0.98 }}
                                className="flex justify-between items-center py-4 px-5 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 w-full text-gray-800 dark:text-gray-200 transition-all duration-300 font-semibold"
                                onClick={() => handleNavigation('/settings/email-verification')}
                                data-testid="button-email-verification"
                            >
                                <span>{t('account.settings.emailVerification')}</span>
                                <ChevronRight className="w-5 h-5 text-pink-400" />
                            </motion.button>
                            <motion.button 
                                whileHover={{ scale: 1.01, x: 5 }}
                                whileTap={{ scale: 0.98 }}
                                className="flex justify-between items-center py-4 px-5 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 w-full text-gray-800 dark:text-gray-200 transition-all duration-300 font-semibold"
                                onClick={() => navigate('/settings/notifications')}
                                data-testid="button-notices"
                            >
                                <span>{t('account.settings.notices')}</span>
                                <ChevronRight className="w-5 h-5 text-pink-400" />
                            </motion.button>
                        </motion.div>
                    </div>

                    {/* About myfans Section */}
                    <div>
                        <div className="flex items-center mb-4 px-2">
                            <motion.div
                                animate={{ 
                                    y: [0, -3, 0],
                                }}
                                transition={{ 
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                    delay: 0.3
                                }}
                                className="w-8 h-8 bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg flex items-center justify-center mr-3 shadow-md"
                            >
                                <FileText className="w-4 h-4 text-white" />
                            </motion.div>
                            <h2 className="text-lg font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent">
                                {t('account.about.title')}
                            </h2>
                        </div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-pink-100 dark:border-gray-700 overflow-hidden divide-y divide-pink-50 dark:divide-gray-700"
                        >
                            <motion.button 
                                whileHover={{ scale: 1.01, x: 5 }}
                                whileTap={{ scale: 0.98 }}
                                className="flex justify-between items-center py-4 px-5 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 w-full text-gray-800 dark:text-gray-200 transition-all duration-300 font-semibold"
                                onClick={() => handleNavigation('/terms')}
                                data-testid="button-terms"
                            >
                                <span>{t('account.about.terms')}</span>
                                <ChevronRight className="w-5 h-5 text-pink-400" />
                            </motion.button>
                            <motion.button 
                                whileHover={{ scale: 1.01, x: 5 }}
                                whileTap={{ scale: 0.98 }}
                                className="flex justify-between items-center py-4 px-5 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 w-full text-gray-800 dark:text-gray-200 transition-all duration-300 font-semibold"
                                onClick={() => handleNavigation('/privacy')}
                                data-testid="button-privacy"
                            >
                                <span>{t('account.about.privacy')}</span>
                                <ChevronRight className="w-5 h-5 text-pink-400" />
                            </motion.button>
                            <motion.button 
                                whileHover={{ scale: 1.01, x: 5 }}
                                whileTap={{ scale: 0.98 }}
                                className="flex justify-between items-center py-4 px-5 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 w-full text-gray-800 dark:text-gray-200 transition-all duration-300 font-semibold"
                                onClick={() => handleNavigation('/legal')}
                                data-testid="button-legal"
                            >
                                <span>{t('account.about.legal')}</span>
                                <ChevronRight className="w-5 h-5 text-pink-400" />
                            </motion.button>
                            <motion.button 
                                whileHover={{ scale: 1.01, x: 5 }}
                                whileTap={{ scale: 0.98 }}
                                className="flex justify-between items-center py-4 px-5 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 w-full text-gray-800 dark:text-gray-200 transition-all duration-300 font-semibold"
                                onClick={() => handleNavigation('/guidelines')}
                                data-testid="button-guidelines"
                            >
                                <span>{t('account.about.guidelines')}</span>
                                <ChevronRight className="w-5 h-5 text-pink-400" />
                            </motion.button>
                            <motion.button 
                                whileHover={{ scale: 1.01, x: 5 }}
                                whileTap={{ scale: 0.98 }}
                                className="flex justify-between items-center py-4 px-5 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 w-full text-gray-800 dark:text-gray-200 transition-all duration-300 font-semibold"
                                onClick={() => handleNavigation('/settings/help')}
                                data-testid="button-help"
                            >
                                <span>{t('account.about.help')}</span>
                                <ChevronRight className="w-5 h-5 text-pink-400" />
                            </motion.button>
                        </motion.div>
                    </div>

                    {/* Other reasons Section */}
                    <div>
                        <div className="flex items-center mb-4 px-2">
                            <motion.div
                                animate={{ 
                                    y: [0, -3, 0],
                                }}
                                transition={{ 
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                    delay: 0.4
                                }}
                                className="w-8 h-8 bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg flex items-center justify-center mr-3 shadow-md"
                            >
                                <MoreHorizontal className="w-4 h-4 text-white" />
                            </motion.div>
                            <h2 className="text-lg font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent">
                                {t('account.other.title')}
                            </h2>
                        </div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-pink-100 dark:border-gray-700 overflow-hidden divide-y divide-pink-50 dark:divide-gray-700"
                        >
                            <motion.button 
                                whileHover={{ scale: 1.01, x: 5 }}
                                whileTap={{ scale: 0.98 }}
                                className="flex justify-between items-center py-4 px-5 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 w-full text-gray-800 dark:text-gray-200 transition-all duration-300 font-semibold"
                                onClick={() => handleNavigation('/switch-account')}
                                data-testid="button-switch-account"
                            >
                                <span>{t('account.other.switchAccount')}</span>
                                <ChevronRight className="w-5 h-5 text-pink-400" />
                            </motion.button>
                            <motion.button 
                                whileHover={{ scale: 1.01, x: 5 }}
                                whileTap={{ scale: 0.98 }}
                                className="flex justify-between items-center py-4 px-5 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 w-full text-gray-800 dark:text-gray-200 transition-all duration-300 font-semibold"
                                onClick={() => setShowLogoutModal(true)}
                                data-testid="button-logout"
                            >
                                <span>{t('account.other.logout')}</span>
                                <ChevronRight className="w-5 h-5 text-pink-400" />
                            </motion.button>
                        </motion.div>
                    </div>
                </div>
            </motion.div>

            {/* Floating Create Button */}
            <motion.button
                onClick={handleCreatePost}
                whileHover={{ scale: 1.1, y: -3 }}
                whileTap={{ scale: 0.9 }}
                animate={{ 
                    y: [0, -5, 0],
                }}
                transition={{ 
                    y: {
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }
                }}
                className="fixed bottom-24 right-6 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-2xl z-50 border-4 border-white"
                aria-label="Create new post"
                data-testid="button-create-post-float"
            >
                <Video className="w-7 h-7" />
            </motion.button>

            <AnimatePresence>
                {showLogoutModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                        onClick={() => setShowLogoutModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-white dark:bg-gray-800 rounded-3xl p-8 w-96 shadow-2xl border-2 border-pink-100 dark:border-gray-700"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <motion.div
                                animate={{ 
                                    rotate: [0, 10, -10, 0],
                                }}
                                transition={{ 
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                }}
                                className="w-16 h-16 bg-gradient-to-br from-pink-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl"
                            >
                                <Bell className="w-8 h-8 text-white" />
                            </motion.div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2 text-center">
                                {t('account.other.logoutConfirmTitle') || 'ログアウト'}
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-8 text-center">
                                {t('account.other.logoutConfirmText') || '本当にログアウトしますか？'}
                            </p>
                            <div className="flex gap-3">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setShowLogoutModal(false)}
                                    className="flex-1 px-4 py-3 text-base rounded-2xl text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 font-semibold"
                                    data-testid="button-cancel-logout"
                                >
                                    {t('account.other.cancel') || 'キャンセル'}
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleLogout}
                                    className="flex-1 px-4 py-3 text-base rounded-2xl bg-gradient-to-r from-pink-500 to-pink-600 text-white font-bold shadow-lg"
                                    data-testid="button-confirm-logout"
                                >
                                    {t('account.other.confirm') || 'ログアウト'}
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-white dark:bg-gray-800 rounded-3xl max-w-sm w-full p-8 shadow-2xl border-2 border-pink-100 dark:border-gray-700"
                        >
                            <motion.div
                                animate={{ 
                                    rotate: [0, 10, -10, 0],
                                }}
                                transition={{ 
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                }}
                                className="w-16 h-16 bg-gradient-to-br from-pink-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl"
                            >
                                <Crown className="w-8 h-8 text-white" />
                            </motion.div>
                            <p className="text-gray-800 dark:text-gray-100 font-bold mb-6 text-center text-lg">
                                クリエイターとして投稿するには登録が必要です
                            </p>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleRegisterModal}
                                className="bg-gradient-to-r from-pink-500 to-pink-600 text-white py-4 rounded-full w-full font-bold shadow-xl mb-3"
                                data-testid="button-register-creator-modal"
                            >
                                クリエイター登録
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleCreatePost}
                                className="bg-gray-100 text-gray-700 py-4 rounded-full w-full font-semibold border-2 border-gray-200"
                                data-testid="button-skip-modal"
                            >
                                スキップ
                            </motion.button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <BottomNavigationWithCreator active="account" />
        </>
    );

};

export default LoggedInAccountPage;
