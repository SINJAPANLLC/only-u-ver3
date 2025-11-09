import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, Crown, UserPlus, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { db } from '../firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

const CreatorPage = () => {
    const [followingCreators, setFollowingCreators] = useState(new Set());
    const [creators, setCreators] = useState([]);
    const [loading, setLoading] = useState(true);

    const navigate = useNavigate();
    const { t } = useTranslation();
    
    // Firestoreから承認されたクリエイターを取得
    useEffect(() => {
        const fetchCreators = async () => {
            setLoading(true);
            try {
                const usersQuery = query(
                    collection(db, 'users'),
                    where('isCreator', '==', true),
                    where('creatorStatus', '==', 'approved'),
                    limit(10)
                );
                
                const querySnapshot = await getDocs(usersQuery);
                const fetchedCreators = [];
                
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    fetchedCreators.push({
                        id: doc.id,
                        name: data.displayName || data.name || '名無しさん',
                        likes: formatNumber(data.totalLikes || 0),
                        followers: formatNumber(data.followers || 0),
                        isVerified: data.isCreator && data.creatorStatus === 'approved',
                        avatar: data.photoURL || data.avatar || null
                    });
                });
                
                console.log(`✅ Fetched ${fetchedCreators.length} approved creators`);
                setCreators(fetchedCreators);
            } catch (error) {
                console.error('Error fetching creators:', error);
                setCreators([]);
            } finally {
                setLoading(false);
            }
        };

        fetchCreators();
    }, []);

    // 数値をフォーマット（例: 1234 → 1.2K）
    const formatNumber = (num) => {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    };

    const toggleFollow = (creatorId) => {
        setFollowingCreators(prev => {
            const newSet = new Set(prev);
            if (newSet.has(creatorId)) {
                newSet.delete(creatorId);
            } else {
                newSet.add(creatorId);
            }
            return newSet;
        });
    };

    // ランキングバッジの色を取得
    const getRankBadgeColor = (rank) => {
        // すべてピンクのグラデーション
        return "bg-gradient-to-br from-pink-400 to-pink-600 text-white";
    };

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

    if (loading) {
        return (
            <div className="mb-12">
                <div className="max-w-4xl mx-auto space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700 animate-pulse">
                            <div className="flex items-center gap-2.5">
                                <div className="w-11 h-11 rounded-full bg-gray-200" />
                                <div className="w-11 h-11 rounded-full bg-gray-200" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                                </div>
                                <div className="w-20 h-8 bg-gray-200 rounded-full" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (creators.length === 0) {
        return (
            <div className="mb-12">
                <div className="max-w-4xl mx-auto text-center py-8 text-gray-500 dark:text-gray-400">
                    承認されたクリエイターがいません
                </div>
            </div>
        );
    }

    return (
        <div className="mb-12">
            {/* Creator List */}
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="max-w-4xl mx-auto"
            >
                <div className="space-y-3">
                    {creators.map((creator, index) => {
                        const isFollowing = followingCreators.has(creator.id);

                        return (
                            <motion.div
                                key={creator.id}
                                variants={itemVariants}
                                whileHover={{ scale: 1.005 }}
                                className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700 hover:shadow-sm transition-all"
                                data-testid={`creator-card-${creator.id}`}
                            >
                                <div className="flex items-center gap-2.5">
                                    {/* ランキングバッジ - 数字表示 */}
                                    <motion.div 
                                        whileHover={{ scale: 1.15, rotate: 5 }}
                                        className={`w-11 h-11 rounded-full ${getRankBadgeColor(index + 1)} flex items-center justify-center flex-shrink-0`}
                                        style={{ boxShadow: '0 4px 12px rgba(236, 72, 153, 0.4)' }}
                                    >
                                        <span className="text-sm font-black drop-shadow-md">{index + 1}</span>
                                    </motion.div>

                                    {/* アバターと認証マーク */}
                                    <div 
                                        className="relative flex-shrink-0 cursor-pointer"
                                        onClick={() => navigate(`/creator-profile/${creator.id}`)}
                                    >
                                        {creator.avatar ? (
                                            <img
                                                src={creator.avatar}
                                                alt={creator.name}
                                                className="w-11 h-11 rounded-full object-cover hover:opacity-80 transition-opacity ring-2 ring-pink-100"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.nextSibling.style.display = 'flex';
                                                }}
                                            />
                                        ) : null}
                                        <div 
                                            className={`w-11 h-11 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center text-white font-bold text-lg ring-2 ring-pink-100 ${creator.avatar ? 'hidden' : 'flex'}`}
                                            style={{ display: creator.avatar ? 'none' : 'flex' }}
                                        >
                                            {creator.name.charAt(0).toUpperCase()}
                                        </div>
                                        {creator.isVerified && (
                                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white">
                                                <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                                            </div>
                                        )}
                                    </div>

                                    {/* クリエイター情報 */}
                                    <div className="flex-1 min-w-0">
                                        <h3 
                                            className="font-medium text-gray-800 dark:text-gray-100 text-sm truncate mb-0.5 leading-tight cursor-pointer hover:text-pink-600 transition-colors"
                                            onClick={() => navigate(`/creator-profile/${creator.id}`)}
                                        >
                                            {creator.name}
                                        </h3>

                                        <div className="flex items-center gap-2 text-xs">
                                            <div className="flex items-center gap-0.5 text-pink-500">
                                                <Heart size={12} className="fill-current drop-shadow-sm" strokeWidth={2.5} />
                                                <span className="font-semibold">{creator.likes}</span>
                                            </div>
                                            <div className="text-gray-400">
                                                {creator.followers} {t('creatorPage.followers')}
                                            </div>
                                        </div>
                                    </div>

                                    {/* フォローボタン */}
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => toggleFollow(creator.id)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border-2 flex items-center gap-1 flex-shrink-0 ${
                                            isFollowing
                                                ? "bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200"
                                                : "bg-white border-pink-500 text-pink-500 hover:bg-pink-50"
                                        }`}
                                        data-testid={`follow-button-${creator.id}`}
                                    >
                                        <UserPlus size={14} strokeWidth={2.5} />
                                    </motion.button>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* See More Button */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="mt-8"
                >
                    <motion.button
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate('/live')}
                        className="relative w-full overflow-hidden rounded-full py-4 font-semibold transition-all group"
                        style={{
                            background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
                            boxShadow: '0 4px 15px rgba(236, 72, 153, 0.3)'
                        }}
                        data-testid="button-see-more-creators"
                    >
                        <div className="relative z-10 flex items-center justify-center gap-2 text-white text-sm">
                            <span>{t('creatorPage.seeMore')}</span>
                            <motion.div
                                animate={{ x: [0, 5, 0] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="group-hover:scale-110 transition-transform"
                            >
                                →
                            </motion.div>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-r from-pink-600 to-rose-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </motion.button>
                </motion.div>
            </motion.div>
        </div>
    );
};

export default CreatorPage;
