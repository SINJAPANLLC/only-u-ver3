import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Star } from 'lucide-react';
import { genreData, genreNameMapping } from '../data/constants';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import logger from '../utils/logger';
import squirtingImage from '@assets/S__23355436_1761458269036.jpg';
import abnormalImage from '@assets/S__23355435_1761458437613.jpg';

const RecommendedGenres = React.memo(({ likedItems, toggleLike }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [genreCounts, setGenreCounts] = useState({});

    const genreImages = useMemo(() => [
        '/genre-1.png',
        '/genre-2.png',
        '/genre-3.png',
        '/genre-4.png',
        '/genre-5.png',
        '/genre-6.png',
        squirtingImage,
        abnormalImage,
    ], []);

    const handleGenreClick = useCallback((genreNameKey) => {
        navigate(`/genre/${genreNameKey}`);
    }, [navigate]);

    // ✅ 最適化: 全ジャンルの動画数を一度に取得
    useEffect(() => {
        const fetchGenreCounts = async () => {
            try {
                const postsRef = collection(db, 'posts');
                const querySnapshot = await getDocs(postsRef);
                
                const counts = {};
                
                // 全投稿を一度走査して、各ジャンルの数をカウント
                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.genres && Array.isArray(data.genres)) {
                        data.genres.forEach(genreName => {
                            // ジャンル名からnameKeyを逆引き
                            const nameKey = Object.keys(genreNameMapping).find(
                                key => genreNameMapping[key] === genreName
                            );
                            if (nameKey) {
                                counts[nameKey] = (counts[nameKey] || 0) + 1;
                            }
                        });
                    }
                });
                
                logger.log('📊 Genre counts loaded:', counts);
                setGenreCounts(counts);
            } catch (error) {
                logger.error('Error loading genre counts:', error);
            }
        };

        fetchGenreCounts();
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mb-12"
        >
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 sm:mb-6 flex items-center">
                <motion.div
                    whileHover={{ scale: 1.1, rotate: 180 }}
                    transition={{ duration: 0.3 }}
                    className="mr-2 p-1.5 rounded-lg bg-gradient-to-br from-pink-400 to-pink-600 shadow-md"
                >
                    <Star className="w-4 h-4 sm:w-5 sm:h-5 text-white fill-white" strokeWidth={2.5} />
                </motion.div>
                {t('genres.title')}
            </h2>

            {/* Responsive 2-column square grid for all screen sizes */}
            <div className="grid grid-cols-2 gap-3">
                {genreData.map((genre, index) => {
                    // 3つの画像を順番に繰り返す
                    const imageUrl = genreImages[index % genreImages.length];
                    
                    return (
                        <motion.div
                            key={genre.nameKey}
                            initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 + 0.8 }}
                            whileHover={{ scale: 1.05, y: -5 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleGenreClick(genre.nameKey)}
                            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-all group aspect-square flex flex-col"
                            data-testid={`genre-card-${genre.nameKey}`}
                        >
                            {/* Thumbnail */}
                            <div className="relative flex-1 overflow-hidden">
                                <motion.img 
                                    src={imageUrl}
                                    alt={t(`genres.${genre.nameKey}`)}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover"
                                    animate={{ 
                                        scale: [1, 1.08, 1],
                                        rotate: [0, 1, 0]
                                    }}
                                    transition={{ 
                                        duration: 10,
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                        delay: index * 0.3
                                    }}
                                    whileHover={{ scale: 1.15 }}
                                />
                                <motion.div 
                                    className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"
                                    animate={{
                                        opacity: [0.8, 1, 0.8]
                                    }}
                                    transition={{
                                        duration: 4,
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                    }}
                                ></motion.div>
                            </div>
                            
                            {/* Content */}
                            <div className="p-3 flex-shrink-0 bg-white dark:bg-gray-800">
                                <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm text-center mb-1">
                                    {t(`genres.${genre.nameKey}`)}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                                    {(genreCounts[genre.nameKey] || genre.count).toLocaleString()} Videos
                                </p>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/GenreNavigationSystem')}
                className="relative w-full mt-6 overflow-hidden rounded-full py-3.5 font-medium transition-all text-sm sm:text-base flex items-center justify-center gap-2 group"
                data-testid="button-see-more-genres"
                style={{
                    background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
                    boxShadow: '0 4px 15px rgba(236, 72, 153, 0.3)'
                }}
            >
                <span className="relative z-10 text-white font-semibold flex items-center gap-2">
                    {t('genres.SeeMore')} 
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-pink-600 to-rose-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </motion.button>
        </motion.div>
    );
});

RecommendedGenres.displayName = 'RecommendedGenres';

export default RecommendedGenres;
