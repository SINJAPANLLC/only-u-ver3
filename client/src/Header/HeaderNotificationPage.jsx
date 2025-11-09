import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Bell, CreditCard, Info, AlertCircle, CheckCircle, Gift, Star, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import BottomNavigationWithCreator from '../components/BottomNavigationWithCreator';
import { useNotification } from '../context/NotificationContext';

const NotificationPage = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('administration');
    const { t } = useTranslation();
    const { notifications, markAsRead, deleteNotification, markAllAsRead } = useNotification();

    const tabs = [
        { key: 'administration', label: t('notificationPage.tabs.administration') },
        { key: 'notices', label: t('notificationPage.tabs.notices') },
        { key: 'purchases', label: t('notificationPage.tabs.purchases') },
    ];

    // アイコンマッピング
    const iconMap = {
        AlertCircle,
        CreditCard,
        Info,
        Gift,
        CheckCircle,
        Star,
        Bell
    };

    // NotificationContextから通知を取得するため、ローカルの状態管理は不要
    // useEffectでサンプルデータを初期化する処理は削除
    // 以下のコードは削除されました（NotificationContextを使用）
    /*
    useEffect(() => {
        const savedNotifications = localStorage.getItem('notifications');
        if (savedNotifications) {
            setNotifications(JSON.parse(savedNotifications));
        } else {
            const sampleNotifications = [
                {
                    id: 1,
                    title: '【重要】購入手数料改定のお知らせ',
                    content: '2024年7月2日より、購入手数料が変更となります。詳細はこちらをご確認ください。',
                    date: '07/02',
                    time: '20:30',
                    unread: true,
                    type: 'administration',
                    iconType: 'AlertCircle',
                    priority: 'high'
                },
                {
                    id: 2,
                    title: 'クレジットカード決済使用時に遷移する決済システム画面について',
                    content: '決済画面の仕様変更に関するお知らせです。',
                    date: '05/30',
                    time: '14:30',
                    unread: false,
                    type: 'notices',
                    iconType: 'CreditCard',
                    priority: 'medium'
                },
                {
                    id: 3,
                    title: '利用通知の価格表記について',
                    content: '価格表示の仕様変更についてお知らせします。',
                    date: '05/30',
                    time: '14:30',
                    unread: true,
                    type: 'notices',
                    iconType: 'Info',
                    priority: 'medium'
                },
                {
                    id: 4,
                    title: 'プランのお支払い方法に「atone」がご利用いただけるようになりました',
                    content: '新しい決済方法「atone」が追加されました。',
                    date: '05/27',
                    time: '09:30',
                    unread: true,
                    type: 'purchases',
                    iconType: 'Gift',
                    priority: 'low'
                },
                {
                    id: 5,
                    title: '利用規約改定のお知らせ',
                    content: '利用規約が更新されました。最新版をご確認ください。',
                    date: '05/28',
                    time: '14:30',
                    unread: false,
                    type: 'notices',
                    iconType: 'CheckCircle',
                    priority: 'medium'
                },
                {
                    id: 6,
                    title: '【4/22更新】VISA・Mastercardのご利用再開のお知らせ',
                    content: 'クレジットカード決済が再開されました。',
                    date: '04/17',
                    time: '13:30',
                    unread: true,
                    type: 'purchases',
                    iconType: 'CreditCard',
                    priority: 'high'
                },
                {
                    id: 7,
                    title: '【4/22更新】Bitcashの導入とクレジットカードの一時停止のご案内',
                    content: 'Bitcash決済が導入されました。',
                    date: '04/16',
                    time: '08:45',
                    unread: true,
                    type: 'purchases',
                    iconType: 'CreditCard',
                    priority: 'medium'
                },
                {
                    id: 8,
                    title: '2025年3月に発生したサイト内での不正行為及び規約違反への対応について',
                    content: '不正行為への対応状況について報告いたします。',
                    date: '04/02',
                    time: '14:30',
                    unread: true,
                    type: 'administration',
                    iconType: 'AlertCircle',
                    priority: 'high'
                },
                {
                    id: 9,
                    title: '2025年2月に発生したサイト内での不正行為及び規約違反への対応について',
                    content: '前回の報告に続き、追加の対応状況をお知らせします。',
                    date: '03/04',
                    time: '11:30',
                    unread: true,
                    type: 'administration',
                    iconType: 'AlertCircle',
                    priority: 'medium'
                },
                {
                    id: 10,
                    title: '【重要】プラン更新再開のお知らせ ※3月18日追記',
                    content: 'プラン更新機能が再開されました。',
                    date: '03/18',
                    time: '11:30',
                    unread: false,
                    type: 'purchases',
                    iconType: 'Star',
                    priority: 'high'
                }
            ];
            setNotifications(sampleNotifications);
            localStorage.setItem('notifications', JSON.stringify(sampleNotifications));
        }
    }, []);

    // 通知をローカルストレージに保存
    const saveNotifications = (updatedNotifications) => {
        setNotifications(updatedNotifications);
        localStorage.setItem('notifications', JSON.stringify(updatedNotifications));
    };

    const handleNavigation = (path) => {
        if (path === 'home') navigate('/');
        else if (path === 'feed') navigate('/feed');
        else if (path === 'messages') navigate('/messages');
        else if (path === 'ranking') navigate('/live');
        else if (path === 'account') navigate('/account');
        else navigate('/');
    };

    // 通知をクリックした時の処理（既読にする）
    const handleNotificationClick = (notification) => {
        if (notification.unread) {
            const updatedNotifications = notifications.map(notif => 
                notif.id === notification.id 
                    ? { ...notif, unread: false }
                    : notif
            );
            saveNotifications(updatedNotifications);
        }
        
        // 通知の詳細を表示（モーダルや詳細ページに遷移）
        console.log('Notification clicked:', notification);
        // ここで詳細ページやモーダルを表示する処理を追加できます
    };

    // 通知を削除する処理
    const handleDeleteNotification = (notificationId, e) => {
        e.stopPropagation(); // 親要素のクリックイベントを防ぐ
        const updatedNotifications = notifications.filter(notif => notif.id !== notificationId);
        saveNotifications(updatedNotifications);
    };

    // すべての通知を削除する（NotificationContextを使用）
    const deleteAllNotifications = () => {
        if (window.confirm('すべての通知を削除しますか？')) {
            notifications.forEach(notif => deleteNotification(notif.id));
        }
    };

    // タブ別に通知をフィルタリング
    const getFilteredNotifications = () => {
        if (activeTab === 'administration') {
            return notifications.filter(notif => notif.type === 'administration');
        } else if (activeTab === 'notices') {
            return notifications.filter(notif => notif.type === 'notices');
        } else if (activeTab === 'purchases') {
            return notifications.filter(notif => notif.type === 'purchases');
        }
        return notifications;
    };

    // 未読通知の数を取得
    const getUnreadCount = (type = null) => {
        if (type) {
            return notifications.filter(notif => notif.type === type && notif.unread).length;
        }
        return notifications.filter(notif => notif.unread).length;
    };

    return (
        <>
            <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pb-20">
                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-white/95 backdrop-blur-md sticky top-0 z-10 border-b border-gray-200 shadow-sm">
                    <motion.button 
                        onClick={() => navigate(-1)} 
                        className="p-2.5 hover:bg-gradient-to-br hover:from-pink-50 hover:to-rose-50 rounded-full transition-all group"
                        whileHover={{ scale: 1.1, rotate: -10 }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <ArrowLeft size={20} className="text-gray-600 group-hover:text-pink-500 transition-colors" strokeWidth={2.5} />
                    </motion.button>
                    <div className="flex items-center gap-2">
                        <motion.h1 
                            className="text-base font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent"
                            animate={{ opacity: [0.8, 1, 0.8] }}
                            transition={{ duration: 3, repeat: Infinity }}
                        >
                            {t('notificationPage.title')}
                        </motion.h1>
                        {getUnreadCount() > 0 && (
                            <motion.span 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="bg-gradient-to-br from-red-400 to-red-600 text-white text-xs rounded-full px-2 py-1 font-bold shadow-md"
                            >
                                {getUnreadCount()}
                            </motion.span>
                        )}
                    </div>
                    <motion.button 
                        onClick={deleteAllNotifications}
                        className="p-2.5 hover:bg-gradient-to-br hover:from-pink-50 hover:to-rose-50 rounded-full transition-all group"
                        title="すべて削除"
                        whileHover={{ scale: 1.1, rotate: 10 }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <Trash2 size={20} className="text-gray-600 group-hover:text-pink-500 transition-colors" strokeWidth={2.5} />
                    </motion.button>
                </div>

                {/* Tab Pills */}
                <div className="px-4 py-4">
                    <div className="flex bg-gray-100 rounded-full p-1.5 shadow-inner">
                        {tabs.map((tab) => (
                            <motion.button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex-1 py-2.5 px-3 rounded-full text-xs font-bold transition-all duration-200 relative ${activeTab === tab.key
                                    ? 'text-white shadow-lg'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                {activeTab === tab.key && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute inset-0 bg-gradient-to-br from-pink-400 to-pink-600 rounded-full"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                                <span className="relative z-10">{tab.label}</span>
                                {getUnreadCount(tab.key) > 0 && (
                                    <motion.span 
                                        initial={{ scale: 0 }}
                                        animate={{ scale: [1, 1.2, 1] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                        className="absolute -top-1 -right-1 bg-gradient-to-br from-red-400 to-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shadow-md z-20"
                                    >
                                        {getUnreadCount(tab.key)}
                                    </motion.span>
                                )}
                            </motion.button>
                        ))}
                    </div>
                </div>

                {/* アクションボタン */}
                <div className="px-4 pb-2">
                    <div className="flex justify-between items-center">
                        <motion.button
                            onClick={markAllAsRead}
                            disabled={getUnreadCount() === 0}
                            className="text-sm font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent disabled:bg-none disabled:text-gray-400 disabled:cursor-not-allowed"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            すべて既読にする
                        </motion.button>
                        <motion.span 
                            className="text-sm font-medium text-gray-600"
                            animate={{ opacity: [0.7, 1, 0.7] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            {getFilteredNotifications().length}件の通知
                        </motion.span>
                    </div>
                </div>

                {/* Notifications List */}
                <div className="px-4">
                    <AnimatePresence mode="popLayout">
                        {getFilteredNotifications().length === 0 ? (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="text-center py-12"
                            >
                                <motion.div
                                    animate={{ 
                                        y: [0, -10, 0],
                                        rotate: [0, 5, 0, -5, 0]
                                    }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                >
                                    <Bell size={48} className="mx-auto text-gray-300 mb-4" />
                                </motion.div>
                                <p className="text-gray-500 text-sm font-medium">
                                    {activeTab === 'administration' && '事務局からの通知はありません'}
                                    {activeTab === 'notices' && 'お知らせはありません'}
                                    {activeTab === 'purchases' && '購入・売上に関する通知はありません'}
                                </p>
                            </motion.div>
                        ) : (
                            getFilteredNotifications().map((notification, index) => {
                                const IconComponent = iconMap[notification.iconType] || Bell;
                                return (
                                    <motion.div
                                        key={notification.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        transition={{ duration: 0.3, delay: index * 0.05 }}
                                        layout
                                        onClick={() => handleNotificationClick(notification)}
                                        className={`flex items-start py-4 px-3 border-b border-gray-100 last:border-b-0 cursor-pointer rounded-lg transition-all duration-200 ${
                                            notification.unread ? 'bg-gradient-to-r from-pink-50/50 to-blue-50/50' : 'hover:bg-gray-50'
                                        }`}
                                        whileHover={{ scale: 1.01, x: 5 }}
                                        whileTap={{ scale: 0.99 }}
                                    >
                                        {/* Icon with priority indicator */}
                                        <div className="relative flex-shrink-0 mr-3">
                                            <motion.div 
                                                className={`w-11 h-11 rounded-full flex items-center justify-center shadow-md ${
                                                    notification.priority === 'high' ? 'bg-gradient-to-br from-red-400 to-red-600' :
                                                    notification.priority === 'medium' ? 'bg-gradient-to-br from-yellow-400 to-orange-500' : 
                                                    'bg-gradient-to-br from-blue-400 to-blue-600'
                                                }`}
                                                animate={notification.unread ? { 
                                                    rotate: [0, -5, 5, -5, 0],
                                                    scale: [1, 1.05, 1]
                                                } : {}}
                                                transition={{ duration: 2, repeat: Infinity }}
                                            >
                                                <IconComponent size={20} className="text-white" strokeWidth={2.5} />
                                            </motion.div>
                                            {notification.unread && (
                                                <motion.div 
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: [1, 1.3, 1] }}
                                                    transition={{ duration: 2, repeat: Infinity }}
                                                    className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gradient-to-br from-red-400 to-red-600 rounded-full shadow-md"
                                                />
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <p className={`text-sm leading-relaxed pr-2 font-bold ${
                                                        notification.unread ? 'bg-gradient-to-r from-pink-600 to-pink-700 bg-clip-text text-transparent' : 'text-gray-700'
                                                    }`}>
                                                        {notification.title}
                                                    </p>
                                                    <p className="text-xs text-gray-600 mt-1.5 line-clamp-2 font-medium">
                                                        {notification.content}
                                                    </p>
                                                </div>
                                                <motion.button
                                                    onClick={(e) => handleDeleteNotification(notification.id, e)}
                                                    className="ml-2 p-1.5 text-gray-400 hover:bg-red-50 rounded-full transition-colors"
                                                    title="削除"
                                                    whileHover={{ scale: 1.2, rotate: 10 }}
                                                    whileTap={{ scale: 0.9 }}
                                                >
                                                    <Trash2 size={14} className="hover:text-red-500" strokeWidth={2.5} />
                                                </motion.button>
                                            </div>
                                        </div>

                                        {/* Date & Time */}
                                        <div className="flex flex-col items-end ml-2 flex-shrink-0">
                                            <span className="text-xs text-gray-500 mb-1 font-medium">
                                                {notification.date}
                                            </span>
                                            <span className="text-xs text-gray-400 mb-2">
                                                {notification.time}
                                            </span>
                                            {notification.unread && (
                                                <motion.div 
                                                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                                                    transition={{ duration: 2, repeat: Infinity }}
                                                    className="w-2 h-2 bg-gradient-to-br from-red-400 to-red-600 rounded-full shadow-sm"
                                                />
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <BottomNavigationWithCreator active="messages" />
        </>
    );
};

export default NotificationPage;
