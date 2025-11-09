import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Users, XCircle, Eye, RefreshCw, X } from 'lucide-react';
import { collection, query, getDocs, orderBy, doc, deleteDoc, getDoc, limit as firestoreLimit, getCountFromServer } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useToast } from '../../../hooks/use-toast';

export default function MessageManagement() {
  const { toast } = useToast();
  const [chatRooms, setChatRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [showMessages, setShowMessages] = useState(false);
  const [stats, setStats] = useState({
    totalChatRooms: 0,
    totalMessages: 0,
    activeChatRooms: 0,
  });
  const [deleteMessageModalOpen, setDeleteMessageModalOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchChatRooms();
  }, []);

  const fetchChatRooms = async (skipLoading = false) => {
    try {
      if (!skipLoading) {
        setLoading(true);
      }
      
      // マッチからチャットルームIDを取得
      const matchesQuery = query(collection(db, 'matches'), orderBy('createdAt', 'desc'));
      const matchesSnapshot = await getDocs(matchesQuery);
      
      const matchesData = matchesSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(match => match.chatRoomId);

      // ユニークなユーザーIDを収集
      const userIds = [...new Set(
        matchesData.flatMap(match => [match.user1Id, match.user2Id]).filter(Boolean)
      )];

      // ユーザー情報とメッセージ数を並列取得
      const [userDocs, messageCounts] = await Promise.all([
        Promise.all(userIds.map(id => getDoc(doc(db, 'users', id)))),
        Promise.all(matchesData.map(match => 
          getCountFromServer(collection(db, `chatRooms/${match.chatRoomId}/messages`))
            .catch(() => ({ data: () => ({ count: 0 }) })) // エラー時は0を返す
        ))
      ]);

      // ユーザー情報をマップに変換
      const userMap = {};
      userDocs.forEach((userDoc, index) => {
        if (userDoc.exists()) {
          userMap[userIds[index]] = {
            displayName: userDoc.data().displayName || 'Unknown',
            photoURL: userDoc.data().photoURL || '',
          };
        }
      });

      // ルームデータを構築
      let totalMessages = 0;
      const roomsData = matchesData.map((match, index) => {
        const messageCount = messageCounts[index].data().count;
        totalMessages += messageCount;

        return {
          chatRoomId: match.chatRoomId,
          user1Name: userMap[match.user1Id]?.displayName || 'Unknown',
          user2Name: userMap[match.user2Id]?.displayName || 'Unknown',
          user1Avatar: userMap[match.user1Id]?.photoURL || '',
          user2Avatar: userMap[match.user2Id]?.photoURL || '',
          messageCount,
          createdAt: match.createdAt,
          lastActive: match.lastMessageAt || match.createdAt,
        };
      });

      // メッセージ数でソート
      roomsData.sort((a, b) => b.messageCount - a.messageCount);

      setChatRooms(roomsData);
      
      // 正確な統計を計算
      fetchAccurateStats(roomsData);
    } catch (error) {
      console.error('Error fetching chat rooms:', error);
      toast({
        title: 'エラー',
        description: 'チャットルームの取得に失敗しました',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAccurateStats = (roomsData) => {
    const dataToUse = roomsData || chatRooms;
    
    const totalMessages = dataToUse.reduce((sum, room) => sum + room.messageCount, 0);
    const activeChatRooms = dataToUse.filter(r => r.messageCount > 0).length;
    
    setStats({
      totalChatRooms: dataToUse.length,
      totalMessages,
      activeChatRooms,
    });
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await fetchChatRooms(true); // skipLoading = true
      toast({
        title: '更新完了',
        description: 'チャットルームを更新しました',
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

  const fetchMessages = async (chatRoomId, skipLoading = false) => {
    try {
      if (!skipLoading) {
        setLoading(true);
      }
      const messagesQuery = query(
        collection(db, `chatRooms/${chatRoomId}/messages`),
        orderBy('timestamp', 'desc'),
        firestoreLimit(100)
      );
      const messagesSnapshot = await getDocs(messagesQuery);
      
      const messagesData = messagesSnapshot.docs.map(docSnap => ({ 
        id: docSnap.id, 
        ...docSnap.data() 
      }));

      // ユニークな送信者IDを収集
      const senderIds = [...new Set(messagesData.map(msg => msg.senderId).filter(Boolean))];

      // 送信者情報を並列取得
      const userMap = {};
      if (senderIds.length > 0) {
        const userDocs = await Promise.all(
          senderIds.map(id => getDoc(doc(db, 'users', id)))
        );

        userDocs.forEach((userDoc, index) => {
          if (userDoc.exists()) {
            userMap[senderIds[index]] = userDoc.data().displayName || 'Unknown';
          }
        });
      }

      // 送信者名をマッピング
      messagesData.forEach(message => {
        message.senderName = userMap[message.senderId] || 'Unknown';
      });
      
      setMessages(messagesData);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: 'エラー',
        description: 'メッセージの取得に失敗しました',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const openDeleteMessageModal = (message) => {
    setSelectedMessage(message);
    setDeleteMessageModalOpen(true);
  };

  const closeDeleteMessageModal = () => {
    setDeleteMessageModalOpen(false);
    setSelectedMessage(null);
  };

  const handleViewMessages = async (room) => {
    setSelectedRoom(room);
    setShowMessages(true);
    await fetchMessages(room.chatRoomId);
  };

  const handleDeleteMessage = async () => {
    if (!selectedMessage || !selectedRoom) return;

    try {
      setIsProcessing(true);
      await deleteDoc(doc(db, `chatRooms/${selectedRoom.chatRoomId}/messages`, selectedMessage.id));
      
      // ローカル状態からメッセージを削除
      const updatedMessages = messages.filter(msg => msg.id !== selectedMessage.id);
      setMessages(updatedMessages);
      
      // チャットルームのメッセージ数を更新（0でクランプ）
      const updatedChatRooms = chatRooms.map(room => {
        if (room.chatRoomId === selectedRoom.chatRoomId) {
          return { ...room, messageCount: Math.max(0, room.messageCount - 1) };
        }
        return room;
      });
      
      setChatRooms(updatedChatRooms);
      
      // 統計を更新
      fetchAccurateStats(updatedChatRooms);

      toast({
        title: '削除完了',
        description: 'メッセージを削除しました',
      });

      closeDeleteMessageModal();
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: 'エラー',
        description: 'メッセージの削除に失敗しました',
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

  if (loading && !showMessages) {
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
            <MessageSquare className="w-8 h-8 mr-3 text-pink-500" />
            メッセージ管理
          </h1>
          <p className="mt-2 text-gray-600">チャットルームとメッセージの監視と管理</p>
        </div>
        {!showMessages && (
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
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">総チャットルーム数</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalChatRooms}</p>
            </div>
            <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-pink-600" />
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
              <p className="text-sm text-gray-600">総メッセージ数</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{stats.totalMessages}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
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
              <p className="text-sm text-gray-600">アクティブなルーム</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.activeChatRooms}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Chat Rooms Table or Messages View */}
      {!showMessages ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">チャットルーム一覧</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    参加者
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    メッセージ数
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    最終アクティブ
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    アクション
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {chatRooms.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                      チャットルームがありません
                    </td>
                  </tr>
                ) : (
                  chatRooms.map((room) => (
                    <tr key={room.chatRoomId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center -space-x-2">
                            <img
                              src={getProxyImageUrl(room.user1Avatar)}
                              alt={room.user1Name}
                              className="w-8 h-8 rounded-full object-cover border-2 border-white"
                              onError={(e) => { e.target.src = '/logo192.png'; }}
                            />
                            <img
                              src={getProxyImageUrl(room.user2Avatar)}
                              alt={room.user2Name}
                              className="w-8 h-8 rounded-full object-cover border-2 border-white"
                              onError={(e) => { e.target.src = '/logo192.png'; }}
                            />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">
                              {room.user1Name} & {room.user2Name}
                            </span>
                            <span className="text-xs text-gray-500 font-mono">{room.chatRoomId}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 font-semibold">{room.messageCount}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(room.lastActive)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleViewMessages(room)}
                          className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                          data-testid={`button-view-${room.chatRoomId}`}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          メッセージを見る
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedRoom.user1Name} & {selectedRoom.user2Name}
              </h2>
              <p className="text-sm text-gray-500 font-mono">{selectedRoom.chatRoomId}</p>
            </div>
            <button
              onClick={() => setShowMessages(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              data-testid="button-back-to-rooms"
            >
              戻る
            </button>
          </div>
          
          <div className="p-6 max-h-96 overflow-y-auto space-y-4">
            {messages.length === 0 ? (
              <p className="text-center text-gray-500">メッセージがありません</p>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900">{message.senderName || 'Unknown'}</span>
                      <span className="text-xs text-gray-500">{formatDate(message.timestamp)}</span>
                    </div>
                    <p className="text-sm text-gray-700">{message.text || message.message || '(画像メッセージ)'}</p>
                    {message.imageUrl && (
                      <img
                        src={getProxyImageUrl(message.imageUrl)}
                        alt="Message attachment"
                        className="mt-2 max-w-xs rounded-lg"
                      />
                    )}
                  </div>
                  <button
                    onClick={() => openDeleteMessageModal(message)}
                    className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                    data-testid={`button-delete-message-${message.id}`}
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* メッセージ削除確認モーダル */}
      <AnimatePresence>
        {deleteMessageModalOpen && selectedMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => !isProcessing && closeDeleteMessageModal()}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
              data-testid="modal-delete-message"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <XCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">メッセージ削除</h3>
                </div>
                <button
                  onClick={() => !isProcessing && closeDeleteMessageModal()}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={isProcessing}
                  data-testid="button-close-delete-modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">{selectedMessage.senderName}</span>
                  <span className="text-xs text-gray-500">{formatDate(selectedMessage.timestamp)}</span>
                </div>
                <p className="text-sm text-gray-700 break-words">{selectedMessage.text || selectedMessage.message || '(画像メッセージ)'}</p>
                {selectedMessage.imageUrl && (
                  <img
                    src={getProxyImageUrl(selectedMessage.imageUrl)}
                    alt="Message attachment"
                    className="mt-2 max-w-full rounded-lg"
                  />
                )}
              </div>

              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  このメッセージを削除してもよろしいですか？<br />
                  <span className="font-semibold text-red-600">この操作は取り消すことができません。</span>
                </p>
              </div>

              <div className="flex space-x-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={closeDeleteMessageModal}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  data-testid="button-cancel-delete"
                >
                  キャンセル
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDeleteMessage}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all disabled:opacity-50"
                  data-testid="button-confirm-delete"
                >
                  {isProcessing ? '削除中...' : 'メッセージを削除'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
