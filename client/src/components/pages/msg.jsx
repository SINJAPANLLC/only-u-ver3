import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Send, ArrowLeft, MoreVertical, Plus, X, Users, ChevronRight, Sparkles, MessageCircle, Image, Gift } from 'lucide-react';
import BottomNavigationWithCreator from '../BottomNavigationWithCreator';
import { useAuth } from '../../context/AuthContext';
import { useUnreadMessages } from '../../context/UnreadMessagesContext';
import { rtdb, db } from '../../firebase';
import { ref, push, onValue, off, serverTimestamp, set } from 'firebase/database';
import { collection, getDocs, query, doc, setDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Initialize Stripe with public key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

// TipPaymentForm component for Stripe Elements integration
const TipPaymentForm = ({ onSuccess, onCancel, amount }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      if (error) {
        setErrorMessage(error.message);
        setIsProcessing(false);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess(paymentIntent.id);
      }
    } catch (err) {
      console.error('Payment error:', err);
      setErrorMessage('決済処理中にエラーが発生しました');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border-2 border-pink-100 dark:border-gray-700">
        <PaymentElement />
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
          {errorMessage}
        </div>
      )}

      <div className="flex space-x-3">
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-semibold disabled:opacity-50"
          data-testid="button-cancel-tip-payment"
        >
          キャンセル
        </motion.button>
        <motion.button
          type="submit"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={!stripe || isProcessing}
          className="flex-1 bg-gradient-to-r from-pink-500 to-pink-600 text-white py-3 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="button-submit-tip-payment"
        >
          {isProcessing ? (
            <span className="flex items-center justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"
              />
              処理中...
            </span>
          ) : (
            `¥${amount.toLocaleString()} を支払う`
          )}
        </motion.button>
      </div>
    </form>
  );
};

