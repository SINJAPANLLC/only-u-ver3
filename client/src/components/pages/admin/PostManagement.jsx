import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  Search, 
  Eye, 
  Image,
  Video,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  AlertTriangle,
  Trash2,
  EyeOff,
  X
} from 'lucide-react';
import { db } from '../../../firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
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

// カウントアップアニメーションコンポーネント
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

const PostManagement = () => {
  const { toast } = useToast();
  const [posts, setPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    published: 0,
    draft: 0,
    hidden: 0,
    flagged: 0,
    violations: 0
  });

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);

  const statusOptions = [
    { value: 'all', label: 'すべて' },
    { value: 'published', label: '公開中' },
    { value: 'draft', label: '下書き' },
    { value: 'hidden', label: '非公開' },
    { value: 'flagged', label: 'フラグ付き' }
  ];

  const typeOptions = [
    { value: 'all', label: 'すべて' },
    { value: 'video', label: '動画' },
    { value: 'image', label: '画像' },
    { value: 'text', label: 'テキスト' }
  ];

  // Firestoreから投稿データをリアルタイム取得
  useEffect(() => {
    const postsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      const postsData = snapshot.docs.map(doc => {
        const data = doc.data();
        
        // サムネイル画像のプロキシURL変換
        let thumbnail = '/api/placeholder/300/200';
        let videoUrl = null;
        const firstFile = data.files?.[0];
        
        // メディアタイプの判定
        const isVideo = firstFile?.type?.includes('video') || firstFile?.resourceType === 'video' || firstFile?.url?.match(/\.(mp4|mov|avi|webm)$/i);
        const type = isVideo ? 'video' : firstFile?.type?.includes('image') ? 'image' : 'text';
        
        if (firstFile?.url) {
          const originalUrl = firstFile.url;
          let proxyUrl = originalUrl;
          
          // Object Storageの場合、プロキシURLに変換
          if (originalUrl.includes('replit-objstore')) {
            const lastPublicIndex = originalUrl.lastIndexOf('/public/');
            if (lastPublicIndex !== -1) {
              const filename = originalUrl.substring(lastPublicIndex + '/public/'.length);
              proxyUrl = `/api/proxy/public/${filename}`;
            } else {
              proxyUrl = originalUrl;
            }
          } else if (originalUrl.startsWith('/objects/')) {
            const filename = originalUrl.replace('/objects/', '');
            proxyUrl = `/api/proxy/public/${filename}`;
          }
          
          if (isVideo) {
            videoUrl = proxyUrl;
            thumbnail = proxyUrl; // 動画もサムネイルとして表示
          } else {
            thumbnail = proxyUrl;
          }
        } else if (data.thumbnailUrl) {
          thumbnail = data.thumbnailUrl;
        } else if (data.imageUrl) {
          thumbnail = data.imageUrl;
        }
        
        // いいね数の計算（配列または数値）
        let likesCount = 0;
        if (Array.isArray(data.likes)) {
          likesCount = data.likes.length;
        } else if (typeof data.likes === 'number') {
          likesCount = data.likes;
        }
        
        return {
          id: doc.id,
          title: data.title || 'Untitled',
          description: data.explanation || data.description || '',
          creator: data.username || data.creatorName || 'Unknown',
          creatorId: data.userId || data.creatorId || '',
          type,
          status: data.visibility === 'private' ? 'hidden' : 'published',
          thumbnail,
          videoUrl, // 動画URLを追加
          duration: data.duration || '0:00',
          views: data.views || data.viewsCount || 0,
          likes: likesCount,
          comments: data.comments || data.commentsCount || 0,
          shares: data.shares || data.sharesCount || 0,
          revenue: data.revenue || 0,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          flagged: data.isFlagged || false,
          violations: data.violations || [],
          tags: Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : [],
          rawData: data // デバッグ用
        };
      });
      
      setPosts(postsData);
      setLoading(false);
      setIsRefreshing(false);
    });

    return () => unsubscribe();
  }, []);

  // フィルタリング
  useEffect(() => {
    let filtered = [...posts];

    if (searchTerm) {
      filtered = filtered.filter(post =>
        post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.creator.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(post => post.status === filterStatus);
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(post => post.type === filterType);
    }

    setFilteredPosts(filtered);
  }, [posts, searchTerm, filterStatus, filterType]);

  // 統計を更新
  useEffect(() => {
    const newStats = {
      total: posts.length,
      published: posts.filter(p => p.status === 'published').length,
      draft: posts.filter(p => p.status === 'draft').length,
      hidden: posts.filter(p => p.status === 'hidden').length,
      flagged: posts.filter(p => p.flagged).length,
      violations: posts.filter(p => p.violations.length > 0).length
    };
    setStats(newStats);
  }, [posts]);

  const handleRefresh = () => {
    setIsRefreshing(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'published': return 'text-green-600 bg-green-100';
      case 'draft': return 'text-gray-600 bg-gray-100';
      case 'hidden': return 'text-orange-600 bg-orange-100';
      case 'flagged': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'video': return <Video className="w-4 h-4" />;
      case 'image': return <Image className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const handleToggleVisibility = async (post) => {
    setIsProcessing(true);
    try {
      const postRef = doc(db, 'posts', post.id);
      const newVisibility = post.status === 'published' ? 'private' : 'public';
      
      await updateDoc(postRef, {
        visibility: newVisibility,
        updatedAt: serverTimestamp()
      });

      toast({
        title: '成功',
        description: `投稿を${newVisibility === 'private' ? '非公開' : '公開'}に設定しました`,
      });
    } catch (error) {
      console.error('Error toggling visibility:', error);
      toast({
        title: 'エラー',
        description: '公開設定の変更に失敗しました',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeletePost = async () => {
    if (!selectedPost) return;

    setIsProcessing(true);
    try {
      await deleteDoc(doc(db, 'posts', selectedPost.id));

      toast({
        title: '成功',
        description: '投稿を削除しました',
      });

      setDeleteModalOpen(false);
      setSelectedPost(null);
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: 'エラー',
        description: '投稿の削除に失敗しました',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const openDeleteModal = (post) => {
    setSelectedPost(post);
    setDeleteModalOpen(true);
  };

  const openVideoModal = (post) => {
    setSelectedVideo(post);
    setVideoModalOpen(true);
  };

  if (loading) {
    return <AdminLoadingState message="投稿データを読み込み中..." />;
  }

  return (
    <AdminPageContainer>
      {/* ページヘッダー */}
      <AdminPageHeader
        title="投稿管理"
        description="投稿の管理、ステータス確認を行います"
        icon={FileText}
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
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-pink-600 rounded-xl text-white hover:from-pink-600 hover:to-pink-700 transition-all shadow-md hover:shadow-lg"
              data-testid="button-export"
            >
              <Download className="w-4 h-4" />
              <span className="font-medium">エクスポート</span>
            </motion.button>
          </>
        }
      />

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
        <AdminStatsCard
          title="総投稿数"
          value={<AnimatedNumber value={stats.total} />}
          icon={FileText}
          color="blue"
        />
        <AdminStatsCard
          title="公開中"
          value={<AnimatedNumber value={stats.published} />}
          icon={CheckCircle}
          color="green"
        />
        <AdminStatsCard
          title="下書き"
          value={<AnimatedNumber value={stats.draft} />}
          icon={FileText}
          color="purple"
        />
        <AdminStatsCard
          title="非公開"
          value={<AnimatedNumber value={stats.hidden} />}
          icon={XCircle}
          color="orange"
        />
        <AdminStatsCard
          title="フラグ付き"
          value={<AnimatedNumber value={stats.flagged} />}
          icon={AlertTriangle}
          color="pink"
        />
        <AdminStatsCard
          title="違反"
          value={<AnimatedNumber value={stats.violations} />}
          icon={AlertTriangle}
          color="pink"
        />
      </div>

      {/* フィルターと検索 */}
      <AdminContentCard title="検索・フィルター">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="投稿を検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                data-testid="input-search"
              />
            </div>
          </div>

          <div className="md:w-48">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              data-testid="select-status"
            >
              {statusOptions.map(status => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:w-48">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              data-testid="select-type"
            >
              {typeOptions.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </AdminContentCard>

      {/* 投稿一覧テーブル */}
      <AdminTableContainer>
        {filteredPosts.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  投稿
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  タイプ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ステータス
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  統計
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  投稿日
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPosts.map((post, index) => (
                <motion.tr 
                  key={post.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className="hover:bg-pink-50 transition-colors"
                  data-testid={`row-post-${post.id}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-16 w-24 relative group">
                        {post.type === 'video' ? (
                          <>
                            <video 
                              className="h-16 w-24 rounded-lg object-cover ring-2 ring-pink-100" 
                              src={post.videoUrl}
                              muted
                              playsInline
                            />
                            <div 
                              onClick={() => openVideoModal(post)}
                              className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 rounded-lg cursor-pointer group-hover:bg-opacity-60 transition-all"
                            >
                              <Video className="w-8 h-8 text-white" />
                            </div>
                          </>
                        ) : (
                          <img 
                            className="h-16 w-24 rounded-lg object-cover ring-2 ring-pink-100" 
                            src={post.thumbnail} 
                            alt={post.title}
                          />
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-semibold text-gray-900 line-clamp-1">
                          {post.title}
                        </div>
                        <div className="text-sm text-gray-500">by {post.creator}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {getTypeIcon(post.type)}
                      <span className="text-sm text-gray-900 capitalize">{post.type}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(post.status)}`}>
                      {statusOptions.find(s => s.value === post.status)?.label || post.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      <div className="flex items-center space-x-3 text-xs">
                        <span className="text-gray-600">閲覧: <span className="font-semibold text-gray-900">{post.views}</span></span>
                        <span className="text-gray-600">いいね: <span className="font-semibold text-gray-900">{post.likes}</span></span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(post.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      {post.status === 'published' ? (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleToggleVisibility(post)}
                          disabled={isProcessing}
                          className="flex items-center space-x-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors disabled:opacity-50"
                          data-testid={`button-hide-${post.id}`}
                        >
                          <EyeOff className="w-3 h-3" />
                          <span>非公開</span>
                        </motion.button>
                      ) : (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleToggleVisibility(post)}
                          disabled={isProcessing}
                          className="flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
                          data-testid={`button-publish-${post.id}`}
                        >
                          <Eye className="w-3 h-3" />
                          <span>公開</span>
                        </motion.button>
                      )}
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => openDeleteModal(post)}
                        disabled={isProcessing}
                        className="flex items-center space-x-1 px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                        data-testid={`button-delete-${post.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>削除</span>
                      </motion.button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        ) : (
          <AdminEmptyState
            icon={FileText}
            title="投稿が見つかりません"
            description="検索条件を変更してください"
          />
        )}
      </AdminTableContainer>

      {/* 動画再生モーダル */}
      <AnimatePresence>
        {videoModalOpen && selectedVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
            onClick={() => setVideoModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">{selectedVideo.title}</h2>
                  <button
                    onClick={() => setVideoModalOpen(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="mb-4">
                  <video 
                    className="w-full rounded-xl" 
                    controls
                    autoPlay
                    src={selectedVideo.videoUrl}
                  >
                    お使いのブラウザは動画タグをサポートしていません。
                  </video>
                </div>
                <div className="text-sm text-gray-600">
                  <p><strong>クリエイター:</strong> {selectedVideo.creator}</p>
                  <p className="mt-2">{selectedVideo.description}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 削除確認モーダル */}
      <AnimatePresence>
        {deleteModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => !isProcessing && setDeleteModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
              data-testid="modal-delete-post"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">投稿を削除</h3>
                </div>
                <button
                  onClick={() => !isProcessing && setDeleteModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={isProcessing}
                  data-testid="button-close-delete-modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {selectedPost && (
                <>
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <img
                        src={selectedPost.thumbnail}
                        alt={selectedPost.title}
                        className="w-20 h-14 rounded-lg object-cover"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 line-clamp-1">{selectedPost.title}</div>
                        <div className="text-sm text-gray-500">by {selectedPost.creator}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">
                      <strong>警告:</strong> この投稿を削除すると、すべてのコメント、いいね、統計情報が完全に削除されます。この操作は取り消せません。
                    </p>
                  </div>
                </>
              )}

              <div className="flex space-x-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setDeleteModalOpen(false)}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  data-testid="button-cancel-delete"
                >
                  キャンセル
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDeletePost}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all disabled:opacity-50"
                  data-testid="button-confirm-delete"
                >
                  {isProcessing ? '削除中...' : '削除する'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminPageContainer>
  );
};

export default PostManagement;
