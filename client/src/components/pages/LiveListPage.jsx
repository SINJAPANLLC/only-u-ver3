import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Radio, Users, Play, Search, Filter } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import BottomNavigationWithCreator from '../BottomNavigationWithCreator';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const LiveListPage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [liveRooms, setLiveRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterActive, setFilterActive] = useState('all'); // 'all', 'live', 'recorded'

    // 画像URLをプロキシURLに変換するヘルパー関数
    const getProxyImageUrl = (url) => {
        if (!url) return '';
        
        if (url.startsWith('data:image/')) {
            return url;
        }
        
        if (url.startsWith('/api/proxy/')) {
            return url;
        }
        
        if (url.includes('only-u.fun') || url.includes('bunnycdn.com')) {
            const filename = url.split('/').pop();
            return `/api/proxy/public/${filename}`;
        }
        
        if (url.startsWith('http')) {
            const filename = url.split('/').pop();
            return `/api/proxy/public/${filename}`;
        }
        
        return url;
    };

    // アクティブなライブルームデータを取得
    useEffect(() => {
        setLoading(true);
        
        const liveQuery = query(
            collection(db, 'liveRooms'),
            where('isActive', '==', true),
            limit(50)
        );
        
        const unsubscribe = onSnapshot(
            liveQuery, 
            (snapshot) => {
                const rooms = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    rooms.push({
                        id: doc.id,
                        title: data.title || 'ライブ配信中',
                        creatorName: data.creatorName || 'Anonymous',
                        creatorAvatar: data.creatorAvatar || '',
                        videoUrl: null,
                        thumbnailUrl: data.thumbnailUrl || '',
                        isLive: true,
                        isRealLive: true,
                        viewers: data.viewers || 0,
                        creatorId: data.creatorId,
                        createdAt: data.createdAt
                    });
                });
                
                rooms.sort((a, b) => {
                    const timeA = a.createdAt?.toMillis?.() || 0;
                    const timeB = b.createdAt?.toMillis?.() || 0;
                    return timeB - timeA;
                });
                
                setLiveRooms(rooms);
                setLoading(false);
            },
            (error) => {
                console.error('Error fetching live rooms:', error);
                setLoading(false);
            }
        );
        
        return () => unsubscribe();
    }, []);

    // フィルタリングと検索
    const filteredRooms = liveRooms.filter(room => {
        const matchesSearch = room.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            room.creatorName.toLowerCase().includes(searchQuery.toLowerCase());
        
        if (filterActive === 'live') {
            return matchesSearch && room.isRealLive;
        }
        
        return matchesSearch;
    });

    const handleRoomClick = (roomId) => {
        navigate(`/live/${roomId}`);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 pb-20">
            {/* ヘッダー */}
            <motion.div 
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="sticky top-0 z-30 bg-black/60 backdrop-blur-xl border-b border-white/10"
            >
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center shadow-lg">
                                <Radio className="w-6 h-6 text-white" />
                            </div>
                            <h1 className="text-2xl font-bold text-white drop-shadow-lg">
                                LIVE
                            </h1>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                            <div className="px-4 py-2 bg-gradient-to-r from-pink-500/20 to-purple-500/20 backdrop-blur-xl rounded-full border border-white/10">
                                <span className="text-white font-bold">{filteredRooms.length} 配信中</span>
                            </div>
                        </div>
                    </div>
                    
                    {/* 検索バー */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
                        <Input
                            type="text"
                            placeholder="配信を検索..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl text-white placeholder-white/60 focus:ring-2 focus:ring-pink-500"
                            data-testid="input-search-live"
                        />
                    </div>
                </div>
            </motion.div>

            {/* コンテンツエリア */}
            <div className="max-w-7xl mx-auto px-4 py-6">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                            className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full"
                        />
                    </div>
                ) : filteredRooms.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center py-20"
                    >
                        <Radio className="w-16 h-16 text-white/30 mx-auto mb-4" />
                        <p className="text-white/60 text-lg">
                            {searchQuery ? '検索結果が見つかりません' : '現在配信中のライブはありません'}
                        </p>
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredRooms.map((room, index) => (
                            <motion.div
                                key={room.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                whileHover={{ y: -8, scale: 1.02 }}
                                onClick={() => handleRoomClick(room.id)}
                                className="group cursor-pointer"
                                data-testid={`live-card-${room.id}`}
                            >
                                {/* カード */}
                                <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/10 shadow-2xl hover:border-pink-500/50 transition-all">
                                    {/* サムネイル */}
                                    <div className="relative aspect-video bg-gradient-to-br from-pink-500/20 to-purple-500/20">
                                        {room.thumbnailUrl ? (
                                            <img
                                                src={getProxyImageUrl(room.thumbnailUrl)}
                                                alt={room.title}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                }}
                                            />
                                        ) : room.creatorAvatar ? (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <img
                                                    src={getProxyImageUrl(room.creatorAvatar)}
                                                    alt={room.creatorName}
                                                    className="w-24 h-24 rounded-full object-cover border-4 border-white/20"
                                                    onError={(e) => {
                                                        e.target.src = '/logo192.png';
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Radio className="w-16 h-16 text-white/30" />
                                            </div>
                                        )}
                                        
                                        {/* グラデーションオーバーレイ */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                        
                                        {/* LIVEバッジ */}
                                        <motion.div
                                            animate={{ opacity: [1, 0.7, 1] }}
                                            transition={{ repeat: Infinity, duration: 1.5 }}
                                            className="absolute top-3 left-3 px-3 py-1.5 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center space-x-1.5 shadow-lg"
                                        >
                                            <Radio className="w-3 h-3 text-white" />
                                            <span className="text-white text-xs font-bold">LIVE</span>
                                        </motion.div>
                                        
                                        {/* 視聴者数 */}
                                        <div className="absolute top-3 right-3 px-3 py-1.5 bg-black/60 backdrop-blur-xl rounded-full flex items-center space-x-1.5">
                                            <Users className="w-3 h-3 text-white" />
                                            <span className="text-white text-xs font-bold">{room.viewers}</span>
                                        </div>
                                        
                                        {/* 再生ボタンオーバーレイ */}
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <motion.div
                                                whileHover={{ scale: 1.1 }}
                                                className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-xl flex items-center justify-center border-2 border-white/40"
                                            >
                                                <Play className="w-8 h-8 text-white ml-1" />
                                            </motion.div>
                                        </div>
                                    </div>
                                    
                                    {/* カード情報 */}
                                    <div className="p-4">
                                        <h3 className="text-white font-bold text-base mb-2 line-clamp-2 group-hover:text-pink-400 transition-colors">
                                            {room.title}
                                        </h3>
                                        
                                        <div className="flex items-center space-x-2">
                                            <img
                                                src={room.creatorAvatar && room.creatorAvatar.trim() !== '' 
                                                    ? getProxyImageUrl(room.creatorAvatar)
                                                    : '/logo192.png'
                                                }
                                                alt={room.creatorName}
                                                className="w-8 h-8 rounded-full object-cover border-2 border-pink-500/50"
                                                onError={(e) => {
                                                    e.target.src = '/logo192.png';
                                                }}
                                            />
                                            <span className="text-white/70 text-sm font-medium">
                                                {room.creatorName}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* ボトムナビゲーション */}
            <div className="fixed bottom-0 left-0 right-0 z-30">
                <BottomNavigationWithCreator active="ranking" />
            </div>
        </div>
    );
};

export default LiveListPage;
