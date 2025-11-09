import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Users, TrendingUp, XCircle, MessageSquare, Calendar, RefreshCw, X } from 'lucide-react';
import { collection, query, getDocs, orderBy, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useToast } from '../../../hooks/use-toast';

export default function MatchManagement() {
  const { toast } = useToast();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalMatches: 0,
    todayMatches: 0,
    thisWeekMatches: 0,
    thisMonthMatches: 0,
  });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async (skipLoading = false) => {
    try {
      if (!skipLoading) {
        setLoading(true);
      }
      const q = query(collection(db, 'matches'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      const matchesData = snapshot.docs.map(docSnap => ({ 
        id: docSnap.id, 
        ...docSnap.data() 
      }));

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // ユニークなユーザーIDを収集
      const userIds = [...new Set(
        matchesData.flatMap(match => [match.user1Id, match.user2Id]).filter(Boolean)
      )];
      
      // 全てのユーザー情報を並列取得（Promise.allSettledでエラー耐性）
      const userMap = {};
      if (userIds.length > 0) {
        const userResults = await Promise.allSettled(
          userIds.map(id => getDoc(doc(db, 'users', id)))
        );
        
        userResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value.exists()) {
            userMap[userIds[index]] = {
              displayName: result.value.data().displayName || 'Unknown',
              email: result.value.data().email || '',
              photoURL: result.value.data().photoURL || '',
            };
          } else if (result.status === 'rejected') {
            console.warn(`Failed to fetch user ${userIds[index]}:`, result.reason);
          }
        });
      }

      // ユーザー情報と統計を計算
      let todayCount = 0;
      let weekCount = 0;
      let monthCount = 0;

      matchesData.forEach(match => {
        // ユーザー1の情報
        if (match.user1Id && userMap[match.user1Id]) {
          match.user1Name = userMap[match.user1Id].displayName;
          match.user1Email = userMap[match.user1Id].email;
          match.user1Avatar = userMap[match.user1Id].photoURL;
        } else {
          match.user1Name = 'Unknown';
          match.user1Email = match.user1Id || '';
          match.user1Avatar = '';
        }

        // ユーザー2の情報
        if (match.user2Id && userMap[match.user2Id]) {
          match.user2Name = userMap[match.user2Id].displayName;
          match.user2Email = userMap[match.user2Id].email;
          match.user2Avatar = userMap[match.user2Id].photoURL;
        } else {
          match.user2Name = 'Unknown';
          match.user2Email = match.user2Id || '';
          match.user2Avatar = '';
        }

        // 統計計算
        const matchDate = match.createdAt?.toDate ? match.createdAt.toDate() : new Date(match.createdAt);
        if (matchDate >= todayStart) todayCount++;
        if (matchDate >= weekStart) weekCount++;
        if (matchDate >= monthStart) monthCount++;
      });

      setMatches(matchesData);
      
      // 正確な統計を計算
      fetchAccurateStats(matchesData);
    } catch (error) {
      console.error('Error fetching matches:', error);
      toast({
        title: 'エラー',
        description: 'マッチの取得に失敗しました',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAccurateStats = (matchesData) => {
    const dataToUse = matchesData || matches;
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    let todayCount = 0;
    let weekCount = 0;
    let monthCount = 0;

    dataToUse.forEach(match => {
      const matchDate = match.createdAt?.toDate ? match.createdAt.toDate() : new Date(match.createdAt);
      if (matchDate >= todayStart) todayCount++;
      if (matchDate >= weekStart) weekCount++;
      if (matchDate >= monthStart) monthCount++;
    });

    setStats({
      totalMatches: dataToUse.length,
      todayMatches: todayCount,
      thisWeekMatches: weekCount,
      thisMonthMatches: monthCount,
    });
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await fetchMatches(true); // skipLoading = true
      toast({
        title: '更新完了',
        description: 'マッチを更新しました',
      });
    } catch (error) {
      console.error('Error refreshing:', error);
      toast({
        title: 'エラー',
        description: '更新に失敗しました',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const openDeleteModal = (match) => {
    setSelectedMatch(match);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setSelectedMatch(null);
  };

  const handleDeleteMatch = async () => {
    if (!selectedMatch) return;

    try {
      setIsProcessing(true);
      await deleteDoc(doc(db, 'matches', selectedMatch.id));
      
      // ローカル状態から削除
      const updatedMatches = matches.filter(match => match.id !== selectedMatch.id);
      setMatches(updatedMatches);

      // 統計を更新
      fetchAccurateStats(updatedMatches);

      toast({
        title: '削除完了',
        description: 'マッチを削除しました',
      });

      closeDeleteModal();
    } catch (error) {
      console.error('Error deleting match:', error);
      toast({
        title: 'エラー',
        description: 'マッチの削除に失敗しました',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('ja-JP');
  };

  const getProxyImageUrl = (url) => {
    if (!url) return '/logo192.png';
    if (url.startsWith('/') || url.startsWith('data:') || url.startsWith('blob:')) return url;
    if (url.includes('only-u.fun') || url.includes('bunnycdn')) {
      const path = url.split('/').slice(-2).join('/');
      return `/api/proxy/${path}`;
    }
    return url;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-pink-500 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Heart className="w-8 h-8 mr-3 text-pink-500" />
            マッチング管理
          </h1>
          <p className="mt-2 text-gray-600">ユーザー間のマッチングの監視と管理</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center px-4 py-2 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-lg hover:from-pink-600 hover:to-pink-700 transition-all disabled:opacity-50"
          data-testid="button-refresh"
        >
          <RefreshCw className={`w-5 h-5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? '更新中...' : '更新'}
        </motion.button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">総マッチ数</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalMatches}</p>
            </div>
            <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center">
              <Heart className="w-6 h-6 text-pink-600" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">今日のマッチ</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.todayMatches}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">今週のマッチ</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{stats.thisWeekMatches}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">今月のマッチ</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{stats.thisMonthMatches}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Matches Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">マッチ一覧</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ユーザー1
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  マッチ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ユーザー2
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  チャットルームID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  マッチ日時
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  アクション
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {matches.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    マッチがありません
                  </td>
                </tr>
              ) : (
                matches.map((match) => (
                  <tr key={match.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <img
                          src={getProxyImageUrl(match.user1Avatar)}
                          alt={match.user1Name}
                          className="w-10 h-10 rounded-full object-cover border border-gray-200"
                          onError={(e) => { e.target.src = '/logo192.png'; }}
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">{match.user1Name || 'Unknown'}</span>
                          <span className="text-xs text-gray-500">{match.user1Email || match.user1Id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center">
                        <Heart className="w-5 h-5 text-pink-500 fill-pink-500" />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <img
                          src={getProxyImageUrl(match.user2Avatar)}
                          alt={match.user2Name}
                          className="w-10 h-10 rounded-full object-cover border border-gray-200"
                          onError={(e) => { e.target.src = '/logo192.png'; }}
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">{match.user2Name || 'Unknown'}</span>
                          <span className="text-xs text-gray-500">{match.user2Email || match.user2Id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-sm text-gray-500">
                        <MessageSquare className="w-4 h-4 mr-1 text-gray-400" />
                        <span className="font-mono text-xs">{match.chatRoomId || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(match.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => openDeleteModal(match)}
                        className="inline-flex items-center px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                        data-testid={`button-delete-match-${match.id}`}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        削除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 削除確認モーダル */}
      <AnimatePresence>
        {deleteModalOpen && selectedMatch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => !isProcessing && closeDeleteModal()}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
              data-testid="modal-delete-match"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <XCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">マッチ削除</h3>
                </div>
                <button
                  onClick={() => !isProcessing && closeDeleteModal()}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={isProcessing}
                  data-testid="button-close-delete-modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
                <div className="flex items-center space-x-3">
                  <img
                    src={getProxyImageUrl(selectedMatch.user1Avatar)}
                    alt={selectedMatch.user1Name}
                    className="w-10 h-10 rounded-full object-cover border border-gray-200"
                    onError={(e) => { e.target.src = '/logo192.png'; }}
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{selectedMatch.user1Name}</div>
                    <div className="text-sm text-gray-500">{selectedMatch.user1Email}</div>
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <Heart className="w-5 h-5 text-pink-500 fill-pink-500" />
                </div>
                <div className="flex items-center space-x-3">
                  <img
                    src={getProxyImageUrl(selectedMatch.user2Avatar)}
                    alt={selectedMatch.user2Name}
                    className="w-10 h-10 rounded-full object-cover border border-gray-200"
                    onError={(e) => { e.target.src = '/logo192.png'; }}
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{selectedMatch.user2Name}</div>
                    <div className="text-sm text-gray-500">{selectedMatch.user2Email}</div>
                  </div>
                </div>
              </div>

              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  このマッチを削除してもよろしいですか？<br />
                  <span className="font-semibold text-red-600">この操作は取り消すことができません。</span><br />
                  <span className="text-xs text-gray-600">チャットルームも削除されます。</span>
                </p>
              </div>

              <div className="flex space-x-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={closeDeleteModal}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  data-testid="button-cancel-delete"
                >
                  キャンセル
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDeleteMatch}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all disabled:opacity-50"
                  data-testid="button-confirm-delete"
                >
                  {isProcessing ? '削除中...' : 'マッチを削除'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
