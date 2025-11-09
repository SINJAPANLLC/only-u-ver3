import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BottomNavigationWithCreator from '../../BottomNavigationWithCreator';
import {
    ArrowLeft,
    ChevronRight,
    Info,
    User,
    Play,
    Heart,
    MapPin,
    Shirt,
    Crown,
    Users,
    MessageCircle,
    Star,
    Gamepad2,
    Music,
    Home,
    Dumbbell,
    Camera,
    Mic,
    Video
} from 'lucide-react';

const GenreSubcategoryPage = ({ selectedGenre, onBack, onSubcategorySelect }) => {
    // Information notices at the top
    const navigate = useNavigate();

    const BackTo = () => {
        navigate('/live');
    }

    const handleSubcategoryClick = (genreName) => {
        navigate(`/genre/${encodeURIComponent(genreName)}`);
    };

    // Genre data with subcategories
    const genreData = {
        appearance: {
            title: 'ビジュアル',
            icon: User,
            subcategories: [
                { name: 'ロリ顔', posts: '97,902 posts' },
                { name: '地味顔', posts: '66,327 posts' },
                { name: 'ギャル', posts: '60,570 posts' },
                { name: 'お姉さん', posts: '24,470 posts' },
                { name: '熟女', posts: '23,472 posts' },
                { name: 'デカ尻', posts: '18,726 posts' },
                { name: '巨乳', posts: '17,467 posts' },
                { name: '貧乳', posts: '16,680 posts' },
                { name: '入れ墨', posts: '13,701 posts' }
            ]
        },
        play: {
            title: 'プレイ',
            icon: Play,
            subcategories: [
                { name: '正常位', posts: '11,804 posts' },
                { name: '騎乗位', posts: '5,576 posts' },
                { name: 'バック', posts: '4,676 posts' },
                { name: '種付けプレス', posts: '3,770 posts' },
                { name: 'フェラチオ', posts: '2,227 posts' },
                { name: 'パイずり', posts: '1,500 posts' },
                { name: '中だし', posts: '1,200 posts' },
                { name: '顔射', posts: '1,000 posts' },
                { name: '言葉責め', posts: '900 posts' },
                { name: 'クンニ', posts: '800 posts' },
                { name: '玩具', posts: '700 posts' },
                { name: '潮吹き（女）', posts: '600 posts' },
                { name: 'アナル', posts: '500 posts' },
                { name: '企画', posts: '400 posts' }
            ]
        },
        situation: {
            title: 'シチュエーション',
            icon: MapPin,
            subcategories: [
                { name: '複数プレイ', posts: '350 posts' },
                { name: '女性優位', posts: '300 posts' },
                { name: '寝取られ', posts: '280 posts' },
                { name: '野外・露出', posts: '250 posts' },
                { name: 'オナニー', posts: '220 posts' },
                { name: 'ハメ撮り', posts: '200 posts' },
                { name: 'コスプレ', posts: '180 posts' },
                { name: '主観', posts: '160 posts' },
                { name: '盗撮', posts: '140 posts' },
                { name: 'レイプ', posts: '120 posts' },
                { name: 'ＧＬ', posts: '100 posts' },
                { name: 'ＢＬ', posts: '90 posts' }
            ]
        },
        abnormal: {
            title: 'アブノーマル',
            icon: Heart,
            subcategories: [
                { name: '緊縛', posts: '80 posts' },
                { name: '浣腸', posts: '70 posts' },
                { name: '調教', posts: '60 posts' },
                { name: '拡張', posts: '50 posts' },
                { name: '殴打', posts: '40 posts' },
                { name: '女装・男の娘', posts: '35 posts' },
                { name: '潮吹き（男）', posts: '30 posts' },
                { name: '尿道', posts: '25 posts' },
                { name: 'その他フェチ', posts: '20 posts' }
            ]
        },
        other: {
            title: 'その他',
            icon: Shirt,
            subcategories: [
                { name: '会いに行ける', posts: '15 posts' },
                { name: 'イベント', posts: '12 posts' },
                { name: 'HowTo', posts: '10 posts' },
                { name: 'ASMR', posts: '8 posts' }
            ]
        }
    };

    // Get current genre data or default
    const currentGenre = genreData[selectedGenre] || genreData.appearance;

    const NoticeItem = ({ notice }) => (
        <motion.div
            whileHover={{ scale: 1.01 }}
            className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-lg mb-3"
        >
            <div className="flex items-center space-x-3">
                <div className="bg-blue-100 p-2 rounded-full">
                    <notice.icon className="w-4 h-4 text-blue-500" />
                </div>
                <span className="text-sm text-blue-800 font-medium">
                    {notice.title}
                </span>
            </div>
            <ChevronRight className="w-5 h-5 text-blue-400" />
        </motion.div>
    );

    const SubcategoryItem = ({ subcategory, index }) => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
            whileHover={{ scale: 1.05, y: -3 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleSubcategoryClick(subcategory.name)}
            className="relative flex items-center justify-between p-4 bg-gradient-to-br from-white to-pink-50/30 border border-pink-100 rounded-xl shadow-md cursor-pointer hover:shadow-xl transition-all duration-200 overflow-hidden group"
        >
            {/* グロウエフェクト */}
            <motion.div
                className="absolute inset-0 bg-gradient-to-br from-pink-400/10 to-pink-600/10 opacity-0 group-hover:opacity-100 transition-opacity"
            />
            
            <div className="flex-1 relative z-10">
                <h3 className="text-base font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent mb-1">
                    {subcategory.name}
                </h3>
                <p className="text-xs text-gray-600 font-medium">
                    {subcategory.posts}
                </p>
            </div>
            <motion.div
                whileHover={{ x: 3 }}
                className="relative z-10"
            >
                <ChevronRight className="w-5 h-5 text-pink-400 flex-shrink-0" strokeWidth={2.5} />
            </motion.div>
        </motion.div>
    );

    return (
        <div className="max-w-4xl mx-auto bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-gray-200 px-4 py-3 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <motion.button
                            whileHover={{ scale: 1.1, rotate: -10 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={onBack}
                            className="p-2.5 hover:bg-gradient-to-br hover:from-pink-50 hover:to-rose-50 rounded-full transition-all group"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-600 group-hover:text-pink-500 transition-colors" strokeWidth={2.5} />
                        </motion.button>
                        <div className="flex items-center space-x-2">
                            <motion.div
                                animate={{ rotate: [0, 10, 0, -10, 0] }}
                                transition={{ duration: 3, repeat: Infinity }}
                                className="bg-gradient-to-br from-pink-400 to-pink-600 p-2 rounded-full"
                            >
                                <currentGenre.icon className="w-5 h-5 text-white" strokeWidth={2.5} />
                            </motion.div>
                            <motion.h1 
                                className="text-lg font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent"
                                animate={{ opacity: [0.8, 1, 0.8] }}
                                transition={{ duration: 3, repeat: Infinity }}
                            >
                                {currentGenre.title}
                            </motion.h1>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="px-4 py-6">
                {/* Notice Section */}
                <div className="mb-6">
                    {notices.map((notice) => (
                        <NoticeItem key={notice.id} notice={notice} />
                    ))}
                </div>

                {/* Subcategories Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 mb-4">
                    {currentGenre.subcategories.map((subcategory, index) => (
                        <SubcategoryItem key={subcategory.name} subcategory={subcategory} index={index} />
                    ))}
                </div>

                {/* Load More Button */}
                <div className="text-center">
                    <motion.button
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        className="relative bg-gradient-to-br from-pink-400 to-pink-600 text-white px-8 py-3.5 rounded-full font-bold shadow-xl overflow-hidden group"
                    >
                        <motion.div
                            className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                        <motion.span
                            className="relative z-10"
                            animate={{ opacity: [0.9, 1, 0.9] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            さらにカテゴリを読み込む
                        </motion.span>
                    </motion.button>
                </div>
            </div>

            {/* Bottom Navigation Placeholder */}
            <div className="h-20"></div>
        </div>
    );
};

// Main component that handles navigation between genre list and subcategory pages
const GenreNavigationSystem = () => {
    const [currentPage, setCurrentPage] = useState('list'); // 'list' or 'subcategory'
    const [selectedGenre, setSelectedGenre] = useState('appearance');
    const { t } = useTranslation();

    // Genre categories for the main list
    const genreCategories = [
        {
            id: 'appearance',
            title: 'ビジュアル',
            description: 'ロリ顔、地味顔、ギャルなど出演者の属性に応じたジャンル',
            icon: User,
            color: 'text-pink-500'
        },
        {
            id: 'play',
            title: 'プレイ',
            description: '騎乗位、フェラチオなどプレイ内容に応じたジャンル',
            icon: Play,
            color: 'text-purple-500'
        },
        {
            id: 'situation',
            title: 'シチュエーション',
            description: '複数プレイ、野外・露出など撮影状況に応じたジャンル',
            icon: MapPin,
            color: 'text-blue-500'
        },
        {
            id: 'abnormal',
            title: 'アブノーマル',
            description: '緊縛、調教など特殊なプレイに応じたジャンル',
            icon: Heart,
            color: 'text-red-500'
        },
        {
            id: 'other',
            title: 'その他',
            description: '会いに行ける、イベントなどその他のジャンル',
            icon: Shirt,
            color: 'text-green-500'
        }
    ];


    const handleGenreSelect = (genreId) => {
        setSelectedGenre(genreId);
        setCurrentPage('subcategory');
    };

    const handleBackToList = () => {
        setCurrentPage('list');
    };

    const handleSubcategorySelect = (subcategory) => {
        console.log('Selected subcategory:', subcategory);
        // Handle subcategory selection here
    };

    if (currentPage === 'subcategory') {
        return (
            <GenreSubcategoryPage
                selectedGenre={selectedGenre}
                onBack={BackTo}
                onSubcategorySelect={handleSubcategorySelect}
            />
        );
    }

    // Genre List Page
    const NoticeItem = ({ notice }) => (
        <motion.div
            whileHover={{ scale: 1.01 }}
            className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-lg mb-3"
        >
            <div className="flex items-center space-x-3">
                <div className="bg-blue-100 p-2 rounded-full">
                    <notice.icon className="w-4 h-4 text-blue-500" />
                </div>
                <span className="text-sm text-blue-800 font-medium">
                    {notice.title}
                </span>
            </div>
            <ChevronRight className="w-5 h-5 text-blue-400" />
        </motion.div>
    );

    const CategoryItem = ({ category }) => (
        <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => handleGenreSelect(category.id)}
            className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg mb-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
        >
            <div className="flex items-start space-x-4 flex-1">
                <div className="bg-gray-100 p-3 rounded-lg">
                    <category.icon className={`w-6 h-6 ${category.color}`} />
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 mb-1">
                        {category.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                        {category.description}
                    </p>
                </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
        </motion.div>
    );

    return (
        <div className="max-w-2xl mx-auto bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={handleBackToList}
                            className="p-2 hover:bg-gray-100 rounded-full"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-600" />

                        </motion.button>
                        <h1 className="text-lg font-semibold text-gray-800">
                            {t('GenreCategory.listTitle')}
                        </h1>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="px-4 py-6">

                {/* Categories */}
                <div className="mb-6">
                    <div className="flex items-center space-x-2 mb-4">
                        <h2 className="text-lg font-semibold text-gray-800">
                            {t('GenreCategory.browseByCategory')}
                        </h2>
                    </div>

                    <div>
                        {genreCategories.map((category) => (
                            <CategoryItem key={category.id} category={category} />
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Navigation Placeholder */}
            <BottomNavigationWithCreator active="ranking" />
            <div className="h-20"></div>
        </div>
    );
};

export default GenreNavigationSystem;