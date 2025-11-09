import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Video, Eye, MessageSquare, Clock, User, XCircle, CheckCircle, Play, Pause } from 'lucide-react';
import { collection, query, getDocs, orderBy, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';

export default function LiveStreamManagement() {
  const [liveRooms, setLiveRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRooms: 0,
    activeRooms: 0,
    totalViewers: 0,
    averageViewers: 0,
  });
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchLiveRooms();
  }, []);

  const fetchLiveRooms = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'liveRooms'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      const roomsData = snapshot.docs.map(docSnap => ({ 
        id: docSnap.id, 
        ...docSnap.data() 
      }));

      // ユニークなcreatorIdを収集
      const creatorIds = [...new Set(roomsData.map(room => room.creatorId).filter(Boolean))];
      
      // 全てのユーザー情報を並列取得
      const userMap = {};
      if (creatorIds.length > 0) {
        const userDocs = await Promise.all(
          creatorIds.map(id => getDoc(doc(db, 'users', id)))
        );
        
        userDocs.forEach((userDoc, index) => {
          if (userDoc.exists()) {
            userMap[creatorIds[index]] = {
              displayName: userDoc.data().displayName || 'Unknown',
              email: userDoc.data().email || '',
            };
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
        } else {
          room.creatorName = 'Unknown';
          room.creatorEmail = room.creatorId || '';
        }
        
        if (room.status === 'active') {
          activeCount++;
          totalViewers += room.viewerCount || 0;
        }
      });

      setLiveRooms(roomsData);
      setStats({
        totalRooms: roomsData.length,
        activeRooms: activeCount,
        totalViewers,
        averageViewers: activeCount > 0 ? Math.round(totalViewers / activeCount) : 0,
      });
    } catch (error) {
      console.error('Error fetching live rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEndStream = async (roomId) => {
    if (!window.confirm('このライブ配信を終了しますか？')) return;

    try {
      await updateDoc(doc(db, 'liveRooms', roomId), {
        status: 'ended',
        endedAt: new Date(),
      });
      fetchLiveRooms();
    } catch (error) {
      console.error('Error ending stream:', error);
      alert('配信の終了に失敗しました');
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!window.confirm('このライブルームを完全に削除しますか？')) return;

    try {
      await deleteDoc(doc(db, 'liveRooms', roomId));
      fetchLiveRooms();
    } catch (error) {
      console.error('Error deleting room:', error);
      alert('ルームの削除に失敗しました');
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <Video className="w-8 h-8 mr-3 text-pink-500" />
          ライブ配信管理
        </h1>
        <p className="mt-2 text-gray-600">ライブ配信ルームの監視と管理</p>
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
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">ライブルーム一覧</h2>
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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  アクション
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {liveRooms.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    ライブルームがありません
                  </td>
                </tr>
              ) : (
                liveRooms.map((room) => (
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
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      {room.status === 'active' && (
                        <button
                          onClick={() => handleEndStream(room.id)}
                          className="inline-flex items-center px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors"
                          data-testid={`button-end-${room.id}`}
                        >
                          <Pause className="w-4 h-4 mr-1" />
                          終了
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteRoom(room.id)}
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
    </div>
  );
}
