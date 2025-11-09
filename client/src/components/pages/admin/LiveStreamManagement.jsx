import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, Eye, MessageSquare, Clock, User, XCircle, CheckCircle, Play, Pause, RefreshCw, AlertTriangle, X } from 'lucide-react';
import { collection, query, getDocs, orderBy, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useToast } from '../../../hooks/use-toast';

export default function LiveStreamManagement() {
  const { toast } = useToast();
  const [liveRooms, setLiveRooms] = useState([]);
  const [filteredRooms, setFilteredRooms] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'ended'
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalRooms: 0,
    activeRooms: 0,
    endedRooms: 0,
    totalViewers: 0,
    averageViewers: 0,
  });
  const [statsError, setStatsError] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchLiveRooms();
  }, []);

  // フィルター適用
  useEffect(() => {
    if (statusFilter === 'all') {
      setFilteredRooms(liveRooms);
    } else if (statusFilter === 'active') {
      setFilteredRooms(liveRooms.filter(room => room.status === 'active' || room.isActive === true));
    } else if (statusFilter === 'ended') {
      setFilteredRooms(liveRooms.filter(room => room.status === 'ended' || room.isActive === false));
    }
  }, [statusFilter, liveRooms]);

  const fetchLiveRooms = async (skipLoading = false) => {
    try {
      if (!skipLoading) {
        setLoading(true);
      }
      const q = query(collection(db, 'liveRooms'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      const roomsData = snapshot.docs.map(docSnap => ({ 
        id: docSnap.id, 
        ...docSnap.data() 
      }));

      // ユニークなcreatorIdを収集
      const creatorIds = [...new Set(roomsData.map(room => room.creatorId).filter(Boolean))];
      
      // 全てのユーザー情報を並列取得（Promise.allSettledでエラー耐性）
      const userMap = {};
      if (creatorIds.length > 0) {
        const userResults = await Promise.allSettled(
          creatorIds.map(id => getDoc(doc(db, 'users', id)))
        );
        
        userResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value.exists()) {
            userMap[creatorIds[index]] = {
              displayName: result.value.data().displayName || 'Unknown',
              email: result.value.data().email || '',
              photoURL: result.value.data().photoURL || '',
            };
          } else if (result.status === 'rejected') {
            console.warn(`Failed to fetch user ${creatorIds[index]}:`, result.reason);
          }
        });
      }

      // ユーザー情報をルームデータにマッピング
      let totalViewers = 0;
      let activeCount = 0;
      
      roomsData.forEach(room => {
        if (room.creatorId && userMap[room.creatorId]) {
          room.creatorName = userMap[room.creatorId].displayName;
          room.creatorEmail = userMap[room.creatorId].email;
          room.creatorPhotoURL = userMap[room.creatorId].photoURL;
        } else {
          room.creatorName = 'Unknown';
          room.creatorEmail = room.creatorId || '';
          room.creatorPhotoURL = '';
        }
        
        if (room.status === 'active') {
          activeCount++;
          totalViewers += room.viewerCount || 0;
        }
      });

      setLiveRooms(roomsData);
      setFilteredRooms(roomsData); // 初期表示は全て
      
      // 正確な統計を取得（新しく取得したroomsDataを渡す）
      await fetchAccurateStats(roomsData);
    } catch (error) {
      console.error('Error fetching live rooms:', error);
      toast({
        title: 'エラー',
        description: 'ライブルームの取得に失敗しました',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAccurateStats = async (roomsData) => {
    try {
      setStatsError(false);
      
      // 全ての統計を同じroomsDataから計算して一貫性を保つ
      const dataToUse = roomsData || liveRooms;
      
      // ローカルデータから統計を計算
      let totalRooms = dataToUse.length;
      let activeRooms = 0;
      let endedRooms = 0;
      let totalViewers = 0;

      dataToUse.forEach(room => {
        if (room.status === 'active' || room.isActive === true) {
          activeRooms++;
          totalViewers += room.viewerCount || 0;
        } else if (room.status === 'ended' || room.isActive === false) {
          endedRooms++;
        }
      });

      const averageViewers = activeRooms > 0 
        ? Math.round(totalViewers / activeRooms) 
        : 0;

      setStats({
        totalRooms,
        activeRooms,
        endedRooms,
        totalViewers,
        averageViewers,
      });

      if (statsError) {
        toast({
          title: '警告',
          description: '一部の統計の取得に失敗しました',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching accurate stats:', error);
      setStatsError(true);
      toast({
        title: 'エラー',
        description: '統計の取得に失敗しました',
        variant: 'destructive',
      });
    }
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await fetchLiveRooms(true); // skipLoading = true
      toast({
        title: '更新完了',
        description: 'ライブルームを更新しました',
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

  const openEndModal = (room) => {
    setSelectedRoom(room);
    setEndModalOpen(true);
  };

  const closeEndModal = () => {
    setEndModalOpen(false);
    setSelectedRoom(null);
  };

  const openDeleteModal = (room) => {
    setSelectedRoom(room);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setSelectedRoom(null);
  };

  const handleEndStream = async () => {
    if (!selectedRoom) return;

    try {
      setIsProcessing(true);
      await updateDoc(doc(db, 'liveRooms', selectedRoom.id), {
        status: 'ended',
        endedAt: new Date(),
      });
      
      // ローカル状態を更新
      const updatedRooms = liveRooms.map(room =>
        room.id === selectedRoom.id
          ? { ...room, status: 'ended', endedAt: new Date() }
          : room
      );
      setLiveRooms(updatedRooms);

      // 統計を更新（更新されたroomsDataを渡す）
      await fetchAccurateStats(updatedRooms);

      toast({
        title: '配信終了',
        description: 'ライブ配信を終了しました',
      });

      closeEndModal();
    } catch (error) {
      console.error('Error ending stream:', error);
      toast({
        title: 'エラー',
        description: '配信の終了に失敗しました',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!selectedRoom) return;

    try {
      setIsProcessing(true);
      await deleteDoc(doc(db, 'liveRooms', selectedRoom.id));
      
      // ローカル状態から削除
      const updatedRooms = liveRooms.filter(room => room.id !== selectedRoom.id);
      setLiveRooms(updatedRooms);

      // 統計を更新（更新されたroomsDataを渡す）
      await fetchAccurateStats(updatedRooms);

      toast({
        title: '削除完了',
        description: 'ライブルームを削除しました',
      });

      closeDeleteModal();
    } catch (error) {
      console.error('Error deleting room:', error);
      toast({
        title: 'エラー',
        description: 'ルームの削除に失敗しました',
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

  const getStatusBadge = (status) => {
    const badges = {
      active: { color: 'bg-green-100 text-green-800 border-green-200', icon: Play, text: '配信中' },
      ended: { color: 'bg-gray-100 text-gray-800 border-gray-200', icon: Pause, text: '終了' },
      scheduled: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Clock, text: '予約' },
    };
    
    const badge = badges[status] || badges.ended;
    const Icon = badge.icon;
    
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${badge.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {badge.text}
      </span>
    );
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
            <Video className="w-8 h-8 mr-3 text-pink-500" />
            ライブ配信管理
          </h1>
          <p className="mt-2 text-gray-600">ライブ配信ルームの監視と管理</p>
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

      {/* Stats Error Warning */}
      {statsError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start"
        >
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-yellow-800">統計の取得に一部失敗しました</h3>
            <p className="text-sm text-yellow-700 mt-1">
              一部の統計が正確でない可能性があります。更新ボタンを押して再試行してください。
            </p>
          </div>
        </motion.div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">総ルーム数</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalRooms}</p>
            </div>
            <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center">
              <Video className="w-6 h-6 text-pink-600" />
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
              <p className="text-sm text-gray-600">配信中</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.activeRooms}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Play className="w-6 h-6 text-green-600" />
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
              <p className="text-sm text-gray-600">総視聴者数</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{stats.totalViewers}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Eye className="w-6 h-6 text-blue-600" />
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
              <p className="text-sm text-gray-600">平均視聴者数</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{stats.averageViewers}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <User className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Live Rooms Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">ライブルーム一覧</h2>
          
          {/* フィルターボタン */}
          <div className="flex gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              data-testid="filter-all"
            >
              全て ({stats.totalRooms})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'active'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              data-testid="filter-active"
            >
              配信中 ({stats.activeRooms})
            </button>
            <button
              onClick={() => setStatusFilter('ended')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'ended'
                  ? 'bg-gray-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              data-testid="filter-ended"
            >
              終了 ({stats.endedRooms})
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ステータス
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  配信者
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  タイトル
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  視聴者数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  開始時刻
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  終了時刻
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  アクション
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRooms.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    {statusFilter === 'active' && 'アクティブな配信はありません'}
                    {statusFilter === 'ended' && '終了した配信はありません'}
                    {statusFilter === 'all' && 'ライブルームがありません'}
                  </td>
                </tr>
              ) : (
                filteredRooms.map((room) => (
                  <tr key={room.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(room.status)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">{room.creatorName || 'Unknown'}</span>
                        <span className="text-xs text-gray-500">{room.creatorEmail || room.creatorId}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900">{room.title || '無題の配信'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Eye className="w-4 h-4 mr-1 text-gray-400" />
                        {room.viewerCount || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(room.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {room.endedAt ? formatDate(room.endedAt) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      {room.status === 'active' && (
                        <button
                          onClick={() => openEndModal(room)}
                          className="inline-flex items-center px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors"
                          data-testid={`button-end-${room.id}`}
                        >
                          <Pause className="w-4 h-4 mr-1" />
                          終了
                        </button>
                      )}
                      <button
                        onClick={() => openDeleteModal(room)}
                        className="inline-flex items-center px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                        data-testid={`button-delete-${room.id}`}
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

      {/* 配信終了確認モーダル */}
      <AnimatePresence>
        {endModalOpen && selectedRoom && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => !isProcessing && closeEndModal()}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
              data-testid="modal-end-stream"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Pause className="w-6 h-6 text-yellow-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">配信終了</h3>
                </div>
                <button
                  onClick={() => !isProcessing && closeEndModal()}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={isProcessing}
                  data-testid="button-close-end-modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  {selectedRoom.creatorPhotoURL ? (
                    <img
                      src={selectedRoom.creatorPhotoURL}
                      alt={selectedRoom.creatorName}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center text-white font-semibold">
                      {selectedRoom.creatorName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-gray-900">{selectedRoom.creatorName}</div>
                    <div className="text-sm text-gray-500">{selectedRoom.title || '無題の配信'}</div>
                  </div>
                </div>
              </div>

              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  このライブ配信を終了してもよろしいですか？<br />
                  配信は停止され、視聴者は配信を見ることができなくなります。
                </p>
              </div>

              <div className="flex space-x-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={closeEndModal}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  data-testid="button-cancel-end"
                >
                  キャンセル
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleEndStream}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all disabled:opacity-50"
                  data-testid="button-confirm-end"
                >
                  {isProcessing ? '終了中...' : '配信を終了'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 削除確認モーダル */}
      <AnimatePresence>
        {deleteModalOpen && selectedRoom && (
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
              data-testid="modal-delete-room"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <XCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">ルーム削除</h3>
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

              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  {selectedRoom.creatorPhotoURL ? (
                    <img
                      src={selectedRoom.creatorPhotoURL}
                      alt={selectedRoom.creatorName}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center text-white font-semibold">
                      {selectedRoom.creatorName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-gray-900">{selectedRoom.creatorName}</div>
                    <div className="text-sm text-gray-500">{selectedRoom.title || '無題の配信'}</div>
                  </div>
                </div>
              </div>

              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  このライブルームを完全に削除してもよろしいですか？<br />
                  <span className="font-semibold text-red-600">この操作は取り消すことができません。</span>
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
                  onClick={handleDeleteRoom}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all disabled:opacity-50"
                  data-testid="button-confirm-delete"
                >
                  {isProcessing ? '削除中...' : 'ルームを削除'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
