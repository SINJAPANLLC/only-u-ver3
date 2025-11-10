import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import logger from '../utils/logger';
import slider1 from '@assets/1_1761457956151.png';
import slider2 from '@assets/2_1761457956151.png';
import slider3 from '@assets/3_1761457956151.png';

const FeaturedCreators = React.memo(() => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [sliderImages, setSliderImages] = useState([]);
    const [loading, setLoading] = useState(true);

    const defaultSliders = useMemo(() => [
        { id: '1', imageUrl: slider1, title: '' },
        { id: '2', imageUrl: slider2, title: '' },
        { id: '3', imageUrl: slider3, title: '' }
    ], []);

    // Firestoreからスライダー画像を取得
    useEffect(() => {
        // Firestore複合インデックスを避けるため、where句のみ使用しクライアント側でソート
        const slidersQuery = query(
            collection(db, 'homeSliders'),
            where('isActive', '==', true)
        );

        const unsubscribe = onSnapshot(
            slidersQuery,
            (snapshot) => {
                const slidersData = snapshot.docs
                    .map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }))
                    // クライアント側でpositionによりソート
                    .sort((a, b) => (a.position || 0) - (b.position || 0));

                if (slidersData.length === 0) {
                    setSliderImages(defaultSliders);
                } else {
                    setSliderImages(slidersData);
                }

                setLoading(false);
            },
            (error) => {
                logger.error('Error loading sliders:', error);
                setSliderImages(defaultSliders);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [defaultSliders]);

    useEffect(() => {
        if (sliderImages.length === 0) return;

        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % sliderImages.length);
        }, 4000);

        return () => clearInterval(timer);
    }, [sliderImages.length]);

    const nextSlide = useCallback(() => {
        setCurrentSlide((prev) => (prev + 1) % sliderImages.length);
    }, [sliderImages.length]);

    const prevSlide = useCallback(() => {
        setCurrentSlide((prev) => (prev - 1 + sliderImages.length) % sliderImages.length);
    }, [sliderImages.length]);

    if (loading || sliderImages.length === 0) {
        return (
            <div className="mb-8 sm:mb-12 mt-8 sm:mt-12">
                <div className="hidden md:grid md:grid-cols-3 gap-6">
                    {[1, 2, 3].map((index) => (
                        <div key={index} className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-gray-200 dark:bg-gray-800 animate-pulse" />
                    ))}
                </div>
                <div className="md:hidden relative aspect-[16/9] rounded-2xl overflow-hidden bg-gray-200 dark:bg-gray-800 animate-pulse" />
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8 sm:mb-12 mt-8 sm:mt-12"
        >
            {/* Desktop View - 3 Images */}
            <div className="hidden md:grid md:grid-cols-3 gap-6">
                {sliderImages.slice(0, 3).map((slider, index) => (
                    <motion.div
                        key={slider.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 + 0.4 }}
                        whileHover={{ scale: 1.02 }}
                        className="relative group cursor-pointer"
                        data-testid={`slider-desktop-${index}`}
                        onClick={() => slider.link && window.open(slider.link, '_blank')}
                    >
                        <div className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800">
                            <motion.img 
                                src={slider.imageUrl}
                                alt={slider.title || `Featured ${index + 1}`}
                                loading={index === 0 ? "eager" : "lazy"}
                                fetchpriority={index === 0 ? "high" : "auto"}
                                decoding="async"
                                className="w-full h-full object-cover"
                                animate={{ 
                                    scale: [1, 1.1, 1],
                                    x: [0, 10, 0]
                                }}
                                transition={{ 
                                    duration: 12,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                    delay: index * 0.5
                                }}
                            />
                            <motion.div 
                                className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent group-hover:from-black/60 transition-all duration-300"
                                animate={{
                                    opacity: [0.6, 1, 0.6]
                                }}
                                transition={{
                                    duration: 5,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                }}
                            ></motion.div>
                            {slider.title && (
                                <div className="absolute bottom-4 left-4 right-4 text-white">
                                    <h3 className="text-lg font-bold drop-shadow-lg">{slider.title}</h3>
                                </div>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Mobile Slider */}
            <div className="relative md:hidden">
                <div className="relative aspect-[16/9] rounded-2xl overflow-hidden">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentSlide}
                            initial={{ opacity: 0, x: 300 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -300 }}
                            transition={{ duration: 0.5 }}
                            className="absolute inset-0"
                            data-testid={`slider-mobile-${currentSlide}`}
                        >
                            <div 
                                className="relative h-full rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-pointer"
                                onClick={() => sliderImages[currentSlide]?.link && window.open(sliderImages[currentSlide].link, '_blank')}
                            >
                                <motion.img 
                                    src={sliderImages[currentSlide]?.imageUrl}
                                    alt={sliderImages[currentSlide]?.title || `Featured ${currentSlide + 1}`}
                                    loading={currentSlide === 0 ? "eager" : "lazy"}
                                    fetchpriority={currentSlide === 0 ? "high" : "auto"}
                                    decoding="async"
                                    className="w-full h-full object-cover"
                                    animate={{ 
                                        scale: [1, 1.08, 1],
                                        x: [0, -8, 0]
                                    }}
                                    transition={{ 
                                        duration: 10,
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                    }}
                                />
                                <motion.div 
                                    className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"
                                    animate={{
                                        opacity: [0.7, 1, 0.7]
                                    }}
                                    transition={{
                                        duration: 4,
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                    }}
                                ></motion.div>
                                {sliderImages[currentSlide]?.title && (
                                    <div className="absolute bottom-4 left-4 right-4 text-white">
                                        <h3 className="text-lg font-bold drop-shadow-lg">{sliderImages[currentSlide].title}</h3>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Navigation Buttons */}
                <motion.button
                    onClick={prevSlide}
                    data-testid="button-slider-prev"
                    whileHover={{ scale: 1.1, x: -2 }}
                    whileTap={{ scale: 0.95 }}
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/30 dark:bg-gray-800/50 backdrop-blur-md rounded-full p-3 z-30 hover:bg-pink-500/80 transition-all shadow-lg"
                    style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' }}
                    aria-label="Previous slide"
                >
                    <ChevronLeft className="w-6 h-6 text-white drop-shadow-lg" strokeWidth={2.5} />
                </motion.button>
                <motion.button
                    onClick={nextSlide}
                    data-testid="button-slider-next"
                    whileHover={{ scale: 1.1, x: 2 }}
                    whileTap={{ scale: 0.95 }}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/30 dark:bg-gray-800/50 backdrop-blur-md rounded-full p-3 z-30 hover:bg-pink-500/80 transition-all shadow-lg"
                    style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' }}
                    aria-label="Next slide"
                >
                    <ChevronRight className="w-6 h-6 text-white drop-shadow-lg" strokeWidth={2.5} />
                </motion.button>

                {/* Slide Indicators */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-30">
                    {sliderImages.map((_, index) => (
                        <motion.button
                            key={index}
                            onClick={() => setCurrentSlide(index)}
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.9 }}
                            className={`rounded-full transition-all duration-300 ${
                                index === currentSlide
                                    ? 'w-8 h-3 bg-white'
                                    : 'w-3 h-3 bg-white/50'
                            }`}
                            style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)' }}
                            data-testid={`slider-indicator-${index}`}
                            aria-label={`Go to slide ${index + 1}`}
                        />
                    ))}
                </div>
            </div>
        </motion.div>
    );
});

FeaturedCreators.displayName = 'FeaturedCreators';

export default FeaturedCreators;
