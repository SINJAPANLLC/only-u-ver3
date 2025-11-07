import React from "react";
import { Home, Star, Crown, User, MessageCircle, Plus, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUnreadMessages } from "../context/UnreadMessagesContext";
import { useCreator } from "../context/CreatorContext";

const BottomNavigationWithCreator = ({ active = "Home" }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { unreadCount } = useUnreadMessages();
    const { canCreatePosts, canAccessDashboard } = useCreator();

    // 基本のナビゲーション項目
    const baseItems = [
        { icon: Home, key: "home", onClick: () => navigate("/") },
        { icon: Star, key: "feed", onClick: () => navigate("/feed") },
        { icon: Crown, key: "ranking", onClick: () => navigate("/rankingpage") },
        { icon: MessageCircle, key: "messages", onClick: () => navigate("/messages") },
        { icon: User, key: "account", onClick: () => navigate("/account") },
    ];

    // クリエイター用の追加項目
    const creatorItems = [
        { icon: Plus, key: "create", onClick: () => navigate("/create-post") },
        { icon: BarChart3, key: "dashboard", onClick: () => navigate("/creator-dashboard") },
    ];

    // クリエイターが承認されている場合のみ追加項目を含める
    const items = canCreatePosts ? [...baseItems, ...creatorItems] : baseItems;

    return (
        <nav className="fixed bottom-0 left-0 right-0 glass-effect dark:bg-black/95 border-t border-white/30 dark:border-gray-800/50 z-50 shadow-elevated transition-colors duration-200 pb-safe mb-2">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-around py-2 px-1">
                    {items.map((item) => {
                        const isActive = active.toLowerCase() === item.key;
                        
                        return (
                            <motion.button
                                key={item.key}
                                onClick={item.onClick}
                                whileTap={{ scale: 0.9 }}
                                className="flex flex-col items-center justify-center transition-all duration-200 relative min-w-[50px]"
                                data-testid={`nav-${item.key}`}
                            >
                                <motion.div 
                                    className="relative mb-0.5"
                                    whileHover={{ scale: 1.1 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <motion.div
                                        className={`p-1.5 rounded-full transition-all duration-300 ${
                                            isActive 
                                                ? "bg-gradient-to-r from-pink-400 to-pink-500" 
                                                : "bg-transparent"
                                        }`}
                                        animate={isActive ? {
                                            boxShadow: "0 2px 8px rgba(236, 72, 153, 0.3)"
                                        } : {}}
                                    >
                                        <item.icon 
                                            size={20} 
                                            strokeWidth={2} 
                                            className={`${
                                                isActive ? "text-white" : "text-gray-400"
                                            }`}
                                        />
                                    </motion.div>
                                    
                                    {/* Show unread count badge for messages */}
                                    {item.key === "messages" && unreadCount > 0 && (
                                        <motion.div 
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold border-2 border-white"
                                        >
                                            {unreadCount > 99 ? '99+' : unreadCount}
                                        </motion.div>
                                    )}
                                    {/* Show special badge for creator features */}
                                    {item.key === "create" && canCreatePosts && (
                                        <motion.div 
                                            animate={{ scale: [1, 1.2, 1] }}
                                            transition={{ duration: 2, repeat: Infinity }}
                                            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-pink-500 rounded-full border-2 border-white"
                                        />
                                    )}
                                    {item.key === "dashboard" && canAccessDashboard && (
                                        <motion.div 
                                            animate={{ scale: [1, 1.2, 1] }}
                                            transition={{ duration: 2, repeat: Infinity }}
                                            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-purple-500 rounded-full border-2 border-white"
                                        />
                                    )}
                                </motion.div>
                                <span 
                                    className={`text-[9px] font-medium text-center transition-colors duration-200 whitespace-nowrap ${
                                        isActive ? "text-pink-500" : "text-gray-400"
                                    }`}
                                >
                                    {t(`navigation.${item.key}`)}
                                </span>
                            </motion.button>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
};

export default BottomNavigationWithCreator;
