import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star,
  Plus,
  Trash2,
  GripVertical,
  Search,
  Heart,
  Bookmark,
  TrendingUp,
  RefreshCw,
  Eye,
  X
} from 'lucide-react';
import { db } from '../../../firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  deleteDoc, 
  addDoc,
  serverTimestamp,
  getDoc,
  getDocs,
  where
} from 'firebase/firestore';
import { useToast } from '../../../hooks/use-toast';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminStatsCard,
  AdminContentCard,
  AdminTableContainer,
  AdminEmptyState,
  AdminLoadingState
} from './AdminPageContainer';

const AnimatedNumber = ({ value, duration = 2 }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime;
    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = (currentTime - startTime) / (duration * 1000);
      
      if (progress < 1) {
        setDisplayValue(Math.floor(value * progress));
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span>{displayValue.toLocaleString()}</span>;
};

export default function FeaturedPickupManagement() {
  const { toast } = useToast();
  const [featuredPicks, setFeaturedPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [isAdding, setIsAdding] = useState(false);

  const [stats, setStats] = useState({
    total: 0,
    totalLikes: 0,
    totalBookmarks: 0,
    totalViews: 0
  });

  // モーダルを開いたときに自動的に投稿を読み込む
  useEffect(() => {
    if (showAddModal) {
      handleSearchPosts();
    }
  }, [showAddModal]);

  // Firestoreからfeatured pickupsをリアルタイム取得
  useEffect(() => {
    const pickupsQuery = query(
      collection(db, 'featuredPickups'), 
      orderBy('position', 'asc')
    );
    
    const unsubscribe = onSnapshot(
      pickupsQuery,
      async (snapshot) => {
        const pickupsData = await Promise.all(
          snapshot.docs.map(async (pickupDoc) => {
            const pickupData = pickupDoc.data();
            
            // 投稿データを取得
            try {
              const postRef = doc(db, 'posts', pickupData.postId);
              const postSnap = await getDoc(postRef);
              
              if (postSnap.exists()) {
                const postData = postSnap.data();
                return {
                  id: pickupDoc.id,
                  position: pickupData.position || 0,
                  postId: pickupData.postId,
                  postTitle: postData.title || 'タイトルなし',
                  thumbnail: postData.thumbnailUrl || postData.imageUrl || '',
                  userName: postData.creatorName || postData.userName || 'Unknown',
                  likes: postData.likesCount || postData.likes || 0,
                  bookmarks: postData.bookmarksCount || postData.bookmarks || 0,
                  views: postData.viewsCount || postData.views || 0,
                  addedDate: pickupData.addedAt?.toDate ? 
                    pickupData.addedAt.toDate().toLocaleDateString('ja-JP') : 
                    '不明',
                  addedBy: pickupData.addedBy || 'admin'
                };
              }
            } catch (error) {
              console.error('Error fetching post data:', error);
            }
            
            return null;
          })
        );

        const validPicks = pickupsData.filter(pick => pick !== null);
        setFeaturedPicks(validPicks);
        
        setStats({
          total: validPicks.length,
          totalLikes: validPicks.reduce((sum, pick) => sum + pick.likes, 0),
          totalBookmarks: validPicks.reduce((sum, pick) => sum + pick.bookmarks, 0),
          totalViews: validPicks.reduce((sum, pick) => sum + pick.views, 0)
        });

        setLoading(false);
        setIsRefreshing(false);
      },
      (error) => {
        console.error('Error loading featured pickups:', error);
        toast({
          title: 'エラー',
          description: '運営Pick UPの読み込みに失敗しました',
          variant: 'destructive'
        });
        setLoading(false);
        setIsRefreshing(false);
      }
    );

    return () => unsubscribe();
  }, [toast]);

  // 投稿を検索
  const handleSearchPosts = async () => {
    setLoadingPosts(true);
    try {
      const postsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
      const postsSnapshot = await getDocs(postsQuery);
      
      const postsData = postsSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(post => {
          // 検索語句が空の場合は全ての投稿を表示
          if (!searchTerm.trim()) {
            return true;
          }
          // 検索語句がある場合はフィルタリング
          return (
            post.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            post.creatorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            post.userName?.toLowerCase().includes(searchTerm.toLowerCase())
          );
        })
        .slice(0, 20);

      console.log(`✅ Firestoreから${postsSnapshot.docs.length}件の投稿を取得しました`);
      console.log(`🔍 フィルタ後: ${postsData.length}件の投稿を表示`);
      if (postsData.length > 0) {
        console.log('最新の投稿:', postsData[0]);
      }
      
      setPosts(postsData);
      
      if (postsData.length === 0) {
        toast({
          title: '投稿が見つかりません',
          description: `Firestoreに投稿データがありません（検索語句: "${searchTerm}"）。先に投稿を作成してください。`,
          variant: 'destructive'
        });
      } else {
        console.log(`✅ ${postsData.length}件の投稿を表示中`);
      }
    } catch (error) {
      console.error('Error searching posts:', error);
      toast({
        title: 'エラー',
        description: '投稿の検索に失敗しました: ' + error.message,
        variant: 'destructive'
      });
    } finally {
      setLoadingPosts(false);
    }
  };

  // 投稿を追加
  const handleAddPost = async () => {
    if (!selectedPost) return;

    setIsAdding(true);
    try {
      // 現在の最大positionを取得
      const maxPosition = featuredPicks.reduce((max, pick) => 
        Math.max(max, pick.position), 0
      );

      await addDoc(collection(db, 'featuredPickups'), {
        postId: selectedPost.id,
        position: maxPosition + 1,
        addedAt: serverTimestamp(),
        addedBy: 'admin',
        isActive: true
      });

      toast({
        title: '成功',
        description: '投稿を運営Pick UPに追加しました'
      });

      setShowAddModal(false);
      setSearchTerm('');
      setPosts([]);
      setSelectedPost(null);
    } catch (error) {
      console.error('Error adding pickup:', error);
      toast({
        title: 'エラー',
        description: '投稿の追加に失敗しました',
        variant: 'destructive'
      });
    } finally {
      setIsAdding(false);
    }
  };

  // 投稿を削除
  const handleDelete = async (pickupId) => {
    if (!window.confirm('この投稿を運営Pick UPから削除しますか？')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'featuredPickups', pickupId));
      toast({
        title: '成功',
        description: '投稿を削除しました'
      });
    } catch (error) {
      console.error('Error deleting pickup:', error);
      toast({
        title: 'エラー',
        description: '投稿の削除に失敗しました',
        variant: 'destructive'
      });
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
  };

  if (loading) {
    return <AdminLoadingState message="運営Pick UPデータを読み込み中..." />;
  }

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="運営Pick UP管理"
        description="ホーム画面に表示される注目投稿を管理"
        icon={Star}
        actions={
          <>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
              data-testid="button-refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="font-medium">更新</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAddModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-pink-600 rounded-xl text-white hover:from-pink-600 hover:to-pink-700 transition-all shadow-md hover:shadow-lg"
              data-testid="button-add-pickup"
            >
              <Plus className="w-4 h-4" />
              <span className="font-medium">投稿を追加</span>
            </motion.button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AdminStatsCard
          title="掲載中の投稿"
          value={<AnimatedNumber value={stats.total} />}
          icon={Star}
          color="pink"
        />
        <AdminStatsCard
          title="総いいね数"
          value={<AnimatedNumber value={stats.totalLikes} />}
          icon={Heart}
          color="red"
        />
        <AdminStatsCard
          title="総保存数"
          value={<AnimatedNumber value={stats.totalBookmarks} />}
          icon={Bookmark}
          color="blue"
        />
        <AdminStatsCard
          title="総閲覧数"
          value={<AnimatedNumber value={stats.totalViews} />}
          icon={TrendingUp}
          color="green"
        />
      </div>

      <AdminContentCard title="掲載中の投稿">
        {featuredPicks.length > 0 ? (
          <div className="space-y-3">
            {featuredPicks.map((pick, index) => (
              <motion.div
                key={pick.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-pink-50 transition-colors group"
                data-testid={`pickup-item-${pick.id}`}
              >
                <div className="flex-shrink-0">
                  <div className="w-20 h-20 rounded-lg overflow-hidden relative shadow-md">
                    {pick.thumbnail ? (
                      <img
                        src={pick.thumbnail}
                        alt={pick.postTitle}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center">
                        <Star className="w-8 h-8 text-pink-400" />
                      </div>
                    )}
                    <div className="absolute top-1 left-1 bg-gradient-to-br from-pink-500 to-pink-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-lg">
                      {pick.position}
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate mb-1">
                    {pick.postTitle}
                  </h3>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-gray-600">{pick.userName}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Heart className="w-4 h-4 text-red-500" />
                      {pick.likes.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Bookmark className="w-4 h-4 text-blue-500" />
                      {pick.bookmarks.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      {pick.views.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleDelete(pick.id)}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    data-testid={`button-delete-${pick.id}`}
                  >
                    <Trash2 className="w-5 h-5" />
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <AdminEmptyState
            icon={Star}
            title="運営Pick UPに投稿が登録されていません"
            description="投稿を追加ボタンから最初の投稿を追加してください"
          />
        )}
      </AdminContentCard>

      {/* 投稿追加モーダル */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
              data-testid="modal-add-pickup"
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">投稿を追加</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  data-testid="button-close-modal"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="p-6">
                <div className="flex gap-2 mb-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearchPosts()}
                      placeholder="投稿タイトルやクリエイター名で検索..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                      data-testid="input-search-posts"
                    />
                  </div>
                  <button
                    onClick={handleSearchPosts}
                    disabled={loadingPosts}
                    className="px-4 py-2 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-lg hover:from-pink-600 hover:to-pink-700 transition-colors disabled:opacity-50"
                    data-testid="button-search"
                  >
                    検索
                  </button>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {loadingPosts ? (
                    <div className="text-center py-8">
                      <div className="inline-block w-8 h-8 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
                    </div>
                  ) : posts.length > 0 ? (
                    <div className="space-y-2">
                      {posts.map((post) => (
                        <div
                          key={post.id}
                          onClick={() => setSelectedPost(post)}
                          className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedPost?.id === post.id
                              ? 'bg-pink-100 border-2 border-pink-500'
                              : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                          }`}
                          data-testid={`post-option-${post.id}`}
                        >
                          <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-gray-100 to-gray-200 relative">
                            {(() => {
                              const firstFile = post.files && post.files[0];
                              const isVideo = firstFile?.type?.includes('video') || firstFile?.resourceType === 'video';
                              
                              if (isVideo && firstFile?.url) {
                                let proxyUrl = firstFile.url;
                                if (firstFile.url.includes('replit-objstore')) {
                                  const lastPublicIndex = firstFile.url.lastIndexOf('/public/');
                                  if (lastPublicIndex !== -1) {
                                    const filename = firstFile.url.substring(lastPublicIndex + '/public/'.length);
                                    proxyUrl = `/api/proxy/public/${filename}`;
                                  }
                                }
                                
                                return (
                                  <>
                                    <video
                                      src={proxyUrl}
                                      className="w-full h-full object-cover"
                                      muted
                                      playsInline
                                      preload="metadata"
                                      onLoadedData={(e) => {
                                        e.target.currentTime = 0.1;
                                      }}
                                    />
                                    <div className="absolute bottom-1 right-1 bg-black bg-opacity-70 rounded px-1 py-0.5">
                                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                      </svg>
                                    </div>
                                  </>
                                );
                              } else if (post.thumbnailUrl || post.imageUrl) {
                                return (
                                  <img
                                    src={post.thumbnailUrl || post.imageUrl}
                                    alt={post.title}
                                    className="w-full h-full object-cover"
                                  />
                                );
                              } else {
                                return (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Star className="w-6 h-6 text-gray-400" />
                                  </div>
                                );
                              }
                            })()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 truncate">
                              {post.title || 'タイトルなし'}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {post.creatorName || post.userName || 'Unknown'}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                              <span className="flex items-center gap-1">
                                <Heart className="w-3 h-3" />
                                {post.likesCount || post.likes || 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <Bookmark className="w-3 h-3" />
                                {post.bookmarksCount || post.bookmarks || 0}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : searchTerm ? (
                    <div className="text-center py-8 text-gray-500">
                      検索結果が見つかりませんでした
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      投稿を検索してください
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  data-testid="button-cancel"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddPost}
                  disabled={!selectedPost || isAdding}
                  className="px-4 py-2 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-lg hover:from-pink-600 hover:to-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="button-confirm-add"
                >
                  {isAdding ? '追加中...' : '追加'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminPageContainer>
  );
}
