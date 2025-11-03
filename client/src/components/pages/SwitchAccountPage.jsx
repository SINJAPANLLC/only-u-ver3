import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Users, 
  Search,
  Plus,
  User,
  Mail,
  Crown,
  CheckCircle,
  AlertCircle,
  Settings,
  Trash2,
  Edit3,
  Eye,
  Clock,
  Sparkles,
  Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import BottomNavigationWithCreator from '../BottomNavigationWithCreator';

const SwitchAccountPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);

  // 現在のユーザー情報を取得
  useEffect(() => {
    const fetchUserData = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUserData({
            id: currentUser.uid,
            name: userDoc.data().name || currentUser.displayName || 'ユーザー',
            email: currentUser.email || '',
            avatar: userDoc.data().avatar || currentUser.photoURL || '',
            accountType: userDoc.data().isCreator ? 'creator' : 'fan',
            followers: userDoc.data().followers || 0,
            isVerified: userDoc.data().kycStatus === 'approved',
            status: 'online',
            isActive: true
          });
        }
      } catch (error) {
        console.error('ユーザー情報の取得エラー:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [currentUser]);

  const handleAddAccount = () => {
    alert('この機能は現在開発中です。別のアカウントでログインする場合は、一度ログアウトしてください。');
  };

  const formatLastLogin = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return '1時間以内';
    if (diffInHours < 24) return `${diffInHours}時間前`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}日前`;
    return date.toLocaleDateString('ja-JP');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'bg-gradient-to-br from-green-400 to-green-500';
      case 'away': return 'bg-gradient-to-br from-yellow-400 to-yellow-500';
      case 'offline': return 'bg-gradient-to-br from-gray-400 to-gray-500';
      default: return 'bg-gradient-to-br from-gray-400 to-gray-500';
    }
  };

  const getAccountTypeIcon = (type) => {
    switch (type) {
      case 'creator': return Crown;
      case 'fan': return User;
      default: return User;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 pb-20 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-pink-500 border-r-transparent mb-4"></div>
          <p className="text-pink-600 font-medium">読み込み中...</p>
        </div>
      </div>
    );
  }

  // 現在のユーザー情報を配列として扱う
  const accounts = userData ? [userData] : [];
  const filteredAccounts = accounts;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 pb-20">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 bg-gradient-to-r from-pink-500 to-pink-600 border-b border-pink-300 p-6 flex items-center z-10 shadow-lg"
      >
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate(-1)} 
          className="text-white mr-4 p-2 hover:bg-white/20 rounded-full transition-colors"
          data-testid="button-back"
        >
          <ArrowLeft size={24} />
        </motion.button>
        <div className="flex items-center">
          <motion.div
            animate={{ 
              y: [0, -5, 0],
            }}
            transition={{ 
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <Users className="w-7 h-7 text-white mr-3" />
          </motion.div>
          <h1 className="text-2xl font-bold text-white">アカウントを切り替える</h1>
        </div>
      </motion.div>

      <div className="p-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6"
        >
          <div className="flex items-start space-x-4">
            <Info className="w-6 h-6 text-blue-600 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-blue-900 mb-2 text-lg">開発中の機能</h3>
              <p className="text-base text-blue-800">
                複数アカウントの切り替え機能は現在開発中です。別のアカウントでログインする場合は、一度ログアウトしてから再度ログインしてください。
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-4 shadow-xl border-2 border-pink-100"
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAddAccount}
            className="w-full flex items-center justify-center space-x-3 p-5 border-2 border-dashed border-pink-300 rounded-xl bg-gradient-to-r from-pink-50 to-purple-50 hover:from-pink-100 hover:to-purple-100 transition-all"
            data-testid="button-add-account"
          >
            <Plus className="w-6 h-6 text-pink-600" />
            <span className="font-bold text-pink-700">新しいアカウントを追加</span>
          </motion.button>
        </motion.div>

        <AnimatePresence>
          {filteredAccounts.length > 0 ? (
            <div className="space-y-4">
              {filteredAccounts.map((account, index) => {
                const AccountTypeIcon = getAccountTypeIcon(account.accountType);
                
                return (
                  <motion.div
                    key={account.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.01, y: -2 }}
                    className="bg-white border-2 border-pink-100 rounded-2xl p-5 shadow-lg"
                  >
                    <div className="flex items-center space-x-4">
                      <motion.div
                        animate={{ 
                          y: [0, -3, 0],
                        }}
                        transition={{ 
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: index * 0.2
                        }}
                        className="relative"
                      >
                        <img 
                          src={account.avatar} 
                          alt={account.name} 
                          className="w-20 h-20 rounded-full object-cover border-2 border-pink-200 shadow-md"
                        />
                        <motion.div
                          animate={{ 
                            scale: [1, 1.2, 1],
                          }}
                          transition={{ 
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                          className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${getStatusColor(account.status)} shadow-md`}
                        />
                      </motion.div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-bold text-lg text-gray-900 truncate">{account.name}</h3>
                          {account.isVerified && (
                            <motion.div
                              animate={{ rotate: [0, 10, -10, 0] }}
                              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                            >
                              <Crown className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                            </motion.div>
                          )}
                          {account.isActive && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="flex items-center space-x-1 bg-gradient-to-r from-pink-500 to-pink-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md"
                            >
                              <CheckCircle className="w-3 h-3" />
                              <span>現在</span>
                            </motion.div>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-2 mb-2">
                          <AccountTypeIcon className="w-4 h-4 text-pink-500" />
                          <span className="text-sm font-semibold text-pink-600">
                            {account.accountType === 'creator' ? 'クリエイター' : 'ファン'}
                          </span>
                          {account.followers > 0 && (
                            <span className="text-sm text-gray-500 font-medium">
                              • {account.followers.toLocaleString()}フォロワー
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <div className="flex items-center space-x-1">
                            <Mail className="w-3 h-3" />
                            <span className="truncate">{account.email}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatLastLogin(account.lastLogin)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end space-y-2">
                        {!account.isActive && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleSwitchAccount(account.id)}
                            className="px-5 py-2 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-xl text-sm font-bold hover:shadow-lg transition-all"
                            data-testid={`button-switch-${account.id}`}
                          >
                            切り替え
                          </motion.button>
                        )}
                        
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleRemoveAccount(account.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          data-testid={`button-delete-${account.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-16 bg-white rounded-2xl border-2 border-pink-100 shadow-lg"
            >
              <motion.div
                animate={{ 
                  y: [0, -10, 0],
                  rotate: [0, 10, -10, 0]
                }}
                transition={{ 
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <Users className="w-20 h-20 text-pink-300 mx-auto mb-6" />
              </motion.div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">アカウントが見つかりませんでした</h3>
              <p className="text-gray-500">検索キーワードを変更してお試しください。</p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-pink-100 to-purple-100 border-2 border-pink-200 rounded-2xl p-6 relative overflow-hidden"
        >
          <motion.div
            animate={{ 
              rotate: [0, 360],
            }}
            transition={{ 
              duration: 20,
              repeat: Infinity,
              ease: "linear"
            }}
            className="absolute -top-10 -right-10 w-32 h-32 bg-white/30 rounded-full blur-2xl"
          />
          <div className="flex items-start space-x-4 relative z-10">
            <motion.div
              animate={{ 
                y: [0, -5, 0],
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <Sparkles className="w-6 h-6 text-pink-600 mt-1" />
            </motion.div>
            <div>
              <h4 className="font-bold text-pink-900 mb-2 text-lg">アカウント切り替えについて</h4>
              <ul className="text-base text-pink-800 space-y-2">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-pink-600" />
                  複数のアカウントを管理できます
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-pink-600" />
                  アカウントを切り替えると、そのアカウントの設定が適用されます
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-pink-600" />
                  各アカウントのデータは独立して保存されます
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-pink-600" />
                  不要なアカウントは削除できます
                </li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>

      <BottomNavigationWithCreator active="account" />
    </div>
  );
};

export default SwitchAccountPage;
