import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, FileText, MoreHorizontal, ChevronRight, Users, LogOut, Shield, Bell, CreditCard, User, Sparkles, Star, Crown, DollarSign, History, Tag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNavigationWithCreator from '../BottomNavigationWithCreator';
import { t } from 'i18next';

const AccountPage = () => {
    const navigate = useNavigate();

    const [showModal, setShowModal] = React.useState(false);

    const handleCancel = () => {
        setShowModal(true);
    }
    const handleRegisterModal = () => {
        setShowModal(true);
    }
    const handleNavigation = (path) => {
        if (path === 'home') {
            navigate('/');
        } else if (path === 'feed') {
            navigate('/feed');
        } else if (path === 'messages') {
            navigate('/messages');
        } else if (path === 'ranking') {
            navigate('/rankingpage');
        } else if (path === 'account') {
            navigate('/account');
        } else {
            navigate('/');
        }
    };

    const handleCreatePost = () => {
        navigate('/create-post');
    };

    const menuSections = [
        {
            icon: User,
            title: 'アカウント設定',
            items: [
                { label: '設定', path: '/settings', icon: Settings },
                { label: 'アカウントを切り替える', path: '/switch-account', icon: Users }
            ]
        },
        {
            icon: DollarSign,
            title: 'サービス・プラン',
            items: [
                { label: '加入中のプラン', path: '/current-plan', icon: Sparkles },
                { label: '購入履歴', path: '/purchase-history', icon: History },
                { label: 'クーポン一覧', path: '/coupons', icon: Tag }
            ]
        },
        {
            icon: Shield,
            title: 'プライバシー・セキュリティ',
            items: [
                { label: 'Terms of Use', path: '/terms', icon: FileText },
                { label: 'Privacy Policy', path: '/privacy', icon: Shield },
                { label: 'Legal Notice', path: '/legal', icon: FileText },
                { label: 'Content Guidelines', path: '/guidelines', icon: FileText }
            ]
        },
        {
            icon: Bell,
            title: 'サポート',
            items: [
                { label: 'Help', path: '/settings/help', icon: Bell }
            ]
        }
    ];

    return (
        <>
            <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 dark:from-gray-900 dark:via-black dark:to-gray-900 pb-24">
                {/* Header with gradient */}
                <div className="relative bg-gradient-to-r from-pink-500 to-pink-600 pt-12 pb-32 px-6 overflow-hidden">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="relative z-10"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center space-x-3">
                                <motion.div
                                    animate={{ 
                                        rotate: [0, 10, -10, 0],
                                        y: [0, -5, 0]
                                    }}
                                    transition={{ 
                                        duration: 4,
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                    }}
                                    className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border-2 border-white/30 shadow-2xl"
                                >
                                    <Crown className="w-8 h-8 text-white" />
                                </motion.div>
                                <div>
                                    <h1 className="text-white text-3xl font-bold mb-1">アカウント</h1>
                                    <p className="text-white/90 text-sm font-medium">設定とプライバシー管理</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                    
                    {/* Decorative animated circles */}
                    <motion.div
                        animate={{ 
                            scale: [1, 1.2, 1],
                            opacity: [0.3, 0.5, 0.3]
                        }}
                        transition={{ 
                            duration: 4,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full blur-3xl"
                    />
                    <motion.div
                        animate={{ 
                            scale: [1, 1.3, 1],
                            opacity: [0.2, 0.4, 0.2]
                        }}
                        transition={{ 
                            duration: 5,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: 0.5
                        }}
                        className="absolute bottom-0 left-0 w-48 h-48 bg-purple-400/30 rounded-full blur-3xl"
                    />
                    
                    {/* Floating sparkles */}
                    <motion.div
                        animate={{ 
                            y: [0, -20, 0],
                            rotate: [0, 180, 360]
                        }}
                        transition={{ 
                            duration: 6,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="absolute top-20 right-20 text-white/30"
                    >
                        <Sparkles className="w-8 h-8" />
                    </motion.div>
                    <motion.div
                        animate={{ 
                            y: [0, -15, 0],
                            rotate: [0, -180, -360]
                        }}
                        transition={{ 
                            duration: 5,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: 1
                        }}
                        className="absolute bottom-32 left-10 text-white/20"
                    >
                        <Star className="w-6 h-6" />
                    </motion.div>
                </div>

                <div className="px-6 -mt-20 space-y-6 relative z-10">
                    {/* Notification Banners */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        whileHover={{ scale: 1.02, y: -2 }}
                        onClick={() => navigate('/payment-methods')}
                        className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-xl border-2 border-pink-100 dark:border-gray-700 cursor-pointer"
                        data-testid="banner-payment"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <motion.div
                                    animate={{ 
                                        y: [0, -3, 0],
                                    }}
                                    transition={{ 
                                        duration: 2,
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                    }}
                                    className="w-12 h-12 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg"
                                >
                                    <CreditCard className="w-6 h-6 text-white" />
                                </motion.div>
                                <p className="text-base text-gray-800 dark:text-gray-200 font-semibold">
                                    {t('AccountPage.paymenttitle')}
                                </p>
                            </div>
                            <ChevronRight className="w-6 h-6 text-pink-500" />
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        whileHover={{ scale: 1.02, y: -2 }}
                        onClick={() => navigate('/settings/notifications')}
                        className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-xl border-2 border-pink-100 dark:border-gray-700 cursor-pointer"
                        data-testid="banner-notice"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <motion.div
                                    animate={{ 
                                        rotate: [0, -10, 10, 0],
                                    }}
                                    transition={{ 
                                        duration: 3,
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                    }}
                                    className="w-12 h-12 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg"
                                >
                                    <Bell className="w-6 h-6 text-white" />
                                </motion.div>
                                <p className="text-base text-gray-800 dark:text-gray-200 font-semibold">
                                    {t('AccountPage.noticeterm')}
                                </p>
                            </div>
                            <ChevronRight className="w-6 h-6 text-pink-500" />
                        </div>
                    </motion.div>

                    {/* Menu Sections */}
                    {menuSections.map((section, sectionIndex) => (
                        <motion.div
                            key={sectionIndex}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 + sectionIndex * 0.1 }}
                        >
                            <div className="flex items-center mb-4 px-2">
                                <motion.div
                                    animate={{ 
                                        y: [0, -2, 0],
                                    }}
                                    transition={{ 
                                        duration: 2,
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                        delay: sectionIndex * 0.2
                                    }}
                                    className="w-8 h-8 bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg flex items-center justify-center mr-3 shadow-md"
                                >
                                    <section.icon className="w-4 h-4 text-white" />
                                </motion.div>
                                <h2 className="text-lg font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent">
                                    {section.title}
                                </h2>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-pink-100 dark:border-gray-700 overflow-hidden">
                                {section.items.map((item, itemIndex) => (
                                    <motion.button
                                        key={itemIndex}
                                        whileHover={{ scale: 1.01, x: 5 }}
                                        whileTap={{ scale: 0.98 }}
                                        className={`w-full px-6 py-4 flex justify-between items-center text-gray-800 dark:text-gray-200 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 transition-all duration-300 ${
                                            itemIndex !== section.items.length - 1 ? 'border-b border-pink-50' : ''
                                        }`}
                                        onClick={() => navigate(item.path)}
                                        data-testid={`menu-item-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                                    >
                                        <div className="flex items-center space-x-4">
                                            <div className="w-10 h-10 bg-gradient-to-br from-pink-100 to-purple-100 rounded-xl flex items-center justify-center">
                                                <item.icon className="w-5 h-5 text-pink-500" />
                                            </div>
                                            <span className="font-semibold text-base">{item.label}</span>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-pink-400" />
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    ))}

                    {/* Logout Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                    >
                        <div className="flex items-center mb-4 px-2">
                            <motion.div
                                animate={{ 
                                    y: [0, -2, 0],
                                }}
                                transition={{ 
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                }}
                                className="w-8 h-8 bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg flex items-center justify-center mr-3 shadow-md"
                            >
                                <LogOut className="w-4 h-4 text-white" />
                            </motion.div>
                            <h2 className="text-lg font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent">
                                その他
                            </h2>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-pink-100 dark:border-gray-700 overflow-hidden">
                            <motion.button
                                whileHover={{ scale: 1.01, x: 5 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full px-6 py-4 flex justify-between items-center text-gray-800 dark:text-gray-200 hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-700 transition-all duration-300"
                                onClick={() => navigate('/login')}
                                data-testid="button-login"
                            >
                                <div className="flex items-center space-x-4">
                                    <div className="w-10 h-10 bg-gradient-to-br from-pink-100 to-purple-100 rounded-xl flex items-center justify-center">
                                        <LogOut className="w-5 h-5 text-pink-500" />
                                    </div>
                                    <span className="font-semibold text-base">Log in</span>
                                </div>
                                <ChevronRight className="w-5 h-5 text-pink-400" />
                            </motion.button>
                        </div>
                    </motion.div>

                    {/* Premium Banner */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        whileHover={{ scale: 1.02, y: -2 }}
                        onClick={() => navigate('/premium')}
                        className="bg-gradient-to-r from-pink-500 to-pink-600 rounded-2xl p-6 shadow-2xl border-2 border-pink-300 cursor-pointer overflow-hidden relative"
                        data-testid="banner-premium"
                    >
                        <motion.div
                            animate={{ 
                                rotate: [0, 360],
                            }}
                            transition={{ 
                                duration: 20,
                                repeat: Infinity,
                                ease: "linear"
                            }}
                            className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"
                        />
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-3">
                                    <motion.div
                                        animate={{ 
                                            y: [0, -5, 0],
                                            rotate: [0, 10, -10, 0]
                                        }}
                                        transition={{ 
                                            duration: 3,
                                            repeat: Infinity,
                                            ease: "easeInOut"
                                        }}
                                    >
                                        <Crown className="w-8 h-8 text-yellow-300" />
                                    </motion.div>
                                    <h3 className="text-white text-xl font-bold">プレミアムプラン</h3>
                                </div>
                                <Sparkles className="w-6 h-6 text-yellow-300" />
                            </div>
                            <p className="text-white/90 text-sm mb-4 leading-relaxed">
                                限定機能を解放して、より多くのファンとつながりましょう
                            </p>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="bg-white text-pink-600 px-6 py-3 rounded-full font-bold text-sm shadow-lg w-full"
                            >
                                詳細を見る
                            </motion.button>
                        </div>
                    </motion.div>
                </div>
            </div>

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
                data-testid="button-create-float"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke="currentColor"
                    className="w-7 h-7"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                    />
                </svg>
            </motion.button>

            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                        onClick={() => setShowModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-white dark:bg-gray-800 rounded-3xl max-w-sm w-full p-8 shadow-2xl border-2 border-pink-100 dark:border-gray-700"
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
                                <Crown className="w-8 h-8 text-white" />
                            </motion.div>
                            <p className="text-gray-800 dark:text-gray-200 font-bold mb-6 text-center text-lg leading-relaxed">
                                クリエイターとして投稿するには<br />登録が必要です
                            </p>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => navigate('/register-creator')}
                                className="bg-gradient-to-r from-pink-500 to-pink-600 text-white py-4 rounded-full w-full font-bold shadow-xl mb-3 text-base"
                                data-testid="button-register-creator"
                            >
                                クリエイター登録
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleCreatePost}
                                className="bg-gray-100 text-gray-700 py-4 rounded-full w-full font-semibold border-2 border-gray-200 text-base"
                                data-testid="button-skip"
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

export default AccountPage;
