import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Creator from './Ranking/Creators';
import RankingPosts from './Ranking/Posts';
import BottomNavigationWithCreator from '../BottomNavigationWithCreator';
import { useTranslation } from 'react-i18next';

const RankingPage = () => {
    const [activeTab, setActiveTab] = useState('Post');
    const [activeTimeFilter, setActiveTimeFilter] = useState('Daily');
    const [activeTagFilter, setActiveTagFilter] = useState('all');
    const { t } = useTranslation();

    const tabs = [
        { id: 'Post', label: t('rankingPage.tabs.post') },
        { id: 'Creator', label: t('rankingPage.tabs.creator') },
    ];
    const timeFilters = [
        { id: 'Daily', label: t('rankingPage.time.daily') },
        { id: 'Weekly', label: t('rankingPage.time.weekly') },
        { id: 'Monthly', label: t('rankingPage.time.monthly') },
        { id: 'AllTime', label: t('rankingPage.time.allTime') },
    ];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black pb-20">
            {/* ---------------- Header Tabs ---------------- */}
            <div className="bg-white dark:bg-black border-b border-gray-100 dark:border-gray-800 sticky top-0 z-50 shadow-sm dark:shadow-gray-900">
                <div className="max-w-6xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-center space-x-8">
                        {tabs.map((tab) => (
                            <motion.button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                whileTap={{ scale: 0.95 }}
                                className={`relative text-base sm:text-lg font-bold transition-all pb-2 ${
                                    activeTab === tab.id 
                                        ? 'bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent' 
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                            >
                                {tab.label}
                                {activeTab === tab.id && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 to-pink-600 rounded-full"
                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    />
                                )}
                            </motion.button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ---------------- Time Filter Tabs ---------------- */}
            <div className="bg-white dark:bg-black border-b border-gray-100 dark:border-gray-800 sticky top-14 z-40 shadow-sm dark:shadow-gray-900">
                <div className="max-w-6xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-center space-x-2 overflow-x-auto">
                        {timeFilters.map((filter, index) => (
                            <motion.button
                                key={filter.id}
                                onClick={() => setActiveTimeFilter(filter.id)}
                                whileTap={{ scale: 0.95 }}
                                whileHover={{ scale: 1.05 }}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className={`flex-shrink-0 px-5 py-2 rounded-full text-sm font-bold transition-all ${
                                    activeTimeFilter === filter.id
                                        ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-lg shadow-pink-200'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                            >
                                {filter.label}
                            </motion.button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ---------------- Tab Content ---------------- */}
            <div className="pt-0">
                {activeTab === 'Post' && (
                    <div className="max-w-6xl mx-auto px-2 sm:px-4 pt-4">
                        <RankingPosts activeTimeFilter={activeTimeFilter} activeTagFilter={activeTagFilter} />
                    </div>
                )}
                {activeTab === 'Creator' && (
                    <div className="max-w-6xl mx-auto px-2 sm:px-4 pt-4">
                        <Creator activeTimeFilter={activeTimeFilter} />
                    </div>
                )}
            </div>

            {/* ---------------- Bottom Navigation ---------------- */}
            <BottomNavigationWithCreator active="ranking" />
        </div>
    );
};

export default RankingPage;
