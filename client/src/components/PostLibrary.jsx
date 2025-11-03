import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, BookmarkCheck, HeartHandshake, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUserStats } from '../context/UserStatsContext';


const PostLibrary = ({ likedItems }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { stats } = useUserStats();
    
    const postStats = [
        {
            icon: ShoppingBag,
            label: t("postLibrary.purchased"),
            count: stats.purchased,
            key: 'purchased',
            gradient: 'from-pink-400 to-pink-600',
            iconColor: 'text-pink-600'
        },
        {
            icon: BookmarkCheck,
            label: t("postLibrary.saved"),
            count: stats.saved,
            key: 'saved',
            gradient: 'from-pink-500 to-rose-500',
            iconColor: 'text-pink-600'
        },
        {
            icon: HeartHandshake,
            label: t("postLibrary.liked"),
            count: stats.liked,
            key: 'liked',
            gradient: 'from-rose-400 to-pink-600',
            iconColor: 'text-pink-600'
        },
        {
            icon: History,
            label: t("postLibrary.viewingHistory"),
            count: stats.viewingHistory,
            key: 'viewingHistory',
            gradient: 'from-pink-500 to-purple-500',
            iconColor: 'text-pink-600'
        }
    ];

    const handleNavigation = (key, label) => {
        // Pass both key and label in state
        navigate('/added-content', {
            state: {
                activeTab: key,
                buttonName: label
            }
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-8 sm:mb-12"
        >
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 sm:mb-6 flex items-center">
                <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className="mr-2 p-1.5 rounded-lg bg-gradient-to-br from-pink-400 to-pink-600 shadow-md"
                >
                    <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-white" strokeWidth={2.5} />
                </motion.div>
                {t('postLibrary.title')}
            </h2>

            {/* Mobile View - Single Row */}
            <div className="grid grid-cols-4 gap-3 sm:gap-6 md:hidden">
                {postStats.map((stat, index) => {
                    const IconComponent = stat.icon;
                    return (
                        <motion.div
                            key={stat.label}
                            data-testid={`post-stat-${stat.key}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 + 0.6 }}
                            whileHover={{ scale: 1.05, y: -5 }}
                            whileTap={{ scale: 0.95 }}
                            className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center border border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 transition-all shadow-sm hover:shadow-lg group cursor-pointer"
                            onClick={() => handleNavigation(stat.key, stat.label)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleNavigation(stat.key);
                                }
                            }}
                        >
                            <motion.div
                                whileHover={{ scale: 1.15, rotate: 5 }}
                                className={`w-10 h-10 mx-auto mb-2 rounded-2xl flex items-center justify-center bg-gradient-to-br ${stat.gradient} shadow-md group-hover:shadow-xl transition-all`}
                            >
                                <IconComponent className="w-5 h-5 text-white drop-shadow-md" strokeWidth={2.5} />
                            </motion.div>
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 line-clamp-2">{stat.label}</p>
                            <p className={`text-lg font-black ${stat.count > 0 ? stat.iconColor : 'text-gray-400'} drop-shadow-sm`}>
                                {stat.count}
                            </p>
                        </motion.div>
                    );
                })}
            </div>

            {/* Desktop View - Grid */}
            <div className="hidden md:grid md:grid-cols-4 gap-6">
                {postStats.map((stat, index) => {
                    const IconComponent = stat.icon;
                    return (
                        <motion.div
                            key={stat.label}
                            data-testid={`post-stat-${stat.key}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 + 0.6 }}
                            whileHover={{ scale: 1.05, y: -5 }}
                            whileTap={{ scale: 0.95 }}
                            className="bg-white dark:bg-gray-800 rounded-2xl p-6 text-center border border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 transition-all shadow-sm hover:shadow-xl group cursor-pointer"
                            onClick={() => handleNavigation(stat.key, stat.label)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleNavigation(stat.key);
                                }
                            }}
                        >
                            <motion.div
                                whileHover={{ scale: 1.15, rotate: 5 }}
                                className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-gradient-to-br ${stat.gradient} shadow-lg group-hover:shadow-2xl transition-all`}
                            >
                                <IconComponent className="w-8 h-8 text-white drop-shadow-lg" strokeWidth={2.5} />
                            </motion.div>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{stat.label}</p>
                            <p className={`text-3xl font-black ${stat.count > 0 ? stat.iconColor : 'text-gray-400'} drop-shadow-md`}>
                                {stat.count}
                            </p>
                        </motion.div>
                    );
                })}
            </div>
        </motion.div>
    );
};

export default PostLibrary;