const MessagesUI = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { markChatAsRead, lastReadTimes } = useUnreadMessages();
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showUserSelect, setShowUserSelect] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' or 'unread'
  const messagesEndRef = useRef(null);
  const [followedUsers, setFollowedUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [userSelectTab, setUserSelectTab] = useState('followed'); // 'followed' or 'all'
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipAmount, setTipAmount] = useState(500);
  const [tipClientSecret, setTipClientSecret] = useState(null);
  const [tipMessage, setTipMessage] = useState('');
  const [isSendingTip, setIsSendingTip] = useState(false);
  const fileInputRef = useRef(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [broadcastMessage, setBroadcastMessage] = useState('');

  // URLをプロキシURLに変換する関数
  const convertToProxyUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('/api/proxy/')) return url;
    if (url.startsWith('data:')) return url; // Base64画像はそのまま
    
    // /objects/ で始まるURLを正しくパース
    if (url.startsWith('/objects/')) {
      // /objects/public/<path> または /objects/private/<path> を検出
      const objectsPattern = /^\/objects\/(public|private)\/(.+)$/;
      const match = url.match(objectsPattern);
      if (match) {
        // visibility (public/private) とパスを抽出
        return `/api/proxy/${match[1]}/${match[2]}`;
      }
      // /objects/<path> のような古い形式はpublicとして扱う
      return url.replace('/objects/', '/api/proxy/public/');
    }
    
    // Bunny CDN直接URL
    if (url.includes('only-u.fun/') || url.includes('b-cdn.net/')) {
      const bunnyPattern = /https?:\/\/[^/]+\/(public|private)\/(.+)/;
      const match = url.match(bunnyPattern);
      if (match) {
        return `/api/proxy/${match[1]}/${match[2]}`;
      }
    }
    
    return url;
  };

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Firestoreからフォローしているユーザーとすべてのユーザーを取得
  useEffect(() => {
    if (!currentUser) return;

    const fetchUsers = async () => {
      try {
        // すべてのユーザーを取得
        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersRef);
        
        // ユーザーデータを正規化（displayName → name, photoURL → avatar）
        const usersData = usersSnapshot.docs
          .map(doc => {
            const data = doc.data();
            const rawAvatar = data.photoURL || data.avatar || '';
            return {
              id: doc.id,
              ...data,
              // 正規化: name/avatarフィールドを追加（emailは非表示）
              name: data.displayName || data.name || data.username || 'ユーザー',
              avatar: convertToProxyUrl(rawAvatar),
              username: data.username || '@user',
              isVerified: data.isVerified || false,
              isOnline: data.isOnline || false
            };
          })
          .filter(user => user.id !== currentUser.uid); // 自分自身を除外

        setAllUsers(usersData);

        // フォローしているユーザーを取得（既に取得したusersSnapshotを再利用）
        const currentUserData = usersSnapshot.docs.find(d => d.id === currentUser.uid)?.data();
        
        if (currentUserData?.following && Array.isArray(currentUserData.following)) {
          const followed = usersData.filter(user => currentUserData.following.includes(user.id));
          setFollowedUsers(followed);
        } else {
          setFollowedUsers([]);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    fetchUsers();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    const conversationsRef = ref(rtdb, `userConversations/${currentUser.uid}`);
    
    const unsubscribe = onValue(conversationsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const convArray = Object.entries(data).map(([id, conv]) => ({
          id,
          ...conv
        }));
        convArray.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
        setConversations(convArray);
      } else {
        setConversations([]);
      }
    });

    return () => off(conversationsRef);
  }, [currentUser]);

  useEffect(() => {
    if (!activeChat || !currentUser) return;

    const chatId = activeChat.id;
    const messagesRef = ref(rtdb, `messages/${chatId}`);
    
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const messagesArray = Object.entries(data).map(([id, msg]) => ({
          id,
          ...msg
        }));
        messagesArray.sort((a, b) => a.timestamp - b.timestamp);
        setMessages(messagesArray);
      } else {
        setMessages([]);
      }
    });

    return () => off(messagesRef);
  }, [activeChat, currentUser]);

  const hasUnreadMessages = (conversation) => {
    if (!currentUser || !conversation) return false;
    const lastRead = lastReadTimes[conversation.id];
    return !lastRead || (conversation.lastMessageTime && conversation.lastMessageTime > lastRead);
  };

  const handleChatSelect = (conversation) => {
    setActiveChat(conversation);
    if (currentUser) {
      markChatAsRead(conversation.id);
    }
  };

  // 画像選択処理
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB制限
        alert('画像サイズは10MB以下にしてください');
        return;
      }
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // 画像送信処理
  const sendImageMessage = async () => {
    if (!selectedImage || !activeChat || !currentUser) return;

    setIsUploadingImage(true);
    
    try {
      // Bunny CDNにアップロード
      const formData = new FormData();
      formData.append('file', selectedImage);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('画像のアップロードに失敗しました');
      }

      const uploadData = await uploadResponse.json();
      const imageUrl = uploadData.url;

      // メッセージ送信
      const chatId = activeChat.id;
      const messagesRef = ref(rtdb, `messages/${chatId}`);
      const newMessageRef = push(messagesRef);

      const messageData = {
        type: 'image',
        imageUrl: imageUrl,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email || 'Anonymous',
        timestamp: Date.now()
      };

      await set(newMessageRef, messageData);

      // 会話リスト更新
      const currentUserConvRef = ref(rtdb, `userConversations/${currentUser.uid}/${chatId}`);
      const now = Date.now();
      await set(currentUserConvRef, {
        ...activeChat,
        lastMessage: '📷 画像',
        lastMessageTime: now
      });

      // リセット
      setSelectedImage(null);
      setImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
    } catch (error) {
      console.error('Error sending image:', error);
      alert(`画像の送信に失敗しました: ${error.message}`);
    } finally {
      setIsUploadingImage(false);
    }
  };

  // 画像プレビューキャンセル
  const cancelImagePreview = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // チップ送信準備（Payment Intent作成）
  const handleTipClick = async () => {
    if (!activeChat || !currentUser || !tipAmount) return;

    setIsSendingTip(true);
    try {
      // Create Payment Intent
      const response = await fetch('/api/create-tip-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: tipAmount,
          recipientId: activeChat.userId,
          recipientName: activeChat.userName,
          senderId: currentUser.uid,
          senderName: currentUser.displayName || currentUser.email,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '決済の準備に失敗しました');
      }

      // Set client secret for Stripe Elements
      setTipClientSecret(data.clientSecret);
    } catch (error) {
      console.error('Error creating tip payment:', error);
      alert(error.message || 'チップ送信の準備に失敗しました');
      setShowTipModal(false);
    } finally {
      setIsSendingTip(false);
    }
  };

  // チップ決済完了後の処理
  const handleTipPaymentSuccess = async (paymentIntentId) => {
    try {
      // Confirm payment on backend
      await fetch('/api/confirm-tip-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentIntentId,
          message: tipMessage,
        }),
      });

      // Send tip message in chat
      const chatId = [currentUser.uid, activeChat.userId].sort().join('_');
      const messagesRef = ref(rtdb, `messages/${chatId}`);
      const newMessageRef = push(messagesRef);
      
      const now = Date.now();
      const messageData = {
        text: `💝 チップを送りました: ¥${tipAmount.toLocaleString()}${tipMessage ? `\n${tipMessage}` : ''}`,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email || 'Anonymous',
        timestamp: now,
        type: 'tip',
        tipAmount
      };
      
      await set(newMessageRef, messageData);

      // Update conversation list
      const currentUserConvRef = ref(rtdb, `userConversations/${currentUser.uid}/${chatId}`);
      await set(currentUserConvRef, {
        ...activeChat,
        lastMessage: `💝 チップ: ¥${tipAmount.toLocaleString()}`,
        lastMessageTime: now
      });

      // Close modal and reset
      setShowTipModal(false);
      setTipClientSecret(null);
      setTipMessage('');
      setTipAmount(500);
      
      alert(`✅ チップ ¥${tipAmount.toLocaleString()} を送信しました！`);
    } catch (error) {
      console.error('Error confirming tip payment:', error);
      alert('チップの送信に失敗しました');
    }
  };

  // 一斉送信処理
  const sendBroadcastMessage = async () => {
    if (!broadcastMessage.trim() || selectedUsers.length === 0 || !currentUser) {
      alert('メッセージを入力し、少なくとも1人のユーザーを選択してください');
      return;
    }

    setIsLoading(true);
    
    try {
      const now = Date.now();
      const promises = selectedUsers.map(async (userId) => {
        // チャットIDを生成（2つのユーザーIDを昇順でソート）
        const chatId = [currentUser.uid, userId].sort().join('_');
        
        // メッセージを送信
        const messagesRef = ref(rtdb, `messages/${chatId}`);
        const newMessageRef = push(messagesRef);
        
        const messageData = {
          text: broadcastMessage,
          senderId: currentUser.uid,
          senderName: currentUser.displayName || currentUser.email || 'Anonymous',
          timestamp: now
        };
        
        await set(newMessageRef, messageData);
        
        // 送信者の会話リストを更新
        const currentUserConvRef = ref(rtdb, `userConversations/${currentUser.uid}/${chatId}`);
        const user = allUsers.find(u => u.id === userId);
        
        await set(currentUserConvRef, {
          id: chatId,
          userId: userId,
          userName: user?.name || 'ユーザー',
          userAvatar: user?.avatar || '',
          lastMessage: broadcastMessage,
          lastMessageTime: now,
          lastMessageSenderId: currentUser.uid
        });

        // 受信者の会話リストも更新（重要！）
        const recipientConvRef = ref(rtdb, `userConversations/${userId}/${chatId}`);
        await set(recipientConvRef, {
          id: chatId,
          userId: currentUser.uid,
          userName: currentUser.displayName || currentUser.name || currentUser.email || 'ユーザー',
          userAvatar: convertToProxyUrl(currentUser.photoURL || currentUser.avatar || ''),
          lastMessage: broadcastMessage,
          lastMessageTime: now,
          lastMessageSenderId: currentUser.uid
        });
      });

      await Promise.all(promises);
      
      alert(`${selectedUsers.length}人のユーザーにメッセージを送信しました`);
      setShowBroadcastModal(false);
      setBroadcastMessage('');
      setSelectedUsers([]);
      
    } catch (error) {
      console.error('Error sending broadcast message:', error);
      alert(`一斉送信に失敗しました: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ユーザー選択トグル
  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeChat || !currentUser) return;

    setIsLoading(true);
    
    try {
      const chatId = activeChat.id;
      const messagesRef = ref(rtdb, `messages/${chatId}`);
      const newMessageRef = push(messagesRef);

      const messageData = {
        text: newMessage,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email || 'Anonymous',
        timestamp: Date.now()
      };

      await set(newMessageRef, messageData);

      // 自分の会話リストのみ更新（相手のリストは相手が開いたときに更新される）
      const currentUserConvRef = ref(rtdb, `userConversations/${currentUser.uid}/${chatId}`);
      
      const now = Date.now();
      await set(currentUserConvRef, {
        ...activeChat,
        lastMessage: newMessage,
        lastMessageTime: now
      });

      setNewMessage('');
      
    } catch (error) {
      console.error('Error sending message:', error);
      console.error('Error details:', error.message);
      alert(`メッセージの送信に失敗しました: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const createNewChat = async (user) => {
    if (!currentUser) {
      console.error('No current user');
      return;
    }

    try {
      console.log('Creating new chat with user:', user);
      
      const chatId = [currentUser.uid, user.id].sort().join('_');
      console.log('Chat ID:', chatId);

      const conversationData = {
        userId: user.id,
        userName: user.name || user.displayName || 'Unknown',
        userAvatar: user.avatar || user.photoURL || '',
        lastMessage: '',
        lastMessageTime: Date.now()
      };

      // 自分の会話リストにのみ追加（相手のリストには相手が開いたときに追加される）
      const currentUserConvRef = ref(rtdb, `userConversations/${currentUser.uid}/${chatId}`);

      await set(currentUserConvRef, conversationData);

      console.log('Chat created successfully');

      setActiveChat({
        id: chatId,
        ...conversationData
      });

      markChatAsRead(chatId);
      
      setShowUserSelect(false);
      
    } catch (error) {
      console.error('Error creating chat:', error);
      console.error('Error details:', error.message);
      alert(`チャットの作成に失敗しました: ${error.message}`);
    }
  };

  const handleNewChatClick = () => {
    setShowUserSelect(true);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-pink-100 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <motion.div
            animate={{ 
              y: [0, -10, 0],
            }}
            transition={{ 
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="mb-6 inline-block"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-pink-500 to-pink-600 rounded-full flex items-center justify-center shadow-lg">
              <Users className="w-10 h-10 text-white" />
            </div>
          </motion.div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent mb-3">
            {t('messages.pleaseLogin')}
          </h2>
          <p className="text-pink-700">{t('messages.loginRequired')}</p>
        </motion.div>
      </div>
    );
  }

  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = conv.userName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'all' || (activeFilter === 'unread' && hasUnreadMessages(conv));
    return matchesSearch && matchesFilter;
  });

  const unreadCount = conversations.filter(conv => hasUnreadMessages(conv)).length;

  return (
    <div className="h-screen bg-gradient-to-br from-pink-50 via-white to-pink-100 dark:from-gray-900 dark:via-black dark:to-gray-900 flex flex-col">
      <div className="flex flex-1 relative">
        {/* Left Sidebar - Conversations List */}
        <div className={`${activeChat ? 'hidden lg:block' : 'block'} w-full lg:w-96 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-r border-pink-100 dark:border-gray-800 shadow-sm`}>
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 border-b border-pink-100 dark:border-gray-800 bg-white dark:bg-gray-900"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <motion.div
                  animate={{ 
                    scale: [1, 1.05, 1],
                  }}
                  transition={{ 
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="w-10 h-10 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg"
                  data-testid="icon-messages"
                >
                  <MessageCircle className="w-5 h-5 text-white" />
                </motion.div>
                <h1 className="text-base font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent">
                  {t('messages.title')}
                </h1>
              </div>
              <div className="flex items-center space-x-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowBroadcastModal(true)}
                  className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-3 py-2 rounded-full text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                  data-testid="button-broadcast"
                  title="一斉送信"
                >
                  <Users className="w-4 h-4" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleNewChatClick}
                  className="bg-gradient-to-r from-pink-500 to-pink-600 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-300 flex items-center space-x-2"
                  data-testid="button-new-chat"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('messages.newChat')}</span>
                </motion.button>
              </div>
            </div>
            
            {/* Search Bar */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="relative"
            >
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-pink-400 w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('messages.searchPlaceholder')}
                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 dark:text-gray-200 border-2 border-pink-100 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-300 shadow-sm"
                data-testid="input-search"
              />
            </motion.div>
          </motion.div>

          {/* Filter Options */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="p-4 border-b border-pink-100 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50"
          >
            <div className="flex space-x-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveFilter('all')}
                className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-full shadow-md transition-all ${
                  activeFilter === 'all'
                    ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-pink-50 dark:hover:bg-gray-700'
                }`}
                data-testid="button-filter-all"
              >
                <span>{t('messages.all')}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  activeFilter === 'all' ? 'bg-white/30' : 'bg-pink-100 text-pink-600'
                }`}>
                  {conversations.length}
                </span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveFilter('unread')}
                className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-full shadow-md transition-all ${
                  activeFilter === 'unread'
                    ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-pink-50 dark:hover:bg-gray-700'
                }`}
                data-testid="button-filter-unread"
              >
                <span>{t('messages.unread')}</span>
                {unreadCount > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    activeFilter === 'unread' ? 'bg-white/30' : 'bg-pink-100 text-pink-600'
                  }`}>
                    {unreadCount}
                  </span>
                )}
              </motion.button>
            </div>
          </motion.div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence>
              {filteredConversations.length > 0 ? (
                filteredConversations.map((conversation, index) => {
                  const isUnread = hasUnreadMessages(conversation);
                  return (
                    <motion.div
                      key={conversation.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.02, x: 5 }}
                      onClick={() => handleChatSelect(conversation)}
                      className={`p-4 border-b border-pink-100 cursor-pointer transition-all duration-300 ${
                        activeChat?.id === conversation.id 
                          ? 'bg-gradient-to-r from-pink-100 to-pink-200 border-l-4 border-l-pink-500' 
                          : 'hover:bg-pink-50/50'
                      }`}
                      data-testid={`conversation-item-${conversation.id}`}
                    >
                      <div className="flex items-center space-x-3">
                        <motion.div
                          animate={isUnread ? { 
                            y: [0, -3, 0],
                          } : {}}
                          transition={{ 
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                          className="relative"
                        >
                          <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-pink-400 to-pink-500 border-2 border-pink-200 shadow-md flex items-center justify-center">
                            <Users className="w-7 h-7 text-white" />
                            <div className="absolute bottom-0 right-0 w-4 h-4 bg-gradient-to-br from-pink-400 to-pink-500 border-2 border-white rounded-full shadow-sm"></div>
                          </div>
                          {isUnread && (
                            <motion.div
                              animate={{ 
                                scale: [1, 1.2, 1],
                              }}
                              transition={{ 
                                duration: 1.5,
                                repeat: Infinity,
                              }}
                              className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-pink-500 to-pink-600 border-2 border-white rounded-full shadow-lg flex items-center justify-center"
                              data-testid={`unread-badge-${conversation.id}`}
                            >
                              <span className="text-white text-xs font-bold">•</span>
                            </motion.div>
                          )}
                        </motion.div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className={`font-semibold truncate ${
                              isUnread ? 'text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'
                            }`} data-testid={`text-conversation-name-${conversation.id}`}>
                              {conversation.userName}
                            </h3>
                            <span className="text-xs text-pink-500 font-medium" data-testid={`text-time-${conversation.id}`}>
                              {formatTime(conversation.lastMessageTime)}
                            </span>
                          </div>
                          <p className={`text-sm truncate ${
                            isUnread ? 'text-gray-700 dark:text-gray-300 font-medium' : 'text-gray-500 dark:text-gray-400'
                          }`} data-testid={`text-last-message-${conversation.id}`}>
                            {conversation.lastMessage || t('messages.startChatting')}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-8 text-center"
                  data-testid="empty-state"
                >
                  <motion.div
                    animate={{ 
                      y: [0, -10, 0],
                    }}
                    transition={{ 
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="mb-4"
                  >
                    <Users className="w-16 h-16 mx-auto text-gray-300" />
                  </motion.div>
                  <p className="text-gray-500 font-medium mb-4">{t('messages.noConversations')}</p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleNewChatClick}
                    className="bg-gradient-to-r from-pink-500 to-pink-600 text-white px-6 py-3 rounded-full text-sm font-medium shadow-lg"
                    data-testid="button-start-chatting"
                  >
                    {t('messages.startChatting')}
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Side - Chat Area */}
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 w-full lg:w-auto max-w-full overflow-x-hidden">
          {activeChat ? (
            <>
              {/* Chat Header */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-pink-50 to-pink-100 border-b border-pink-100 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setActiveChat(null)}
                      className="lg:hidden p-2 hover:bg-pink-100 rounded-full transition-colors"
                      data-testid="button-back"
                    >
                      <ArrowLeft className="w-5 h-5 text-pink-600" />
                    </motion.button>
                    <motion.div
                      animate={{ 
                        y: [0, -3, 0],
                      }}
                      transition={{ 
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                      className="relative w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-pink-500 border-2 border-pink-300 shadow-md flex items-center justify-center"
                    >
                      <Users className="w-6 h-6 text-white" />
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-gradient-to-br from-pink-400 to-pink-500 border-2 border-white rounded-full"></div>
                    </motion.div>
                    <div>
                      <h2 className="font-bold text-gray-900 dark:text-gray-100" data-testid="text-active-chat-name">{activeChat.userName}</h2>
                      <p className="text-xs text-pink-500 font-medium">● オンライン</p>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-2 hover:bg-pink-100 rounded-full transition-colors"
                    data-testid="button-more"
                  >
                    <MoreVertical className="w-5 h-5 text-pink-600" />
                  </motion.button>
                </div>
              </motion.div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-br from-pink-50/30 via-white to-pink-100/30">
                <AnimatePresence>
                  {messages.map((message, index) => {
                    const isOwn = message.senderId === currentUser.uid;
                    const showDate = index === 0 || 
                      formatDate(message.timestamp) !== formatDate(messages[index - 1]?.timestamp);

                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        {showDate && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center my-6"
                          >
                            <span className="bg-white dark:bg-gray-800 px-4 py-1.5 rounded-full text-xs text-gray-500 dark:text-gray-400 shadow-sm border border-pink-100 dark:border-gray-700">
                              {formatDate(message.timestamp)}
                            </span>
                          </motion.div>
                        )}
                        <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          <motion.div
                            whileHover={{ scale: 1.02 }}
                            className={`max-w-xs lg:max-w-md px-5 py-3 rounded-2xl shadow-md ${
                              isOwn 
                                ? 'bg-gradient-to-br from-pink-500 to-pink-600 text-white rounded-br-sm' 
                                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-pink-100 dark:border-gray-700 rounded-bl-sm'
                            }`}
                            data-testid={`message-${message.id}`}
                          >
                            {message.type === 'image' ? (
                              <div className="space-y-2">
                                <img 
                                  src={convertToProxyUrl(message.imageUrl)} 
                                  alt="Shared image"
                                  className="rounded-lg max-w-full cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => window.open(convertToProxyUrl(message.imageUrl), '_blank')}
                                />
                                <p className={`text-xs ${isOwn ? 'text-pink-100' : 'text-gray-400'}`}>
                                  {formatTime(message.timestamp)}
                                </p>
                              </div>
                            ) : message.type === 'tip' ? (
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2 mb-2">
                                  <Gift className="w-5 h-5" />
                                  <span className="font-semibold">チップを送りました</span>
                                </div>
                                <p className="text-2xl font-bold">¥{message.amount?.toLocaleString()}</p>
                                {message.text && <p className="text-sm mt-2">{message.text}</p>}
                                <p className={`text-xs mt-1.5 ${isOwn ? 'text-pink-100' : 'text-gray-400'}`}>
                                  {formatTime(message.timestamp)}
                                </p>
                              </div>
                            ) : (
                              <>
                                <p className="text-sm leading-relaxed">{message.text}</p>
                                <p className={`text-xs mt-1.5 ${
                                  isOwn ? 'text-pink-100' : 'text-gray-400'
                                }`}>
                                  {formatTime(message.timestamp)}
                                </p>
                              </>
                            )}
                          </motion.div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-900 border-t border-pink-100 dark:border-gray-800 p-4 shadow-lg mb-14"
              >
                {/* Image Preview */}
                {imagePreview && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mb-4 relative"
                  >
                    <div className="relative inline-block">
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        className="max-h-40 rounded-lg border-2 border-pink-200"
                      />
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={cancelImagePreview}
                        className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg"
                        data-testid="button-cancel-image"
                      >
                        <X className="w-4 h-4" />
                      </motion.button>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={sendImageMessage}
                      disabled={isUploadingImage}
                      className="ml-4 bg-gradient-to-r from-pink-500 to-pink-600 text-white px-6 py-2 rounded-full shadow-lg disabled:opacity-50"
                      data-testid="button-send-image"
                    >
                      {isUploadingImage ? '送信中...' : '画像を送信'}
                    </motion.button>
                  </motion.div>
                )}

                <div className="flex items-center space-x-2 md:space-x-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageSelect}
                    accept="image/*"
                    className="hidden"
                    data-testid="input-file"
                  />
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-pink-100 dark:bg-gray-800 text-pink-600 dark:text-pink-400 p-3 md:p-4 rounded-full shadow-md hover:shadow-lg transition-all duration-300 flex-shrink-0"
                    data-testid="button-select-image"
                  >
                    <Image className="w-5 h-5 md:w-6 md:h-6" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowTipModal(true)}
                    className="bg-pink-100 dark:bg-gray-800 text-pink-600 dark:text-pink-400 p-3 md:p-4 rounded-full shadow-md hover:shadow-lg transition-all duration-300 flex-shrink-0"
                    data-testid="button-send-tip"
                  >
                    <Gift className="w-5 h-5 md:w-6 md:h-6" />
                  </motion.button>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={t('messages.typeMessagePlaceholder')}
                    className="flex-1 min-w-0 px-4 md:px-6 py-3 md:py-4 border-2 border-pink-100 rounded-full focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-300 shadow-sm text-sm md:text-base"
                    disabled={isLoading}
                    data-testid="input-message"
                  />
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || isLoading}
                    className="bg-gradient-to-r from-pink-500 to-pink-600 text-white p-3 md:p-4 rounded-full shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex-shrink-0"
                    data-testid="button-send"
                  >
                    {isLoading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 md:w-6 md:h-6 border-2 border-white border-t-transparent rounded-full"
                      />
                    ) : (
                      <Send className="w-5 h-5 md:w-6 md:h-6" />
                    )}
                  </motion.button>
                </div>
              </motion.div>
            </>
          ) : (
            // Empty State - Minimal clean version
            <div className="flex-1 bg-white dark:bg-gray-900"></div>
          )}
        </div>
      </div>

      {/* User Selection Modal - フォローしたユーザー */}
      <AnimatePresence>
        {showUserSelect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowUserSelect(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="bg-gradient-to-r from-pink-500 to-pink-600 text-white p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold">新しいチャット</h3>
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowUserSelect(false)}
                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                    data-testid="button-close-modal"
                  >
                    <X className="w-5 h-5" />
                  </motion.button>
                </div>
                
                {/* 検索バー */}
                <div className="relative mb-4">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-pink-400 w-5 h-5" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="ユーザーを検索..."
                    className="w-full pl-12 pr-4 py-3 bg-white/20 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/50 text-white placeholder-white/70"
                    data-testid="input-user-search"
                  />
                </div>

                {/* タブ */}
                <div className="flex space-x-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setUserSelectTab('followed')}
                    className={`flex-1 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      userSelectTab === 'followed'
                        ? 'bg-white text-pink-600 shadow-lg'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                    data-testid="button-tab-followed"
                  >
                    フォロー中
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setUserSelectTab('all')}
                    className={`flex-1 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      userSelectTab === 'all'
                        ? 'bg-white text-pink-600 shadow-lg'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                    data-testid="button-tab-all"
                  >
                    すべてのユーザー
                  </motion.button>
                </div>
              </div>
              
              <div className="p-6 max-h-96 overflow-y-auto">
                {userSelectTab === 'followed' ? (
                  followedUsers.filter(user => 
                    user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                    user.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                    (user.email && user.email.toLowerCase().includes(userSearchQuery.toLowerCase()))
                  ).length > 0 ? (
                    <div className="space-y-3">
                      {followedUsers.filter(user => 
                        user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                        user.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                        (user.email && user.email.toLowerCase().includes(userSearchQuery.toLowerCase()))
                      ).map((user, index) => (
                        <motion.div
                          key={user.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          whileHover={{ scale: 1.02, x: 5 }}
                          onClick={() => createNewChat(user)}
                          className="flex items-center space-x-3 p-4 rounded-2xl hover:bg-gradient-to-r hover:from-pink-50 hover:to-pink-100 cursor-pointer transition-all duration-300 border border-pink-100"
                          data-testid={`user-select-${user.id}`}
                        >
                          <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-pink-200 shadow-md">
                            {user.avatar ? (
                              <img 
                                src={user.avatar} 
                                alt={user.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-pink-400 to-pink-500 flex items-center justify-center">
                                <span className="text-white text-xl font-bold">
                                  {(user.name || 'U')[0].toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <h4 className="font-semibold text-gray-900" data-testid={`text-user-name-${user.id}`}>
                                {user.name}
                              </h4>
                              {user.isVerified && (
                                <motion.div
                                  animate={{ rotate: [0, 10, -10, 0] }}
                                  transition={{ duration: 3, repeat: Infinity }}
                                  className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center"
                                >
                                  <span className="text-white text-xs">✓</span>
                                </motion.div>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">{user.username}</p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-pink-400" />
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 mb-4">フォローしているユーザーがいません</p>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setUserSelectTab('all')}
                        className="bg-gradient-to-r from-pink-500 to-pink-600 text-white px-6 py-2 rounded-full text-sm font-medium"
                        data-testid="button-see-all-users"
                      >
                        すべてのユーザーを見る
                      </motion.button>
                    </div>
                  )
                ) : (
                  allUsers.filter(user => 
                    user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                    user.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                    (user.email && user.email.toLowerCase().includes(userSearchQuery.toLowerCase()))
                  ).length > 0 ? (
                    <div className="space-y-3">
                      {allUsers.filter(user => 
                        user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                        user.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                        (user.email && user.email.toLowerCase().includes(userSearchQuery.toLowerCase()))
                      ).map((user, index) => (
                        <motion.div
                          key={user.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          whileHover={{ scale: 1.02, x: 5 }}
                          onClick={() => createNewChat(user)}
                          className="flex items-center space-x-3 p-4 rounded-2xl hover:bg-gradient-to-r hover:from-pink-50 hover:to-pink-100 cursor-pointer transition-all duration-300 border border-pink-100"
                          data-testid={`user-select-all-${user.id}`}
                        >
                          <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-pink-200 shadow-md">
                            {user.avatar ? (
                              <img 
                                src={user.avatar} 
                                alt={user.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-pink-400 to-pink-500 flex items-center justify-center">
                                <span className="text-white text-xl font-bold">
                                  {(user.name || 'U')[0].toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <h4 className="font-semibold text-gray-900" data-testid={`text-user-name-all-${user.id}`}>
                                {user.name}
                              </h4>
                              {user.isVerified && (
                                <motion.div
                                  animate={{ rotate: [0, 10, -10, 0] }}
                                  transition={{ duration: 3, repeat: Infinity }}
                                  className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center"
                                >
                                  <span className="text-white text-xs">✓</span>
                                </motion.div>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">{user.username}</p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-pink-400" />
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">ユーザーが見つかりません</p>
                    </div>
                  )
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tip Modal */}
      <AnimatePresence>
        {showTipModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowTipModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="bg-gradient-to-r from-pink-500 to-pink-600 text-white p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <Gift className="w-8 h-8" />
                    <h3 className="text-2xl font-bold">チップを送る</h3>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowTipModal(false)}
                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                    data-testid="button-close-tip-modal"
                  >
                    <X className="w-5 h-5" />
                  </motion.button>
                </div>
                <p className="text-pink-100">
                  {activeChat?.name || 'このユーザー'}にチップを送信します
                </p>
              </div>

              <div className="p-6 space-y-6">
                {/* Amount Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    金額を選択
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[500, 1000, 2000, 3000, 5000, 10000].map((amount) => (
                      <motion.button
                        key={amount}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setTipAmount(amount)}
                        className={`py-3 px-4 rounded-xl font-semibold transition-all ${
                          tipAmount === amount
                            ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-lg'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                        data-testid={`button-tip-${amount}`}
                      >
                        ¥{amount.toLocaleString()}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Custom Amount */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    カスタム金額
                  </label>
                  <input
                    type="number"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(Number(e.target.value))}
                    min="100"
                    step="100"
                    className="w-full px-4 py-3 border-2 border-pink-100 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="金額を入力"
                    data-testid="input-custom-tip"
                  />
                </div>

                {/* Optional Message */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    メッセージ（任意）
                  </label>
                  <textarea
                    value={tipMessage}
                    onChange={(e) => setTipMessage(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-pink-100 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="応援メッセージを添えましょう"
                    rows="3"
                    data-testid="input-tip-message"
                    disabled={tipClientSecret !== null}
                  />
                </div>

                {/* Stripe Elements Payment Form */}
                {tipClientSecret ? (
                  <Elements stripe={stripePromise} options={{ clientSecret: tipClientSecret }}>
                    <TipPaymentForm
                      amount={tipAmount}
                      onSuccess={handleTipPaymentSuccess}
                      onCancel={() => {
                        setTipClientSecret(null);
                        setShowTipModal(false);
                      }}
                    />
                  </Elements>
                ) : (
                  <>
                    {/* Total Amount Display */}
                    <div className="bg-gradient-to-r from-pink-50 to-pink-100 dark:from-gray-800 dark:to-gray-700 p-4 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700 dark:text-gray-300 font-medium">合計金額</span>
                        <span className="text-3xl font-bold text-pink-600 dark:text-pink-400">
                          ¥{tipAmount.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Continue to Payment Button */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleTipClick}
                      disabled={isSendingTip || !tipAmount}
                      className="w-full bg-gradient-to-r from-pink-500 to-pink-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                      data-testid="button-confirm-tip"
                    >
                      {isSendingTip ? (
                        <span className="flex items-center justify-center">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-6 h-6 border-2 border-white border-t-transparent rounded-full mr-2"
                          />
                          準備中...
                        </span>
                      ) : (
                        `¥${tipAmount.toLocaleString()} を送る`
                      )}
                    </motion.button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Broadcast Message Modal - 一斉送信 */}
      <AnimatePresence>
        {showBroadcastModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowBroadcastModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            >
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <Users className="w-8 h-8" />
                    <h3 className="text-2xl font-bold">一斉送信</h3>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowBroadcastModal(false)}
                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                    data-testid="button-close-broadcast-modal"
                  >
                    <X className="w-5 h-5" />
                  </motion.button>
                </div>
                <p className="text-purple-100">
                  複数のユーザーに同じメッセージを送信します
                </p>
              </div>

              <div className="p-6 max-h-[70vh] overflow-y-auto">
                {/* Search Bar */}
                <div className="relative mb-4">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-purple-400 w-5 h-5" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="ユーザーを検索..."
                    className="w-full pl-12 pr-4 py-3 border-2 border-purple-100 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    data-testid="input-broadcast-search"
                  />
                </div>

                {/* Selected Users Count */}
                <div className="mb-4 p-3 bg-purple-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-purple-600 dark:text-purple-400 font-semibold">
                    選択中: {selectedUsers.length}人
                  </p>
                </div>

                {/* User List with Checkboxes */}
                <div className="space-y-2 mb-6">
                  {allUsers.filter(user => 
                    user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                    user.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                    (user.email && user.email.toLowerCase().includes(userSearchQuery.toLowerCase()))
                  ).map((user) => (
                    <motion.div
                      key={user.id}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => toggleUserSelection(user.id)}
                      className={`flex items-center space-x-3 p-3 rounded-xl cursor-pointer transition-all border-2 ${
                        selectedUsers.includes(user.id)
                          ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700'
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-purple-200 dark:hover:border-purple-800'
                      }`}
                      data-testid={`broadcast-user-${user.id}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => toggleUserSelection(user.id)}
                        className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-purple-200">
                        {user.avatar ? (
                          <img 
                            src={user.avatar} 
                            alt={user.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-purple-400 to-purple-500 flex items-center justify-center">
                            <span className="text-white font-bold">
                              {(user.name || 'U')[0].toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100">{user.name}</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{user.username}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Message Input */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    メッセージ
                  </label>
                  <textarea
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-purple-100 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="すべての選択されたユーザーに送信するメッセージを入力..."
                    rows="4"
                    data-testid="input-broadcast-message"
                  />
                </div>

                {/* Send Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={sendBroadcastMessage}
                  disabled={isLoading || selectedUsers.length === 0 || !broadcastMessage.trim()}
                  className="w-full mt-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                  data-testid="button-send-broadcast"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-6 h-6 border-2 border-white border-t-transparent rounded-full mr-2"
                      />
                      送信中...
                    </span>
                  ) : (
                    `${selectedUsers.length}人に送信`
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNavigationWithCreator active="messages" />
    </div>
  );
};

export default MessagesUI;
