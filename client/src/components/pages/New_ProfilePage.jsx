import React, { useState, useEffect, useRef } from 'react';
import {
    Heart, MessageCircle, Share2, MoreHorizontal, X, Link2, User, ArrowLeft,
    Grid3X3, List, Pin, Video, Image as ImageIcon, Download, Bookmark, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const EnhancedProfilePage = () => {
    const navigate = useNavigate();
    const { currentUser, loading } = useAuth();
    const [activeTab, setActiveTab] = useState('Post');
    const [viewMode, setViewMode] = useState('grid');
    const [sortBy, setSortBy] = useState('New');
    const [selectedTags] = useState('All tags');
    const [selectedFilter, setSelectedFilter] = useState('All');
    const [showFilters, setShowFilters] = useState(false);

    // NEW: Added states for sticky header and options menu
    const [showStickyHeader, setShowStickyHeader] = useState(false);
    const [showOptionsMenu, setShowOptionsMenu] = useState(false);
    const optionsRef = useRef(null);

    const [profile] = useState({
        name: currentUser?.displayName || 'User Name',
        username: currentUser?.displayName || 'User Name',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop',
        verified: true,
        stats: {
            posts: 293,
            likes: '59.3K',
            followers: '108.5K',
            following: 0
        },
        description: '彼氏や旦那とのえっちに満足できていない女の子を、おもちゃ責め、潮吹き、高速ピストンなどのバチボコセックスでイカせまくり、別世界のえっちを体験させる裏垢男子。。彼氏がMであんまりいじめてくれな...',
        rankings: [
            { category: 'Married Woman', position: '1st' },
            { category: 'Pervert', position: '1st' },
            { category: 'Beautiful Breasts', position: '1st' }
        ],
        subscriptionPlan: {
            label: 'Recommendation',
            name: '見放題プラン',
            price: '¥5,000',
            period: 'month',
            posts: 99,
            description: 'こちらのプランでは全ての投稿を見ることができます。入会日から翌...'
        },
        postsData: {
            total: 685,
            images: 194,
            videos: 491
        },
        posts: [
            {
                id: 1,
                imageUrl: 'https://picsum.photos/300/400?random=1',
                isPinned: true,
                type: 'video',
                title: 'Sample video post',
                date: '2024-09-01',
                likes: 120,
                comments: 15
            },
            {
                id: 2,
                imageUrl: 'https://picsum.photos/300/400?random=2',
                isPinned: false,
                type: 'image',
                title: 'Beautiful photo',
                date: '2024-08-30',
                likes: 89,
                comments: 8
            },
            {
                id: 3,
                imageUrl: 'https://picsum.photos/300/400?random=3',
                isPinned: true,
                type: 'video',
                title: 'Another video',
                date: '2024-08-28',
                likes: 256,
                comments: 32
            },
            {
                id: 4,
                imageUrl: 'https://picsum.photos/300/400?random=4',
                isPinned: false,
                type: 'image',
                title: 'Great shot',
                date: '2024-08-25',
                likes: 178,
                comments: 22
            },
            {
                id: 5,
                imageUrl: 'https://picsum.photos/300/400?random=5',
                isPinned: false,
                type: 'video',
                title: 'Video content',
                date: '2024-08-20',
                likes: 340,
                comments: 45
            },
            {
                id: 6,
                imageUrl: 'https://picsum.photos/300/400?random=6',
                isPinned: false,
                type: 'image',
                title: 'Amazing view',
                date: '2024-08-18',
                likes: 95,
                comments: 12
            },
        ]
    });

    const filterOptions = ['All', 'Images', 'Videos', 'Pinned'];
    const sortOptions = ['New', 'Old', 'Most Liked', 'Most Comments'];
    // const tagOptions = ['All tags', 'Popular', 'Recent', 'Custom'];

    const PostGridItem = ({ post, index }) => (
        <motion.div
            key={post.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="relative aspect-square group cursor-pointer"
        >
            <img
                src={post.imageUrl}
                alt={post.title}
                className="w-full h-full object-cover rounded-lg"
            />

            {/* Pin Badge */}
            {post.isPinned && (
                <div className="absolute top-1 sm:top-2 left-1 sm:left-2 bg-pink-600 text-white text-xs px-1 sm:px-2 py-0.5 sm:py-1 rounded flex items-center space-x-1">
                    <Pin size={8} className="sm:w-3 sm:h-3" />
                    <span className="hidden sm:inline">PIN</span>
                </div>
            )}

            {/* Media Type indicator */}
            <div className="absolute top-1 sm:top-2 right-1 sm:right-2 bg-black/50 text-white text-xs px-1 sm:px-2 py-0.5 sm:py-1 rounded flex items-center space-x-1">
                {post.type === 'video' ? <Video size={8} className="sm:w-3 sm:h-3" /> : <ImageIcon size={8} className="sm:w-3 sm:h-3" />}
                <span className="hidden md:inline">{post.type}</span>
            </div>

            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-center justify-center">
                <div className="flex items-center space-x-2 sm:space-x-4 text-white">
                    <div className="flex items-center space-x-1">
                        <Heart size={12} className="sm:w-4 sm:h-4" fill="white" />
                        <span className="text-xs sm:text-sm">{post.likes}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                        <MessageCircle size={12} className="sm:w-4 sm:h-4" />
                        <span className="text-xs sm:text-sm">{post.comments}</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

// If user is not authenticated, redirect to login
if (!currentUser) {
    navigate('/');
    return null;
}

return (
    <div className="min-h-screen bg-white dark:bg-black">
        {/* NEW: Background Image Header */}
        <div className="relative h-48 sm:h-64">
            <img
                src="https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=400&fit=crop"
                alt="Cover"
                className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/20"></div>

            {/* Header Controls over background */}
            <div className="absolute top-0 left-0 right-0 p-3 sm:p-4 flex items-center justify-between">
                <button onClick={() => navigate(-1)} className="p-2 bg-black/30 rounded-full">
                    <ArrowLeft size={20} className="text-white" />
                </button>
                <div className="flex items-center space-x-2">
                    <button onClick={handleShare} className="p-2 bg-black/30 rounded-full">
                        <Share2 size={18} className="text-white" />
                    </button>
                    <div className="relative" ref={optionsRef}>
                        <button
                            onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                            className="p-2 bg-black/30 rounded-full"
                        >
                            <MoreHorizontal size={18} className="text-white" />
                        </button>
                        <AnimatePresence>
                            {showOptionsMenu && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    className="absolute right-0 top-12 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 z-50 min-w-[120px]"
                                >
                                    <button
                                        onClick={handleBlock}
                                        className="flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 w-full text-left text-sm"
                                    >
                                        <X size={16} className="text-gray-600 dark:text-gray-300" />
                                        <span>Block</span>
                                    </button>
                                    <button
                                        onClick={handleReport}
                                        className="flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 w-full text-left text-sm text-red-600 border-t border-gray-100"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                        </svg>
                                        <span>Report</span>
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>

        {/* NEW: Sticky Header */}
        <AnimatePresence>
            {showStickyHeader && (
                <motion.div
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -100, opacity: 0 }}
                    className="fixed top-0 left-0 right-0 bg-white/95 dark:bg-black/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 z-50"
                >
                    <div className="flex items-center justify-between p-3 sm:p-4">
                        <button onClick={() => navigate(-1)} className="p-1 sm:p-2">
                            <ArrowLeft size={20} className="text-gray-700 dark:text-gray-200" />
                        </button>
                        <div className="flex items-center space-x-3">
                            <img
                                src={profile.avatar}
                                alt={profile.name}
                                loading="lazy"
                                decoding="async"
                                className="w-8 h-8 rounded-full"
                            />
                            <div>
                                <h1 className="font-semibold text-sm truncate max-w-[150px]">
                                    {profile.name}
                                </h1>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{profile.username}</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <button onClick={handleShare} className="p-2">
                                <Share2 size={18} className="text-gray-700 dark:text-gray-200" />
                            </button>
                            <div className="relative" ref={optionsRef}>
                                <button
                                    onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                                    className="p-2"
                                >
                                    <MoreHorizontal size={18} className="text-gray-700 dark:text-gray-200" />
                                </button>
                                {/* Options menu would appear here too */}
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        <div className="px-3 sm:px-4 lg:px-6 pb-20 -mt-8">
            {/* Profile Info - adjusted positioning */}
            <div className="flex items-start space-x-3 sm:space-x-4 py-4 sm:py-6">
                <div className="relative flex-shrink-0">
                    <img
                        src={profile.avatar}
                        alt={profile.name}
                        loading="lazy"
                        decoding="async"
                        className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-full shadow-lg border-4 border-white"
                    />
                    {profile.verified && (
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
                            <div className="w-3 h-3 sm:w-4 sm:h-4 bg-white rounded-full"></div>
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0 pt-8">
                    <div className="flex items-start justify-between mb-2">
                        <div className="min-w-0 flex-1">
                            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">{profile.name}</h1>
                            <p className="text-gray-200 text-sm sm:text-base">{profile.username}</p>
                        </div>
                        <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
                            <X size={16} className="sm:w-5 sm:h-5 text-pink-600" />
                            <Link2 size={16} className="sm:w-5 sm:h-5 text-pink-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Rest of your existing code stays exactly the same... */}
            {/* Stats */}
            <div className="grid grid-cols-4 gap-2 text-center mb-4 sm:mb-6">
                <div>
                    <div className="text-lg sm:text-xl lg:text-2xl font-bold">{profile.stats.posts}</div>
                    <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Post</div>
                </div>
                <div>
                    <div className="text-lg sm:text-xl lg:text-2xl font-bold">{profile.stats.likes}</div>
                    <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Like</div>
                </div>
                <div>
                    <div className="text-lg sm:text-xl lg:text-2xl font-bold">{profile.stats.followers}</div>
                    <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">フォロワー</div>
                </div>
                <div>
                    <div className="text-lg sm:text-xl lg:text-2xl font-bold">{profile.stats.following}</div>
                    <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">フォロー中</div>
                </div>
            </div>

            {/* Description */}
            <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 mb-4 sm:mb-6 leading-relaxed">
                {profile.description}
            </p>

            {/* Genre Rankings */}
            <div className="mb-4 sm:mb-6">
                <p className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Genre-based ranking (Daily)</p>
                <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:flex lg:space-x-6">
                    {profile.rankings.map((ranking, index) => (
                        <div key={index} className="text-center">
                            <div className="text-xs sm:text-sm font-medium truncate">{ranking.category}</div>
                            <div className="text-sm sm:text-lg font-bold text-red-500">{ranking.position}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Subscription Plan */}
            <div className="bg-pink-50 dark:bg-gray-800 border border-pink-300 dark:border-gray-700 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                    <div className="flex-1">
                        <span className="bg-pink-600 text-white text-xs px-2 py-1 rounded mb-2 inline-block">
                            {profile.subscriptionPlan.label}
                        </span>
                        <h3 className="font-bold text-pink-600 text-base sm:text-lg mb-1">
                            {profile.subscriptionPlan.name}
                        </h3>
                        <div className="flex flex-wrap items-baseline gap-1 mb-2">
                            <span className="font-bold text-sm sm:text-lg">{profile.subscriptionPlan.price}</span>
                            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">/ {profile.subscriptionPlan.period}</span>
                            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Posts: {profile.subscriptionPlan.posts}</span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{profile.subscriptionPlan.description}</p>
                    </div>
                    <button className="bg-pink-600 text-white px-4 sm:px-6 py-2 rounded-full font-semibold hover:bg-pink-700 text-sm sm:text-base w-full sm:w-auto">
                        Subscribe
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-4 sm:space-x-8 mb-4 sm:mb-6 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('Post')}
                    className={`pb-2 border-b-2 font-semibold whitespace-nowrap text-sm sm:text-base ${activeTab === 'Post'
                        ? 'text-pink-600 border-pink-600'
                        : 'text-gray-400 dark:text-gray-500 border-transparent'
                        }`}
                >
                    Post
                </button>
                <button
                    onClick={() => setActiveTab('Single post sales')}
                    className={`pb-2 border-b-2 font-semibold whitespace-nowrap text-sm sm:text-base ${activeTab === 'Single post sales'
                        ? 'text-pink-600 border-pink-600'
                        : 'text-gray-400 dark:text-gray-500 border-transparent'
                        }`}
                >
                    Single post sales
                </button>
            </div>

            {/* Filters and Controls */}
            <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                    <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                        {/* Tags Filter */}
                        <div className="relative">
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className="flex items-center justify-between w-full sm:w-auto space-x-2 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-xs sm:text-sm bg-white dark:bg-gray-800 dark:text-gray-200"
                            >
                                <span className="truncate">{selectedTags}</span>
                                <ChevronDown size={14} className="flex-shrink-0" />
                            </button>
                        </div>

                        {/* Content Type Filter */}
                        <div className="flex flex-wrap gap-1 sm:gap-2">
                            {filterOptions.map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setSelectedFilter(filter)}
                                    className={`px-2 sm:px-3 py-1 text-xs rounded border flex items-center space-x-1 ${selectedFilter === filter
                                        ? 'bg-pink-600 text-white border-pink-600'
                                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                                        }`}
                                >
                                    {filter === 'Images' && <ImageIcon size={10} className="sm:w-3 sm:h-3" />}
                                    {filter === 'Videos' && <Video size={10} className="sm:w-3 sm:h-3" />}
                                    <span>{filter}</span>
                                </button>
                            ))}
                        </div>

                        {/* Sort Dropdown */}
                        <div className="relative">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-xs sm:text-sm bg-white dark:bg-gray-800 dark:text-gray-200 w-full sm:w-auto"
                            >
                                {sortOptions.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* View Toggle */}
                    <div className="flex items-center space-x-2 self-end sm:self-auto">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded ${viewMode === 'grid' ? 'bg-pink-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                }`}
                        >
                            <Grid3X3 size={14} className="sm:w-4 sm:h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded ${viewMode === 'list' ? 'bg-pink-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                }`}
                        >
                            <List size={14} className="sm:w-4 sm:h-4" />
                        </button>
                    </div>
                </div>

                {/* Post Count */}
                <div className="flex items-center space-x-3 sm:space-x-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400 overflow-x-auto">
                    <span className="whitespace-nowrap">{profile.postsData.total}件</span>
                    <span className="flex items-center space-x-1 whitespace-nowrap">
                        <ImageIcon size={12} className="sm:w-4 sm:h-4" />
                        <span>{profile.postsData.images}</span>
                    </span>
                    <span className="flex items-center space-x-1 whitespace-nowrap">
                        <Video size={12} className="sm:w-4 sm:h-4" />
                        <span>{profile.postsData.videos}</span>
                    </span>
                </div>
            </div>

            {/* Posts Content */}
            {profile.posts.length > 0 ? (
                viewMode === 'grid' ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 sm:gap-2">
                        {profile.posts.map((post, index) => (
                            <PostGridItem key={post.id} post={post} index={index} />
                        ))}
                    </div>
                ) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                        {profile.posts.map((post) => (
                            <PostListItem key={post.id} post={post} />
                        ))}
                    </div>
                )
            ) : (
                <div className="text-center py-8 sm:py-12">
                    <div className="text-gray-400 text-4xl sm:text-6xl mb-4">📷</div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">コンテンツがありません</p>
                </div>
            )}
        </div>

        {/* Bottom Action Buttons */}
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-3 sm:p-4 flex space-x-2 sm:space-x-3">
            <button className="flex-1 bg-pink-600 text-white py-2 sm:py-3 rounded-full font-semibold flex items-center justify-center space-x-1 sm:space-x-2 hover:bg-pink-700 text-xs sm:text-sm">
                <Heart size={14} className="sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Send a tip</span>
                <span className="sm:hidden">Tip</span>
            </button>
            <button className="flex-1 border border-pink-600 text-pink-600 py-2 sm:py-3 rounded-full font-semibold flex items-center justify-center space-x-1 sm:space-x-2 hover:bg-pink-50 text-xs sm:text-sm">
                <User size={14} className="sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">+ フォロー</span>
                <span className="sm:hidden">フォロー</span>
            </button>
            <button className="flex-1 border border-gray-300 text-gray-700 py-2 sm:py-3 rounded-full font-semibold flex items-center justify-center space-x-1 sm:space-x-2 hover:bg-gray-50 text-xs sm:text-sm">
                <MessageCircle size={14} className="sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Messages</span>
                <span className="sm:hidden">Msg</span>
            </button>
        </div>
    </div>
);
export default EnhancedProfilePage;
