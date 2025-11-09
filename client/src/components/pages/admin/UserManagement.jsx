import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Search, 
  Ban, 
  UserCheck, 
  Shield,
  Clock,
  CheckCircle,
  Eye,
  RefreshCw,
  Download,
  ArrowUpRight,
  Sparkles,
  Trash2,
  X,
  AlertTriangle,
  DollarSign,
  Heart,
  MessageSquare,
  TrendingUp,
  CreditCard,
  Gift,
  FileText,
  Activity
} from 'lucide-react';
import { db } from '../../../firebase';
import { collection, onSnapshot, query, orderBy, limit, startAfter, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, where } from 'firebase/firestore';
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

const UserManagement = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    banned: 0,
    pending: 0,
    creators: 0
  });

  const [banModalOpen, setBanModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [banReason, setBanReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Detail modal state
  const [detailUserData, setDetailUserData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErrors, setDetailErrors] = useState({});
  const [activeTab, setActiveTab] = useState('overview');
  
  // Pagination state
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const statusOptions = [
    { value: 'all', label: 'すべて' },
    { value: 'active', label: 'アクティブ' },
    { value: 'banned', label: 'BAN済み' },
    { value: 'pending', label: '承認待ち' }
  ];

  const roleOptions = [
    { value: 'all', label: 'すべて' },
    { value: 'user', label: '一般ユーザー' },
    { value: 'creator', label: 'クリエイター' }
  ];

  // Firestoreからユーザーデータを取得（getDocs使用でページネーション安定化）
  useEffect(() => {
    const fetchInitialUsers = async () => {
      try {
        const usersQuery = query(
          collection(db, 'users'), 
          orderBy('createdAt', 'desc'),
          limit(100)
        );
        
        const snapshot = await getDocs(usersQuery);
        
        const usersData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            username: data.username || data.displayName || 'Unknown',
            email: data.email || 'No email',
            displayName: data.displayName || data.username || 'Unknown',
            role: data.isCreator ? 'creator' : 'user',
            status: data.isBanned ? 'banned' : 'active',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
            lastLogin: data.lastLoginAt?.toDate ? data.lastLoginAt.toDate() : new Date(),
            postsCount: data.postsCount || 0,
            followersCount: data.followersCount || 0,
            followingCount: data.followingCount || 0,
            totalEarnings: data.totalEarnings || 0,
            isVerified: data.isVerified || false,
            photoURL: data.photoURL || null
          };
        });
        
        // Check if there are more users
        if (snapshot.docs.length < 100) {
          setHasMore(false);
        } else if (snapshot.docs.length > 0) {
          setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
          setHasMore(true);
        }
        
        setUsers(usersData);
        console.log(`✅ Loaded ${usersData.length} users (limit: 100)`);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    };

    fetchInitialUsers();
  }, []);

  // フィルタリング
  useEffect(() => {
    let filtered = [...users];

    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.displayName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(user => user.status === filterStatus);
    }

    if (filterRole !== 'all') {
      filtered = filtered.filter(user => user.role === filterRole);
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, filterStatus, filterRole]);

  // 統計を更新
  useEffect(() => {
    const newStats = {
      total: users.length,
      active: users.filter(u => u.status === 'active').length,
      banned: users.filter(u => u.status === 'banned').length,
      pending: users.filter(u => u.status === 'pending').length,
      creators: users.filter(u => u.role === 'creator').length
    };
    setStats(newStats);
  }, [users]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      const usersQuery = query(
        collection(db, 'users'), 
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      
      const snapshot = await getDocs(usersQuery);
      
      const usersData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          username: data.username || data.displayName || 'Unknown',
          email: data.email || 'No email',
          displayName: data.displayName || data.username || 'Unknown',
          role: data.isCreator ? 'creator' : 'user',
          status: data.isBanned ? 'banned' : 'active',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          lastLogin: data.lastLoginAt?.toDate ? data.lastLoginAt.toDate() : new Date(),
          postsCount: data.postsCount || 0,
          followersCount: data.followersCount || 0,
          followingCount: data.followingCount || 0,
          totalEarnings: data.totalEarnings || 0,
          isVerified: data.isVerified || false,
          photoURL: data.photoURL || null
        };
      });
      
      // Reset pagination state
      if (snapshot.docs.length < 100) {
        setHasMore(false);
      } else if (snapshot.docs.length > 0) {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(true);
      }
      
      setUsers(usersData);
      console.log(`🔄 Refreshed ${usersData.length} users`);
    } catch (error) {
      console.error('Error refreshing users:', error);
      toast({
        title: 'エラー',
        description: 'ユーザーデータの更新に失敗しました',
        variant: 'destructive'
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Load more users with pagination
  const loadMoreUsers = async () => {
    if (!hasMore || loadingMore || !lastDoc) return;
    
    try {
      setLoadingMore(true);
      
      const usersQuery = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(100)
      );
      
      const snapshot = await getDocs(usersQuery);
      
      if (snapshot.docs.length === 0) {
        setHasMore(false);
        return;
      }
      
      const newUsers = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          username: data.username || data.displayName || 'Unknown',
          email: data.email || 'No email',
          displayName: data.displayName || data.username || 'Unknown',
          role: data.isCreator ? 'creator' : 'user',
          status: data.isBanned ? 'banned' : 'active',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          lastLogin: data.lastLoginAt?.toDate ? data.lastLoginAt.toDate() : new Date(),
          postsCount: data.postsCount || 0,
          followersCount: data.followersCount || 0,
          followingCount: data.followingCount || 0,
          totalEarnings: data.totalEarnings || 0,
          isVerified: data.isVerified || false,
          photoURL: data.photoURL || null
        };
      });
      
      // Update pagination state
      if (snapshot.docs.length < 100) {
        setHasMore(false);
      } else {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      }
      
      setUsers(prev => [...prev, ...newUsers]);
      
      console.log(`✅ Loaded ${newUsers.length} more users`);
      
    } catch (error) {
      console.error('Error loading more users:', error);
      toast({
        title: 'エラー',
        description: 'ユーザーの読み込みに失敗しました',
        variant: 'destructive'
      });
    } finally {
      setLoadingMore(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'banned': return 'text-red-600 bg-red-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'creator': return 'text-pink-600 bg-pink-100';
      case 'user': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const handleBanUser = async () => {
    if (!selectedUser || !banReason.trim()) {
      toast({
        title: 'エラー',
        description: 'BAN理由を入力してください',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);
    try {
      const userRef = doc(db, 'users', selectedUser.id);
      await updateDoc(userRef, {
        isBanned: true,
        banReason: banReason.trim(),
        banDate: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Update local state immediately
      setUsers(prev => prev.map(u => 
        u.id === selectedUser.id 
          ? { ...u, status: 'banned' }
          : u
      ));

      toast({
        title: '成功',
        description: `${selectedUser.displayName}をBANしました`,
      });

      setBanModalOpen(false);
      setBanReason('');
      setSelectedUser(null);
    } catch (error) {
      console.error('Error banning user:', error);
      toast({
        title: 'エラー',
        description: 'ユーザーのBAN処理に失敗しました',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnbanUser = async (user) => {
    setIsProcessing(true);
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        isBanned: false,
        banReason: null,
        banDate: null,
        updatedAt: serverTimestamp()
      });

      // Update local state immediately
      setUsers(prev => prev.map(u => 
        u.id === user.id 
          ? { ...u, status: 'active' }
          : u
      ));

      toast({
        title: '成功',
        description: `${user.displayName}のBANを解除しました`,
      });
    } catch (error) {
      console.error('Error unbanning user:', error);
      toast({
        title: 'エラー',
        description: 'BAN解除処理に失敗しました',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setIsProcessing(true);
    try {
      await deleteDoc(doc(db, 'users', selectedUser.id));

      // Remove user from local state immediately
      setUsers(prev => prev.filter(u => u.id !== selectedUser.id));

      toast({
        title: '成功',
        description: `${selectedUser.displayName}を削除しました`,
      });

      setDeleteModalOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: 'エラー',
        description: 'ユーザーの削除に失敗しました',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const openBanModal = (user) => {
    setSelectedUser(user);
    setBanReason('');
    setBanModalOpen(true);
  };

  const openDeleteModal = (user) => {
    setSelectedUser(user);
    setDeleteModalOpen(true);
  };

  // Fetch detailed user data with parallel queries
  const fetchUserDetail = async (userId) => {
    // Reset state before fetching
    setDetailUserData(null);
    setDetailErrors({});
    setDetailLoading(true);

    try {
      const results = await Promise.allSettled([
        // Transactions (subscriptions)
        getDocs(query(
          collection(db, 'transactions'),
          where('userId', '==', userId),
          orderBy('createdAt', 'desc'),
          limit(10)
        )),
        // Tips sent
        getDocs(query(
          collection(db, 'tips'),
          where('fromUserId', '==', userId),
          orderBy('createdAt', 'desc'),
          limit(10)
        )),
        // Tips received
        getDocs(query(
          collection(db, 'tips'),
          where('toUserId', '==', userId),
          orderBy('createdAt', 'desc'),
          limit(10)
        )),
        // Posts
        getDocs(query(
          collection(db, 'posts'),
          where('userId', '==', userId),
          orderBy('createdAt', 'desc'),
          limit(10)
        ))
      ]);

      const [transactionsResult, tipsSentResult, tipsReceivedResult, postsResult] = results;

      // Track errors for each query
      const errors = {};
      
      if (transactionsResult.status === 'rejected') {
        console.error('Transactions query failed:', transactionsResult.reason);
        errors.transactions = transactionsResult.reason.message || 'データ取得に失敗しました';
      }
      
      if (tipsSentResult.status === 'rejected') {
        console.error('Tips sent query failed:', tipsSentResult.reason);
        errors.tipsSent = tipsSentResult.reason.message || 'データ取得に失敗しました';
      }
      
      if (tipsReceivedResult.status === 'rejected') {
        console.error('Tips received query failed:', tipsReceivedResult.reason);
        errors.tipsReceived = tipsReceivedResult.reason.message || 'データ取得に失敗しました';
      }
      
      if (postsResult.status === 'rejected') {
        console.error('Posts query failed:', postsResult.reason);
        errors.posts = postsResult.reason.message || 'データ取得に失敗しました';
      }

      // Show toast only if there are errors
      if (Object.keys(errors).length > 0) {
        toast({
          title: '一部のデータ取得に失敗',
          description: 'Firestoreインデックスが必要な可能性があります',
          variant: 'destructive'
        });
      }

      setDetailErrors(errors);

      const detailData = {
        transactions: transactionsResult.status === 'fulfilled' 
          ? transactionsResult.value.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          : [],
        tipsSent: tipsSentResult.status === 'fulfilled'
          ? tipsSentResult.value.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          : [],
        tipsReceived: tipsReceivedResult.status === 'fulfilled'
          ? tipsReceivedResult.value.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          : [],
        posts: postsResult.status === 'fulfilled'
          ? postsResult.value.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          : []
      };

      setDetailUserData(detailData);
    } catch (error) {
      console.error('Error fetching user detail:', error);
      toast({
        title: 'エラー',
        description: 'ユーザー詳細情報の取得に失敗しました',
        variant: 'destructive'
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const openDetailModal = async (user) => {
    setSelectedUser(user);
    setActiveTab('overview');
    setDetailModalOpen(true);
    await fetchUserDetail(user.id);
  };

  if (loading) {
    return <AdminLoadingState message="ユーザーデータを読み込み中..." />;
  }

  return (
    <AdminPageContainer>
      {/* ページヘッダー */}
      <AdminPageHeader
        title="ユーザー管理"
        description="ユーザーの管理、ステータス確認を行います"
        icon={Users}
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
      <div className="mb-2 text-sm text-gray-500 text-center">
        ※ 統計は読み込み済みユーザー ({users.length}人) のみを反映しています
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <AdminStatsCard
          title="総ユーザー数"
          value={<AnimatedNumber value={stats.total} />}
          icon={Users}
          color="blue"
        />
        <AdminStatsCard
          title="アクティブ"
          value={<AnimatedNumber value={stats.active} />}
          icon={CheckCircle}
          color="green"
        />
        <AdminStatsCard
          title="BAN済み"
          value={<AnimatedNumber value={stats.banned} />}
          icon={Ban}
          color="pink"
        />
        <AdminStatsCard
          title="承認待ち"
          value={<AnimatedNumber value={stats.pending} />}
          icon={Clock}
          color="orange"
        />
        <AdminStatsCard
          title="クリエイター"
          value={<AnimatedNumber value={stats.creators} />}
          icon={Shield}
          color="purple"
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
                placeholder="ユーザーを検索..."
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
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              data-testid="select-role"
            >
              {roleOptions.map(role => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </AdminContentCard>

      {/* ユーザー一覧テーブル */}
      <AdminTableContainer>
        {filteredUsers.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ユーザー
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ステータス
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ロール
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  統計
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  登録日
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user, index) => (
                <motion.tr 
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className="hover:bg-pink-50 transition-colors"
                  data-testid={`row-user-${user.id}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        {user.photoURL ? (
                          <img 
                            className="h-10 w-10 rounded-full object-cover ring-2 ring-pink-100" 
                            src={user.photoURL} 
                            alt={user.displayName}
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center ring-2 ring-pink-100">
                            <span className="text-white font-semibold">
                              {user.displayName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center space-x-2">
                          <div className="text-sm font-semibold text-gray-900">
                            {user.displayName}
                          </div>
                          {user.isVerified && (
                            <CheckCircle className="w-4 h-4 text-blue-500" />
                          )}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(user.status)}`}>
                      {statusOptions.find(s => s.value === user.status)?.label || user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleColor(user.role)}`}>
                      {roleOptions.find(r => r.value === user.role)?.label || user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      <div className="flex items-center space-x-3 text-xs">
                        <span className="text-gray-600">投稿: <span className="font-semibold text-gray-900">{user.postsCount}</span></span>
                        <span className="text-gray-600">フォロワー: <span className="font-semibold text-gray-900">{user.followersCount}</span></span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => openDetailModal(user)}
                        className="flex items-center space-x-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                        data-testid={`button-detail-${user.id}`}
                      >
                        <Eye className="w-3 h-3" />
                        <span>詳細</span>
                      </motion.button>
                      {user.status === 'banned' ? (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleUnbanUser(user)}
                          disabled={isProcessing}
                          className="flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
                          data-testid={`button-unban-${user.id}`}
                        >
                          <UserCheck className="w-3 h-3" />
                          <span>UNBAN</span>
                        </motion.button>
                      ) : (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => openBanModal(user)}
                          disabled={isProcessing}
                          className="flex items-center space-x-1 px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                          data-testid={`button-ban-${user.id}`}
                        >
                          <Ban className="w-3 h-3" />
                          <span>BAN</span>
                        </motion.button>
                      )}
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => openDeleteModal(user)}
                        disabled={isProcessing}
                        className="flex items-center space-x-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                        data-testid={`button-delete-${user.id}`}
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
            icon={Users}
            title="ユーザーが見つかりません"
            description="検索条件を変更してください"
          />
        )}
      </AdminTableContainer>

      {/* Load More Button for Pagination */}
      {hasMore && !loading && users.length > 0 && (
        <div className="flex justify-center mt-6">
          <motion.button
            onClick={loadMoreUsers}
            disabled={loadingMore}
            className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-full shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
            whileHover={{ scale: loadingMore ? 1 : 1.05 }}
            whileTap={{ scale: loadingMore ? 1 : 0.95 }}
            data-testid="button-load-more-users"
          >
            {loadingMore ? (
              <div className="flex items-center space-x-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>読み込み中...</span>
              </div>
            ) : (
              <span>さらに読み込む</span>
            )}
          </motion.button>
        </div>
      )}

      {/* BANモーダル */}
      <AnimatePresence>
        {banModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => !isProcessing && setBanModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
              data-testid="modal-ban"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <Ban className="w-6 h-6 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">ユーザーをBANする</h3>
                </div>
                <button
                  onClick={() => !isProcessing && setBanModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={isProcessing}
                  data-testid="button-close-ban-modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {selectedUser && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {selectedUser.photoURL ? (
                      <img
                        src={selectedUser.photoURL}
                        alt={selectedUser.displayName}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center text-white font-semibold">
                        {selectedUser.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-gray-900">{selectedUser.displayName}</div>
                      <div className="text-sm text-gray-500">{selectedUser.email}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  BAN理由 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="BAN理由を入力してください..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                  disabled={isProcessing}
                  data-testid="input-ban-reason"
                />
              </div>

              <div className="flex space-x-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setBanModalOpen(false)}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  data-testid="button-cancel-ban"
                >
                  キャンセル
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleBanUser}
                  disabled={isProcessing || !banReason.trim()}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="button-confirm-ban"
                >
                  {isProcessing ? '処理中...' : 'BANする'}
                </motion.button>
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
              data-testid="modal-delete"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">ユーザーを削除</h3>
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

              {selectedUser && (
                <>
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {selectedUser.photoURL ? (
                        <img
                          src={selectedUser.photoURL}
                          alt={selectedUser.displayName}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center text-white font-semibold">
                          {selectedUser.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-gray-900">{selectedUser.displayName}</div>
                        <div className="text-sm text-gray-500">{selectedUser.email}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">
                      <strong>警告:</strong> このユーザーを削除すると、すべての投稿、コメント、フォロワー情報が完全に削除されます。この操作は取り消せません。
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
                  onClick={handleDeleteUser}
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

      {/* ユーザー詳細モーダル */}
      <AnimatePresence>
        {detailModalOpen && selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setDetailModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
              data-testid="modal-user-detail"
            >
              {/* ヘッダー */}
              <div className="relative bg-gradient-to-r from-pink-500 to-purple-600 px-6 py-8">
                <button
                  onClick={() => setDetailModalOpen(false)}
                  className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
                  data-testid="button-close-detail-modal"
                >
                  <X className="w-6 h-6" />
                </button>
                
                <div className="flex items-center space-x-4">
                  {selectedUser.photoURL ? (
                    <img
                      src={selectedUser.photoURL}
                      alt={selectedUser.displayName}
                      className="w-20 h-20 rounded-full object-cover ring-4 ring-white"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center text-pink-600 font-bold text-2xl ring-4 ring-white">
                      {selectedUser.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="text-white">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="text-2xl font-bold">{selectedUser.displayName}</h3>
                      {selectedUser.isVerified && (
                        <CheckCircle className="w-6 h-6" />
                      )}
                    </div>
                    <p className="text-pink-100">{selectedUser.email}</p>
                    <div className="flex items-center space-x-3 mt-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        selectedUser.status === 'active' ? 'bg-green-500 text-white' : 
                        selectedUser.status === 'banned' ? 'bg-red-500 text-white' : 
                        'bg-yellow-500 text-white'
                      }`}>
                        {statusOptions.find(s => s.value === selectedUser.status)?.label}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        selectedUser.role === 'creator' ? 'bg-pink-300 text-pink-900' : 'bg-blue-300 text-blue-900'
                      }`}>
                        {roleOptions.find(r => r.value === selectedUser.role)?.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* タブナビゲーション */}
              <div className="flex border-b border-gray-200 px-6">
                {[
                  { id: 'overview', label: '概要', icon: Activity },
                  { id: 'transactions', label: '取引', icon: CreditCard },
                  { id: 'tips', label: 'チップ', icon: Gift },
                  { id: 'posts', label: '投稿', icon: FileText }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 px-4 py-3 font-medium transition-colors relative ${
                      activeTab === tab.id
                        ? 'text-pink-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    data-testid={`tab-${tab.id}`}
                  >
                    <tab.icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    {activeTab === tab.id && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-600"
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* タブコンテンツ */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-280px)]">
                {detailLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="w-12 h-12 border-4 border-pink-200 border-t-pink-600 rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-gray-500">詳細情報を読み込み中...</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* 概要タブ */}
                    {activeTab === 'overview' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-blue-50 rounded-xl p-4">
                            <div className="flex items-center space-x-2 mb-2">
                              <FileText className="w-5 h-5 text-blue-600" />
                              <span className="text-sm font-medium text-blue-900">投稿数</span>
                            </div>
                            <p className="text-2xl font-bold text-blue-600">{selectedUser.postsCount}</p>
                          </div>
                          <div className="bg-green-50 rounded-xl p-4">
                            <div className="flex items-center space-x-2 mb-2">
                              <Users className="w-5 h-5 text-green-600" />
                              <span className="text-sm font-medium text-green-900">フォロワー</span>
                            </div>
                            <p className="text-2xl font-bold text-green-600">{selectedUser.followersCount}</p>
                          </div>
                          <div className="bg-purple-50 rounded-xl p-4">
                            <div className="flex items-center space-x-2 mb-2">
                              <Heart className="w-5 h-5 text-purple-600" />
                              <span className="text-sm font-medium text-purple-900">フォロー中</span>
                            </div>
                            <p className="text-2xl font-bold text-purple-600">{selectedUser.followingCount}</p>
                          </div>
                          <div className="bg-pink-50 rounded-xl p-4">
                            <div className="flex items-center space-x-2 mb-2">
                              <DollarSign className="w-5 h-5 text-pink-600" />
                              <span className="text-sm font-medium text-pink-900">総収益</span>
                            </div>
                            <p className="text-2xl font-bold text-pink-600">¥{selectedUser.totalEarnings.toLocaleString()}</p>
                          </div>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-4">
                          <h4 className="font-semibold text-gray-900 mb-3">アカウント情報</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">登録日:</span>
                              <span className="font-medium text-gray-900">{formatDate(selectedUser.createdAt)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">最終ログイン:</span>
                              <span className="font-medium text-gray-900">{formatDate(selectedUser.lastLogin)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">認証状態:</span>
                              <span className={`font-medium ${selectedUser.isVerified ? 'text-green-600' : 'text-gray-500'}`}>
                                {selectedUser.isVerified ? '認証済み' : '未認証'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 取引タブ */}
                    {activeTab === 'transactions' && detailUserData && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-4">サブスクリプション履歴</h4>
                        {detailErrors.transactions ? (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                            <p className="text-red-800 font-medium mb-2">データ取得エラー</p>
                            <p className="text-sm text-red-600 mb-4">{detailErrors.transactions}</p>
                            <button
                              onClick={() => fetchUserDetail(selectedUser.id)}
                              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            >
                              再試行
                            </button>
                          </div>
                        ) : detailUserData.transactions.length > 0 ? (
                          <div className="space-y-3">
                            {detailUserData.transactions.map((tx, idx) => (
                              <div key={tx.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg" data-testid={`transaction-${idx}`}>
                                <div className="flex items-center space-x-3">
                                  <CreditCard className="w-5 h-5 text-blue-600" />
                                  <div>
                                    <p className="font-medium text-gray-900">{tx.type === 'subscription' ? 'サブスクリプション' : tx.type}</p>
                                    <p className="text-sm text-gray-500">
                                      {tx.createdAt?.toDate ? formatDate(tx.createdAt.toDate()) : 'N/A'}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-green-600">¥{(tx.amount || 0).toLocaleString()}</p>
                                  <p className="text-xs text-gray-500">{tx.status || 'completed'}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>取引履歴がありません</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* チップタブ */}
                    {activeTab === 'tips' && detailUserData && (
                      <div className="space-y-6">
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-4">送信したチップ</h4>
                          {detailErrors.tipsSent ? (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                              <p className="text-red-800 font-medium mb-2">データ取得エラー</p>
                              <p className="text-sm text-red-600 mb-4">{detailErrors.tipsSent}</p>
                              <button
                                onClick={() => fetchUserDetail(selectedUser.id)}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                              >
                                再試行
                              </button>
                            </div>
                          ) : detailUserData.tipsSent.length > 0 ? (
                            <div className="space-y-3">
                              {detailUserData.tipsSent.map((tip, idx) => (
                                <div key={tip.id} className="flex items-center justify-between p-4 bg-red-50 rounded-lg" data-testid={`tip-sent-${idx}`}>
                                  <div className="flex items-center space-x-3">
                                    <Gift className="w-5 h-5 text-red-600" />
                                    <div>
                                      <p className="font-medium text-gray-900">チップ送信</p>
                                      <p className="text-sm text-gray-500">
                                        {tip.createdAt?.toDate ? formatDate(tip.createdAt.toDate()) : 'N/A'}
                                      </p>
                                    </div>
                                  </div>
                                  <p className="font-bold text-red-600">-¥{(tip.amount || 0).toLocaleString()}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-gray-500">
                              <Gift className="w-12 h-12 mx-auto mb-2 opacity-50" />
                              <p>送信したチップがありません</p>
                            </div>
                          )}
                        </div>

                        <div>
                          <h4 className="font-semibold text-gray-900 mb-4">受信したチップ</h4>
                          {detailErrors.tipsReceived ? (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                              <p className="text-red-800 font-medium mb-2">データ取得エラー</p>
                              <p className="text-sm text-red-600 mb-4">{detailErrors.tipsReceived}</p>
                              <button
                                onClick={() => fetchUserDetail(selectedUser.id)}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                              >
                                再試行
                              </button>
                            </div>
                          ) : detailUserData.tipsReceived.length > 0 ? (
                            <div className="space-y-3">
                              {detailUserData.tipsReceived.map((tip, idx) => (
                                <div key={tip.id} className="flex items-center justify-between p-4 bg-green-50 rounded-lg" data-testid={`tip-received-${idx}`}>
                                  <div className="flex items-center space-x-3">
                                    <Gift className="w-5 h-5 text-green-600" />
                                    <div>
                                      <p className="font-medium text-gray-900">チップ受信</p>
                                      <p className="text-sm text-gray-500">
                                        {tip.createdAt?.toDate ? formatDate(tip.createdAt.toDate()) : 'N/A'}
                                      </p>
                                    </div>
                                  </div>
                                  <p className="font-bold text-green-600">+¥{(tip.amount || 0).toLocaleString()}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-gray-500">
                              <Gift className="w-12 h-12 mx-auto mb-2 opacity-50" />
                              <p>受信したチップがありません</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 投稿タブ */}
                    {activeTab === 'posts' && detailUserData && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-4">投稿履歴</h4>
                        {detailErrors.posts ? (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                            <p className="text-red-800 font-medium mb-2">データ取得エラー</p>
                            <p className="text-sm text-red-600 mb-4">{detailErrors.posts}</p>
                            <button
                              onClick={() => fetchUserDetail(selectedUser.id)}
                              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            >
                              再試行
                            </button>
                          </div>
                        ) : detailUserData.posts.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {detailUserData.posts.map((post, idx) => (
                              <div key={post.id} className="bg-gray-50 rounded-lg p-4" data-testid={`post-${idx}`}>
                                <div className="flex items-start space-x-3">
                                  <FileText className="w-5 h-5 text-gray-600 mt-1" />
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900 line-clamp-2">{post.caption || '(キャプションなし)'}</p>
                                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                                      <span className="flex items-center space-x-1">
                                        <Heart className="w-4 h-4" />
                                        <span>{post.likesCount || 0}</span>
                                      </span>
                                      <span className="flex items-center space-x-1">
                                        <MessageSquare className="w-4 h-4" />
                                        <span>{post.commentsCount || 0}</span>
                                      </span>
                                      <span>{post.createdAt?.toDate ? formatDate(post.createdAt.toDate()) : 'N/A'}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>投稿がありません</p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminPageContainer>
  );
};

export default UserManagement;
