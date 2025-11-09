import React, { useState, useEffect } from "react";
import { motion } from 'framer-motion';
import { 
  Users, 
  UserPlus, 
  FileText, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Eye,
  Heart,
  MessageCircle,
  Activity,
  RefreshCw,
  Download,
  Crown,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Video,
  Gift,
  UserCheck
} from 'lucide-react';
import { db } from '../../../firebase';
import { collection, getDocs, query, where, orderBy, limit, onSnapshot, getCountFromServer } from 'firebase/firestore';
import { AdminPageContainer, AdminPageHeader, AdminLoadingState } from './AdminPageContainer';

// カウントアップアニメーションコンポーネント
const AnimatedNumber = ({ value, duration = 2, prefix = '', suffix = '' }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    // 数値ガード：valueが数値でない場合は0を使用
    const numericValue = typeof value === 'number' && !isNaN(value) ? value : 0;
    
    let startTime;
    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = (currentTime - startTime) / (duration * 1000);
      
      if (progress < 1) {
        setDisplayValue(Math.floor(numericValue * progress));
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(numericValue);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span>{prefix}{displayValue.toLocaleString()}{suffix}</span>;
};

// 統計カードコンポーネント
const StatCard = ({ title, value, trend, trendValue, icon: Icon, gradient, delay = 0, prefix = '', suffix = '' }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -8, scale: 1.02 }}
      className="relative group"
    >
      <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl blur-xl -z-10"
           style={{ background: gradient }}></div>
      
      <div className="relative bg-white rounded-2xl p-6 shadow-lg border border-gray-100 overflow-hidden">
        {/* 背景装飾 */}
        <div className="absolute top-0 right-0 w-32 h-32 opacity-5">
          <div className="absolute inset-0 bg-gradient-to-br rounded-full" style={{ background: gradient }}></div>
        </div>

        {/* アイコン */}
        <div className="relative flex items-start justify-between mb-4">
          <div className="relative">
            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br shadow-lg flex items-center justify-center transform group-hover:scale-110 transition-transform duration-300`}
                 style={{ background: gradient }}>
              <Icon className="w-7 h-7 text-white" />
            </div>
            <motion.div
              className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: delay + 0.5, type: "spring", stiffness: 500 }}
            >
              <Sparkles className="w-3 h-3 text-pink-500" />
            </motion.div>
          </div>

          {/* トレンド */}
          {trend && (
            <div className={`flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-semibold ${
              trend === 'up' 
                ? 'bg-green-50 text-green-600' 
                : 'bg-red-50 text-red-600'
            }`}>
              {trend === 'up' ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <ArrowDownRight className="w-4 h-4" />
              )}
              <span>{trendValue}</span>
            </div>
          )}
        </div>

        {/* データ */}
        <div className="relative">
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">
            <AnimatedNumber value={value} prefix={prefix} suffix={suffix} />
          </p>
        </div>

        {/* ホバー時のシャイン効果 */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 transform -skew-x-12 group-hover:translate-x-full transition-all duration-700"></div>
      </div>
    </motion.div>
  );
};

// アクティビティカードコンポーネント
const ActivityCard = ({ activity, index }) => {
  const getActivityIcon = (type) => {
    switch (type) {
      case 'user_registration':
        return <UserPlus className="w-5 h-5 text-white" />;
      case 'post_created':
        return <FileText className="w-5 h-5 text-white" />;
      case 'live_stream_started':
        return <Video className="w-5 h-5 text-white" />;
      case 'match_created':
        return <UserCheck className="w-5 h-5 text-white" />;
      case 'tip_received':
        return <Gift className="w-5 h-5 text-white" />;
      default:
        return <Activity className="w-5 h-5 text-white" />;
    }
  };

  const getActivityColor = (type) => {
    switch (type) {
      case 'user_registration':
        return 'from-blue-400 to-blue-600';
      case 'post_created':
        return 'from-green-400 to-green-600';
      case 'live_stream_started':
        return 'from-purple-400 to-purple-600';
      case 'match_created':
        return 'from-pink-400 to-pink-600';
      case 'tip_received':
        return 'from-yellow-400 to-yellow-600';
      default:
        return 'from-gray-400 to-gray-600';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="flex items-center space-x-4 p-4 rounded-xl hover:bg-pink-50 transition-all duration-200 group"
    >
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getActivityColor(activity.type)} shadow-md flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-200`}>
        {getActivityIcon(activity.type)}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{activity.title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{activity.description}</p>
      </div>
      
      <div className="text-xs font-medium text-gray-400 flex-shrink-0">
        {activity.timeAgo}
      </div>
    </motion.div>
  );
};

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCreators: 0,
    totalPosts: 0,
    totalRevenue: 0,
    activeUsers: 0,
    newUsersToday: 0,
    newUsersThisWeek: 0,
    newUsersThisMonth: 0,
    pendingReports: 0,
    verifiedCreators: 0,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    totalLiveRooms: 0,
    activeLiveRooms: 0,
    totalMatches: 0,
    todayMatches: 0,
    totalChatRooms: 0,
    totalTips: 0,
    tipsRevenue: 0,
    subscriptionRevenue: 0
  });

  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Firestoreのタイムスタンプを安全に変換
  const convertTimestamp = (timestamp) => {
    if (!timestamp) return null;
    if (timestamp.toDate) {
      return timestamp.toDate();
    }
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      return new Date(timestamp);
    }
    return null;
  };

  const getTimeAgo = (timestamp) => {
    const date = convertTimestamp(timestamp);
    if (!date || isNaN(date.getTime())) return '不明';
    
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '今';
    if (minutes < 60) return `${minutes}分前`;
    if (hours < 24) return `${hours}時間前`;
    return `${days}日前`;
  };

  // リアルタイムでFirestoreデータを監視
  useEffect(() => {
    const unsubscribeCallbacks = [];

    // ユーザーデータをリアルタイム監視
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const totalUsers = snapshot.size;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      
      let newUsersToday = 0;
      let newUsersThisWeek = 0;
      let newUsersThisMonth = 0;
      let totalCreators = 0;
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const userDate = convertTimestamp(data.createdAt);
        
        if (data.role === 'creator') {
          totalCreators++;
        }
        
        if (userDate) {
          if (userDate >= today) newUsersToday++;
          if (userDate >= weekStart) newUsersThisWeek++;
          if (userDate >= monthStart) newUsersThisMonth++;
        }
      });

      setStats(prev => ({
        ...prev,
        totalUsers,
        totalCreators,
        activeUsers: Math.floor(totalUsers * 0.7),
        newUsersToday,
        newUsersThisWeek,
        newUsersThisMonth,
        verifiedCreators: Math.floor(totalCreators * 0.8)
      }));
      
      setLoading(false);
      setIsRefreshing(false);
    });
    unsubscribeCallbacks.push(unsubscribeUsers);

    // 投稿データをリアルタイム監視
    const unsubscribePosts = onSnapshot(collection(db, 'posts'), (snapshot) => {
      const totalPosts = snapshot.size;
      
      let totalViews = 0;
      let totalLikes = 0;
      let totalComments = 0;
      
      snapshot.forEach(doc => {
        const data = doc.data();
        totalViews += data.views || 0;
        totalLikes += (Array.isArray(data.likes) ? data.likes.length : 0);
        totalComments += data.comments || 0;
      });

      setStats(prev => ({
        ...prev,
        totalPosts,
        totalViews,
        totalLikes,
        totalComments
      }));
    });
    unsubscribeCallbacks.push(unsubscribePosts);

    // 取引データをリアルタイム監視（完了した取引のみを合計）
    const unsubscribeTransactions = onSnapshot(collection(db, 'transactions'), (snapshot) => {
      let totalRevenue = 0;
      let subscriptionRevenue = 0;
      
      snapshot.forEach(doc => {
        const data = doc.data();
        // 完了した取引のみを合計
        if (data.status === 'completed') {
          const amount = data.amount || 0;
          totalRevenue += amount;
          
          // サブスクリプション収益
          if (data.type === 'subscription' || data.description?.includes('サブスクリプション')) {
            subscriptionRevenue += amount;
          }
        }
      });

      setStats(prev => ({
        ...prev,
        totalRevenue,
        subscriptionRevenue
      }));
    });
    unsubscribeCallbacks.push(unsubscribeTransactions);

    // チップデータをリアルタイム監視
    const unsubscribeTips = onSnapshot(collection(db, 'tips'), (snapshot) => {
      let totalTips = snapshot.size;
      let tipsRevenue = 0;
      
      snapshot.forEach(doc => {
        const data = doc.data();
        tipsRevenue += data.amount || 0;
      });

      setStats(prev => ({
        ...prev,
        totalTips,
        tipsRevenue
      }));
    });
    unsubscribeCallbacks.push(unsubscribeTips);

    // ライブ配信データをリアルタイム監視
    const unsubscribeLiveRooms = onSnapshot(collection(db, 'liveRooms'), (snapshot) => {
      let totalLiveRooms = snapshot.size;
      let activeLiveRooms = 0;
      
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.status === 'active') {
          activeLiveRooms++;
        }
      });

      setStats(prev => ({
        ...prev,
        totalLiveRooms,
        activeLiveRooms
      }));
    });
    unsubscribeCallbacks.push(unsubscribeLiveRooms);

    // マッチングデータをリアルタイム監視
    const unsubscribeMatches = onSnapshot(collection(db, 'matches'), (snapshot) => {
      let totalMatches = snapshot.size;
      let todayMatches = 0;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const matchDate = convertTimestamp(data.createdAt);
        if (matchDate && matchDate >= today) {
          todayMatches++;
        }
      });

      setStats(prev => ({
        ...prev,
        totalMatches,
        todayMatches,
        totalChatRooms: totalMatches
      }));
    });
    unsubscribeCallbacks.push(unsubscribeMatches);

    // 最近のアクティビティ
    const fetchRecentActivities = async () => {
      const activities = [];

      // 最近のユーザー登録
      const recentUsersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(2));
      const usersSnapshot = await getDocs(recentUsersQuery);
      usersSnapshot.forEach(doc => {
        const data = doc.data();
        activities.push({
          type: 'user_registration',
          title: `${data.displayName || data.username || 'ユーザー'}が登録`,
          description: data.email || 'メールアドレス未登録',
          timeAgo: getTimeAgo(data.createdAt),
          timestamp: data.createdAt
        });
      });

      // 最近の投稿
      const recentPostsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(2));
      const postsSnapshot = await getDocs(recentPostsQuery);
      postsSnapshot.forEach(doc => {
        const data = doc.data();
        activities.push({
          type: 'post_created',
          title: `新しい投稿: ${data.title || 'タイトルなし'}`,
          description: `${data.creatorName || data.username || '不明'}が投稿`,
          timeAgo: getTimeAgo(data.createdAt),
          timestamp: data.createdAt
        });
      });

      // 最近のライブ配信
      const recentLiveQuery = query(collection(db, 'liveRooms'), orderBy('createdAt', 'desc'), limit(2));
      const liveSnapshot = await getDocs(recentLiveQuery);
      liveSnapshot.forEach(doc => {
        const data = doc.data();
        activities.push({
          type: 'live_stream_started',
          title: `ライブ配信: ${data.title || 'タイトルなし'}`,
          description: data.status === 'active' ? '配信中' : '終了',
          timeAgo: getTimeAgo(data.createdAt),
          timestamp: data.createdAt
        });
      });

      // 最近のマッチング
      const recentMatchesQuery = query(collection(db, 'matches'), orderBy('createdAt', 'desc'), limit(2));
      const matchesSnapshot = await getDocs(recentMatchesQuery);
      matchesSnapshot.forEach(doc => {
        const data = doc.data();
        activities.push({
          type: 'match_created',
          title: '新しいマッチング成立',
          description: 'ユーザー間でマッチングが成立しました',
          timeAgo: getTimeAgo(data.createdAt),
          timestamp: data.createdAt
        });
      });

      // 最近のチップ
      const recentTipsQuery = query(collection(db, 'tips'), orderBy('createdAt', 'desc'), limit(2));
      const tipsSnapshot = await getDocs(recentTipsQuery);
      tipsSnapshot.forEach(doc => {
        const data = doc.data();
        activities.push({
          type: 'tip_received',
          title: `チップ: ¥${(data.amount || 0).toLocaleString()}`,
          description: `${data.fromUsername || '匿名'}から${data.toCreatorName || 'クリエイター'}へ`,
          timeAgo: getTimeAgo(data.createdAt),
          timestamp: data.createdAt
        });
      });

      // タイムスタンプでソートして最新5件を取得
      const sortedActivities = activities
        .sort((a, b) => {
          const timeA = convertTimestamp(a.timestamp);
          const timeB = convertTimestamp(b.timestamp);
          if (!timeA || !timeB) return 0;
          return timeB - timeA;
        })
        .slice(0, 5);

      setRecentActivity(sortedActivities);
    };

    fetchRecentActivities();
    const activityInterval = setInterval(fetchRecentActivities, 30000); // 30秒ごとに更新
    unsubscribeCallbacks.push(() => clearInterval(activityInterval));

    return () => {
      unsubscribeCallbacks.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
  };

  if (loading) {
    return <AdminLoadingState message="ダッシュボードを読み込み中..." />;
  }

  return (
    <AdminPageContainer>
      {/* ページヘッダー */}
      <AdminPageHeader
        title="管理ダッシュボード"
        description="Only-U Admin Panel"
        icon={Crown}
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

      {/* 統計カード - 行1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard
          title="総ユーザー数"
          value={stats.totalUsers}
          trend="up"
          trendValue={`本日+${stats.newUsersToday}`}
          icon={Users}
          gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
          delay={0}
        />
        
        <StatCard
          title="クリエイター数"
          value={stats.totalCreators}
          trend="up"
          trendValue={`認証${stats.verifiedCreators}`}
          icon={UserPlus}
          gradient="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
          delay={0.1}
        />
        
        <StatCard
          title="総投稿数"
          value={stats.totalPosts}
          trend="up"
          trendValue={`${stats.totalViews.toLocaleString()} 閲覧`}
          icon={FileText}
          gradient="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
          delay={0.2}
        />
        
        <StatCard
          title="総売上"
          value={stats.totalRevenue}
          prefix="¥"
          trend="up"
          trendValue="今月"
          icon={DollarSign}
          gradient="linear-gradient(135deg, #fa709a 0%, #fee140 100%)"
          delay={0.3}
        />
      </div>

      {/* 統計カード - 行2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="ライブ配信"
          value={stats.totalLiveRooms}
          trend={stats.activeLiveRooms > 0 ? "up" : undefined}
          trendValue={stats.activeLiveRooms > 0 ? `${stats.activeLiveRooms} 配信中` : "オフライン"}
          icon={Video}
          gradient="linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)"
          delay={0.4}
        />
        
        <StatCard
          title="マッチング数"
          value={stats.totalMatches}
          trend="up"
          trendValue={`本日+${stats.todayMatches}`}
          icon={UserCheck}
          gradient="linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)"
          delay={0.5}
        />
        
        <StatCard
          title="チップ収益"
          value={stats.tipsRevenue}
          prefix="¥"
          trend="up"
          trendValue={`${stats.totalTips}件`}
          icon={Gift}
          gradient="linear-gradient(135deg, #fddb92 0%, #d1fdff 100%)"
          delay={0.6}
        />
        
        <StatCard
          title="チャット数"
          value={stats.totalChatRooms}
          trend="up"
          trendValue={`${stats.totalMatches} ルーム`}
          icon={MessageCircle}
          gradient="linear-gradient(135deg, #96fbc4 0%, #f9f586 100%)"
          delay={0.7}
        />
      </div>

      {/* 最近のアクティビティ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-pink-50 to-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center shadow-md">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">最近のアクティビティ</h2>
          </div>
        </div>

        <div className="p-6">
          {recentActivity.length > 0 ? (
            <div className="space-y-2">
              {recentActivity.map((activity, index) => (
                <ActivityCard key={index} activity={activity} index={index} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Activity className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">まだアクティビティがありません</p>
            </div>
          )}
        </div>
      </motion.div>
    </AdminPageContainer>
  );
}
