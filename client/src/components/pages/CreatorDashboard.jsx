import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  Users, 
  Heart, 
  Eye, 
  DollarSign, 
  TrendingUp, 
  Video,
  Settings,
  ArrowLeft,
  Download,
  Share2,
  Target,
  Plus,
  Edit3,
  Trash2,
  MessageCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import BottomNavigationWithCreator from '../BottomNavigationWithCreator';

const CreatorDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [activeTab, setActiveTab] = useState('analytics');
  const [analyticsTab, setAnalyticsTab] = useState('posts');
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalViews: 0,
    totalLikes: 0,
    totalFollowers: 0,
    totalEarnings: 0,
    postsCount: 0,
    engagementRate: 0
  });
  const [marketingCampaigns, setMarketingCampaigns] = useState([]);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [postsData, setPostsData] = useState([]);
  const [plansData, setPlansData] = useState([]);
  
  // マーケティング方法のサンプルデータ
  const marketingMethods = [
    {
      id: 1,
      name: 'SNSマーケティング',
      platform: 'Twitter / Instagram',
      description: 'SNSでフォロワーを増やし、投稿をシェアして認知度を高める',
      cost: 5000,
      reach: 10000,
      engagement: 800,
      conversion: 50,
      roi: 250,
      bestPractices: ['定期投稿', 'ハッシュタグ活用', 'フォロワーとの交流']
    },
    {
      id: 2,
      name: 'コラボレーション',
      platform: '他クリエイター',
      description: '他のクリエイターとコラボして相互にフォロワーを増やす',
      cost: 0,
      reach: 5000,
      engagement: 600,
      conversion: 40,
      roi: 400,
      bestPractices: ['相性の良いクリエイター選び', '企画の魅力', '相互プロモーション']
    },
    {
      id: 3,
      name: '広告キャンペーン',
      platform: 'Google / Facebook Ads',
      description: 'ターゲット広告で新規ファンを獲得',
      cost: 20000,
      reach: 50000,
      engagement: 2500,
      conversion: 150,
      roi: 180,
      bestPractices: ['ターゲティング最適化', 'A/Bテスト', 'リターゲティング']
    }
  ];

  // Firestoreからクリエイターデータを取得
  useEffect(() => {
    if (!currentUser) return;

    const fetchCreatorData = async () => {
      try {
        setIsLoading(true);

        // 現在のユーザーのデータを取得
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        const userData = userDoc.data();

        // フォロワー数を取得（他のユーザーのfollowing配列に含まれているかカウント）
        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersRef);
        let followerCount = 0;
        usersSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.following && Array.isArray(data.following) && data.following.includes(currentUser.uid)) {
            followerCount++;
          }
        });

        // 投稿データを取得
        const postsRef = collection(db, 'posts');
        const postsQuery = query(postsRef, where('userId', '==', currentUser.uid));
        const postsSnapshot = await getDocs(postsQuery);
        
        let totalViews = 0;
        let totalLikes = 0;
        let totalComments = 0;
        
        const postsArray = postsSnapshot.docs.map(doc => {
          const data = doc.data();
          totalViews += data.views || 0;
          totalLikes += data.likes || 0;
          totalComments += (data.comments?.length || 0);
          
          const engagementRate = data.views > 0 
            ? ((data.likes || 0) + (data.comments?.length || 0)) / data.views * 100 
            : 0;
          
          return {
            id: doc.id,
            title: data.title || data.caption || '無題',
            type: data.type || 'image',
            views: data.views || 0,
            likes: data.likes || 0,
            comments: data.comments?.length || 0,
            shares: data.shares || 0,
            engagementRate: engagementRate.toFixed(1),
            publishDate: data.createdAt?.toDate().toLocaleDateString('ja-JP') || new Date().toLocaleDateString('ja-JP'),
            thumbnail: data.images?.[0] || data.image || data.mediaUrl || 'https://via.placeholder.com/300x200',
            revenue: (data.views || 0) * 0.1 // 仮の収益計算
          };
        });

        setPostsData(postsArray);

        // サブスクリプションプランデータを取得
        const plansRef = collection(db, 'subscriptionPlans');
        const plansQuery = query(plansRef, where('creatorId', '==', currentUser.uid));
        const plansSnapshot = await getDocs(plansQuery);
        
        let totalEarnings = 0;
        
        const plansArray = plansSnapshot.docs.map(doc => {
          const data = doc.data();
          const subscribers = data.subscribers || 0;
          const revenue = (data.price || 0) * subscribers;
          totalEarnings += revenue;
          
          return {
            id: doc.id,
            name: data.name || 'プラン',
            price: data.price || 0,
            subscribers: subscribers,
            revenue: revenue,
            conversionRate: data.conversionRate || 2.5,
            churnRate: data.churnRate || 5.0,
            avgLifetime: data.avgLifetime || 20.0
          };
        });

        setPlansData(plansArray);

        // 統計を更新
        const postsCount = postsArray.length;
        const totalEngagements = totalLikes + totalComments;
        const avgEngagementRate = totalViews > 0 
          ? (totalEngagements / totalViews * 100).toFixed(1)
          : 0;

        setStats({
          totalViews,
          totalLikes,
          totalFollowers: followerCount,
          totalEarnings,
          postsCount,
          engagementRate: parseFloat(avgEngagementRate)
        });

        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching creator data:', error);
        setIsLoading(false);
      }
    };

    fetchCreatorData();
  }, [currentUser]);

  // プロフィール分析データ
  const [profileData, setProfileData] = useState({
    totalFollowers: 0,
    newFollowers: 0,
    unfollowers: 0,
    followerGrowth: 0,
    demographics: {
      age: {
        '18-24': 35,
        '25-34': 40,
        '35-44': 20,
        '45+': 5
      },
      gender: {
        female: 65,
        male: 35
      },
      location: {
        '東京': 30,
        '大阪': 15,
        '名古屋': 10,
        'その他': 45
      }
    },
    engagement: {
      avgLikes: 0,
      avgComments: 0,
      avgShares: 0,
      responseTime: 2.3
    }
  });

  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const analyticsData = [
    { label: '月', views: 1200, likes: 80 },
    { label: '火', views: 1500, likes: 95 },
    { label: '水', views: 1800, likes: 110 },
    { label: '木', views: 1600, likes: 100 },
    { label: '金', views: 2200, likes: 140 },
    { label: '土', views: 2500, likes: 160 },
    { label: '日', views: 2000, likes: 130 }
  ];

  const maxViews = analyticsData.length > 0 ? Math.max(...analyticsData.map(d => d.views)) : 1;
  const maxLikes = analyticsData.length > 0 ? Math.max(...analyticsData.map(d => d.likes)) : 1;

  // マーケティング機能のハンドラー
  const handleCreateCampaign = () => {
    setEditingCampaign(null);
    setShowCampaignModal(true);
  };

  const handleEditCampaign = (campaign) => {
    setEditingCampaign(campaign);
    setShowCampaignModal(true);
  };

  const handleDeleteCampaign = (campaignId) => {
    setMarketingCampaigns(prev => prev.filter(c => c.id !== campaignId));
  };

  const handleToggleCampaign = (campaignId) => {
    setMarketingCampaigns(prev => prev.map(c => 
      c.id === campaignId 
        ? { ...c, status: c.status === 'active' ? 'paused' : 'active' }
        : c
    ));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-gradient-to-r from-pink-100 to-pink-200 text-pink-800';
      case 'paused': return 'bg-gradient-to-r from-pink-50 to-pink-100 text-pink-600';
      case 'completed': return 'bg-gradient-to-r from-pink-200 to-pink-300 text-pink-700';
      default: return 'bg-gradient-to-r from-pink-50 to-pink-100 text-pink-500';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return '実行中';
      case 'paused': return '一時停止';
      case 'completed': return '完了';
      default: return '不明';
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-pink-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">ログインが必要です</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-pink-100 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-pink-100 pb-20">
      {/* Header - ピンクグラデーション */}
      <div className="bg-gradient-to-r from-pink-500 to-pink-600 border-b border-pink-300 px-4 py-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </motion.button>
            <h1 className="text-base font-bold text-white">クリエイターダッシュボード</h1>
          </div>
          <div className="flex items-center space-x-1">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              data-testid="button-download"
            >
              <Download className="w-4 h-4 text-white" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              data-testid="button-share"
            >
              <Share2 className="w-4 h-4 text-white" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              data-testid="button-settings"
            >
              <Settings className="w-4 h-4 text-white" />
            </motion.button>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-4">
        {/* Tab Navigation - ピンクグラデーション */}
        <div className="bg-white rounded-xl p-1 shadow-lg border border-pink-100">
          <div className="flex space-x-1">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab('analytics')}
              className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'analytics'
                  ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-md'
                  : 'bg-transparent text-gray-600 hover:bg-pink-50'
              }`}
              data-testid="tab-analytics"
            >
              <BarChart3 className="w-4 h-4 inline mr-2" />
              分析
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab('marketing')}
              className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'marketing'
                  ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-md'
                  : 'bg-transparent text-gray-600 hover:bg-pink-50'
              }`}
              data-testid="tab-marketing"
            >
              <Target className="w-4 h-4 inline mr-2" />
              マーケティング
            </motion.button>
          </div>
        </div>

        {/* Period Selector - ピンクグラデーション */}
        {activeTab === 'analytics' && (
          <div className="bg-white rounded-xl p-4 shadow-lg border border-pink-100">
            <div className="flex space-x-1">
              {['week', 'month', 'year'].map((period) => (
                <motion.button
                  key={period}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedPeriod(period)}
                  className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                    selectedPeriod === period
                      ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-md'
                      : 'bg-pink-50 text-gray-600 hover:bg-pink-100'
                  }`}
                  data-testid={`button-period-${period}`}
                >
                  {period === 'week' ? '週' : period === 'month' ? '月' : '年'}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Analytics Content */}
        {activeTab === 'analytics' && (
          <>
            {/* Analytics Sub-tabs - ピンクグラデーション */}
            <div className="bg-white rounded-xl p-1 shadow-lg border border-pink-100">
              <div className="flex space-x-1">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setAnalyticsTab('posts')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    analyticsTab === 'posts'
                      ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-md'
                      : 'bg-transparent text-gray-600 hover:bg-pink-50'
                  }`}
                  data-testid="subtab-posts"
                >
                  投稿分析
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setAnalyticsTab('plans')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    analyticsTab === 'plans'
                      ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-md'
                      : 'bg-transparent text-gray-600 hover:bg-pink-50'
                  }`}
                  data-testid="subtab-plans"
                >
                  プラン分析
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setAnalyticsTab('profile')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    analyticsTab === 'profile'
                      ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-md'
                      : 'bg-transparent text-gray-600 hover:bg-pink-50'
                  }`}
                  data-testid="subtab-profile"
                >
                  プロフィール分析
                </motion.button>
              </div>
            </div>

            {/* Stats Cards - ピンクグラデーション */}
            <div className="grid grid-cols-2 gap-3">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -5, scale: 1.02 }}
                className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl p-4 shadow-lg"
                data-testid="card-total-views"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <p className="text-xs text-pink-100 mb-1">総視聴回数</p>
                    <p className="text-xl font-bold text-white">{formatNumber(stats.totalViews)}</p>
                  </div>
                  <Eye className="w-6 h-6 text-white/80 flex-shrink-0" />
                </div>
                <div className="flex items-center">
                  <TrendingUp className="w-3 h-3 text-white/80 mr-1" />
                  <span className="text-xs text-white/80 font-medium">実績データ</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -5, scale: 1.02 }}
                transition={{ delay: 0.1 }}
                className="bg-gradient-to-br from-pink-400 to-pink-500 rounded-xl p-4 shadow-lg"
                data-testid="card-total-likes"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <p className="text-xs text-pink-100 mb-1">総いいね数</p>
                    <p className="text-xl font-bold text-white">{formatNumber(stats.totalLikes)}</p>
                  </div>
                  <Heart className="w-6 h-6 text-white/80 flex-shrink-0" />
                </div>
                <div className="flex items-center">
                  <TrendingUp className="w-3 h-3 text-white/80 mr-1" />
                  <span className="text-xs text-white/80 font-medium">実績データ</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -5, scale: 1.02 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-pink-600 to-pink-700 rounded-xl p-4 shadow-lg"
                data-testid="card-total-followers"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <p className="text-xs text-pink-100 mb-1">フォロワー数</p>
                    <p className="text-xl font-bold text-white">{formatNumber(stats.totalFollowers)}</p>
                  </div>
                  <Users className="w-6 h-6 text-white/80 flex-shrink-0" />
                </div>
                <div className="flex items-center">
                  <TrendingUp className="w-3 h-3 text-white/80 mr-1" />
                  <span className="text-xs text-white/80 font-medium">実績データ</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -5, scale: 1.02 }}
                transition={{ delay: 0.3 }}
                className="bg-gradient-to-br from-pink-500 to-pink-700 rounded-xl p-4 shadow-lg"
                data-testid="card-total-earnings"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <p className="text-xs text-pink-100 mb-1">総収益</p>
                    <p className="text-lg font-bold text-white">{formatCurrency(stats.totalEarnings)}</p>
                  </div>
                  <DollarSign className="w-6 h-6 text-white/80 flex-shrink-0" />
                </div>
                <div className="flex items-center">
                  <TrendingUp className="w-3 h-3 text-white/80 mr-1" />
                  <span className="text-xs text-white/80 font-medium">実績データ</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -5, scale: 1.02 }}
                transition={{ delay: 0.4 }}
                className="bg-gradient-to-br from-pink-400 to-pink-600 rounded-xl p-4 shadow-lg"
                data-testid="card-posts-count"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <p className="text-xs text-pink-100 mb-1">投稿数</p>
                    <p className="text-xl font-bold text-white">{stats.postsCount}</p>
                  </div>
                  <Video className="w-6 h-6 text-white/80 flex-shrink-0" />
                </div>
                <div className="flex items-center">
                  <TrendingUp className="w-3 h-3 text-white/80 mr-1" />
                  <span className="text-xs text-white/80 font-medium">実績データ</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -5, scale: 1.02 }}
                transition={{ delay: 0.5 }}
                className="bg-gradient-to-br from-pink-600 to-pink-800 rounded-xl p-4 shadow-lg"
                data-testid="card-engagement-rate"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <p className="text-xs text-pink-100 mb-1">エンゲージメント率</p>
                    <p className="text-xl font-bold text-white">{stats.engagementRate.toFixed(1)}%</p>
                  </div>
                  <BarChart3 className="w-6 h-6 text-white/80 flex-shrink-0" />
                </div>
                <div className="flex items-center">
                  <TrendingUp className="w-3 h-3 text-white/80 mr-1" />
                  <span className="text-xs text-white/80 font-medium">実績データ</span>
                </div>
              </motion.div>
            </div>

            {/* Analytics Chart - ピンクグラデーション */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white rounded-xl p-4 shadow-lg border border-pink-100"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold bg-gradient-to-r from-pink-600 to-pink-500 bg-clip-text text-transparent">週間パフォーマンス</h3>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                    <span className="text-xs text-gray-600">視聴回数</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-pink-400 rounded-full"></div>
                    <span className="text-xs text-gray-600">いいね数</span>
                  </div>
                </div>
              </div>
              
              <div className="h-48 flex items-end space-x-1">
                {analyticsData.map((data, index) => (
                  <motion.div 
                    key={index} 
                    className="flex-1 flex flex-col items-center space-y-1"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.05 }}
                  >
                    <div className="w-full flex flex-col items-center space-y-1">
                      {/* Views bar with value */}
                      <div className="w-full flex flex-col items-center">
                        <span className="text-[8px] font-semibold text-pink-600 mb-0.5">{formatNumber(data.views)}</span>
                        <div
                          className="bg-gradient-to-t from-pink-500 to-pink-400 rounded-t w-full transition-all duration-300 hover:from-pink-600 hover:to-pink-500"
                          style={{ height: `${Math.max((data.views / maxViews) * 100, 5)}px` }}
                          data-testid={`bar-views-${data.label}`}
                        ></div>
                      </div>
                      {/* Likes bar with value */}
                      <div className="w-full flex flex-col items-center">
                        <span className="text-[8px] font-semibold text-pink-400 mb-0.5">{formatNumber(data.likes)}</span>
                        <div
                          className="bg-gradient-to-t from-pink-400 to-pink-300 rounded-t w-full transition-all duration-300 hover:from-pink-500 hover:to-pink-400"
                          style={{ height: `${Math.max((data.likes / maxLikes) * 100, 5)}px` }}
                          data-testid={`bar-likes-${data.label}`}
                        ></div>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-gray-600 mt-1">{data.label}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Detailed Analytics Content - 投稿パフォーマンス */}
            {analyticsTab === 'posts' && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl p-4 shadow-lg border border-pink-100">
                  <h3 className="text-lg font-semibold bg-gradient-to-r from-pink-600 to-pink-500 bg-clip-text text-transparent mb-4">投稿パフォーマンス</h3>
                  <div className="space-y-3">
                    {postsData.map((post, index) => (
                      <motion.div
                        key={post.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ scale: 1.02, x: 5 }}
                        className="flex items-center space-x-3 p-3 border border-pink-100 rounded-lg bg-gradient-to-r from-white to-pink-50 hover:shadow-md transition-all"
                        data-testid={`post-item-${post.id}`}
                      >
                        <img
                          src={post.thumbnail}
                          alt={post.title}
                          className="w-16 h-16 rounded-lg object-cover border-2 border-pink-200"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">{post.title}</h4>
                          <div className="flex items-center space-x-4 mt-1">
                            <div className="flex items-center space-x-1">
                              <Eye className="w-4 h-4 text-pink-400" />
                              <span className="text-sm text-gray-600">{formatNumber(post.views)}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Heart className="w-4 h-4 text-pink-500" />
                              <span className="text-sm text-gray-600">{formatNumber(post.likes)}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <MessageCircle className="w-4 h-4 text-pink-400" />
                              <span className="text-sm text-gray-600">{post.comments}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-400">{post.publishDate}</span>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-pink-600 font-medium">
                                エンゲージメント率: {post.engagementRate}%
                              </span>
                              <span className="text-xs text-pink-700 font-medium">
                                収益: {formatCurrency(post.revenue)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {analyticsTab === 'plans' && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl p-4 shadow-lg border border-pink-100">
                  <h3 className="text-lg font-semibold bg-gradient-to-r from-pink-600 to-pink-500 bg-clip-text text-transparent mb-4">プラン分析</h3>
                  <div className="space-y-4">
                    {plansData.map((plan, index) => (
                      <motion.div
                        key={plan.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ scale: 1.02 }}
                        className="border-2 border-pink-200 rounded-lg p-4 bg-gradient-to-br from-white to-pink-50 hover:shadow-lg transition-all"
                        data-testid={`plan-item-${plan.id}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-gray-900">{plan.name}</h4>
                          <span className="text-lg font-bold bg-gradient-to-r from-pink-600 to-pink-500 bg-clip-text text-transparent">{formatCurrency(plan.price)}/月</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                            <p className="text-xs text-gray-500">購読者数</p>
                            <p className="text-sm font-semibold text-pink-600">{plan.subscribers}人</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">月間収益</p>
                            <p className="text-sm font-semibold text-pink-700">{formatCurrency(plan.revenue)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">コンバージョン率</p>
                            <p className="text-sm font-semibold text-pink-600">{plan.conversionRate}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">チャーン率</p>
                            <p className="text-sm font-semibold text-pink-500">{plan.churnRate}%</p>
                          </div>
                        </div>
                        <div className="text-xs text-pink-600 font-medium">
                          平均利用期間: {plan.avgLifetime}ヶ月
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {analyticsTab === 'profile' && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl p-4 shadow-lg border border-pink-100">
                  <h3 className="text-lg font-semibold bg-gradient-to-r from-pink-600 to-pink-500 bg-clip-text text-transparent mb-4">プロフィール分析</h3>
                  
                  {/* フォロワー統計 */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      className="text-center bg-gradient-to-br from-pink-50 to-white p-4 rounded-lg border border-pink-100"
                    >
                      <p className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-pink-500 bg-clip-text text-transparent">{formatNumber(profileData.totalFollowers)}</p>
                      <p className="text-sm text-gray-500">総フォロワー数</p>
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      className="text-center bg-gradient-to-br from-pink-50 to-white p-4 rounded-lg border border-pink-100"
                    >
                      <p className="text-2xl font-bold text-pink-600">+{profileData.newFollowers}</p>
                      <p className="text-sm text-gray-500">新規フォロワー</p>
                    </motion.div>
                  </div>

                  {/* デモグラフィック */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-pink-700 mb-2">年齢分布</h4>
                      <div className="space-y-2">
                        {profileData.demographics && profileData.demographics.age && Object.entries(profileData.demographics.age).map(([age, percentage]) => (
                          <div key={age} className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">{age}歳</span>
                            <div className="flex items-center space-x-2">
                              <div className="w-20 bg-pink-100 rounded-full h-2">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.max(percentage || 0, 0)}%` }}
                                  className="bg-gradient-to-r from-pink-500 to-pink-600 h-2 rounded-full"
                                ></motion.div>
                              </div>
                              <span className="text-sm font-medium text-pink-700">{percentage || 0}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-pink-700 mb-2">性別分布</h4>
                      <div className="flex space-x-4">
                        <div className="text-center flex-1 bg-gradient-to-br from-pink-50 to-white p-3 rounded-lg border border-pink-100">
                          <p className="text-lg font-bold text-pink-600">{profileData.demographics?.gender?.female || 0}%</p>
                          <p className="text-xs text-gray-500">女性</p>
                        </div>
                        <div className="text-center flex-1 bg-gradient-to-br from-pink-50 to-white p-3 rounded-lg border border-pink-100">
                          <p className="text-lg font-bold text-pink-500">{profileData.demographics?.gender?.male || 0}%</p>
                          <p className="text-xs text-gray-500">男性</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-pink-700 mb-2">エンゲージメント</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gradient-to-br from-pink-50 to-white p-3 rounded-lg border border-pink-100">
                          <p className="text-xs text-gray-500">平均いいね数</p>
                          <p className="text-sm font-semibold text-pink-600">{profileData.engagement?.avgLikes || 0}</p>
                        </div>
                        <div className="bg-gradient-to-br from-pink-50 to-white p-3 rounded-lg border border-pink-100">
                          <p className="text-xs text-gray-500">平均コメント数</p>
                          <p className="text-sm font-semibold text-pink-600">{profileData.engagement?.avgComments || 0}</p>
                        </div>
                        <div className="bg-gradient-to-br from-pink-50 to-white p-3 rounded-lg border border-pink-100">
                          <p className="text-xs text-gray-500">平均シェア数</p>
                          <p className="text-sm font-semibold text-pink-600">{profileData.engagement?.avgShares || 0}</p>
                        </div>
                        <div className="bg-gradient-to-br from-pink-50 to-white p-3 rounded-lg border border-pink-100">
                          <p className="text-xs text-gray-500">平均返信時間</p>
                          <p className="text-sm font-semibold text-pink-600">{profileData.engagement?.responseTime || 0}時間</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Marketing Content - ピンクグラデーション */}
        {activeTab === 'marketing' && (
          <div className="space-y-4">
            {/* Marketing Header */}
            <div className="bg-white rounded-xl p-4 shadow-lg border border-pink-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold bg-gradient-to-r from-pink-600 to-pink-500 bg-clip-text text-transparent">マーケティングキャンペーン</h3>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCreateCampaign}
                  className="bg-gradient-to-r from-pink-500 to-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 hover:shadow-lg transition-all"
                  data-testid="button-create-campaign"
                >
                  <Plus className="w-4 h-4" />
                  <span>新規作成</span>
                </motion.button>
              </div>
              
              {/* Marketing Stats */}
              <div className="grid grid-cols-2 gap-4">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="text-center bg-gradient-to-br from-pink-50 to-white p-4 rounded-lg border border-pink-100"
                >
                  <p className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-pink-500 bg-clip-text text-transparent">{marketingCampaigns.length}</p>
                  <p className="text-sm text-gray-500">総キャンペーン数</p>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="text-center bg-gradient-to-br from-pink-50 to-white p-4 rounded-lg border border-pink-100"
                >
                  <p className="text-2xl font-bold text-pink-600">
                    {marketingCampaigns.filter(c => c.status === 'active').length}
                  </p>
                  <p className="text-sm text-gray-500">実行中</p>
                </motion.div>
              </div>
            </div>

            {/* Marketing Methods */}
            <div className="bg-white rounded-xl p-4 shadow-lg border border-pink-100">
              <h3 className="text-lg font-semibold bg-gradient-to-r from-pink-600 to-pink-500 bg-clip-text text-transparent mb-4">マーケティング方法</h3>
              <div className="space-y-4">
                {marketingMethods.map((method, index) => (
                  <motion.div
                    key={method.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.02 }}
                    className="border-2 border-pink-200 rounded-lg p-4 bg-gradient-to-r from-white to-pink-50 hover:shadow-lg transition-all"
                    data-testid={`method-item-${method.id}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">{method.name}</h4>
                        <p className="text-sm text-gray-500">{method.platform}</p>
                        <p className="text-xs text-gray-600 mt-1">{method.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold bg-gradient-to-r from-pink-600 to-pink-500 bg-clip-text text-transparent">ROI: {method.roi}%</p>
                        <p className="text-xs text-gray-500">投資対効果</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-gray-500">コスト</p>
                        <p className="text-sm font-semibold text-pink-600">{formatCurrency(method.cost)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">リーチ</p>
                        <p className="text-sm font-semibold text-pink-600">{formatNumber(method.reach)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">エンゲージメント</p>
                        <p className="text-sm font-semibold text-pink-600">{formatNumber(method.engagement)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">コンバージョン</p>
                        <p className="text-sm font-semibold text-pink-600">{method.conversion}人</p>
                      </div>
                    </div>

                    <div>
                      <h5 className="text-sm font-medium text-pink-700 mb-2">ベストプラクティス</h5>
                      <div className="flex flex-wrap gap-1">
                        {(method.bestPractices || []).map((practice, practiceIndex) => (
                          <span
                            key={practiceIndex}
                            className="px-2 py-1 bg-gradient-to-r from-pink-100 to-pink-200 text-pink-800 text-xs rounded-full"
                          >
                            {practice}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Campaign List - ピンクグラデーション */}
            <div className="space-y-3">
              {marketingCampaigns.map((campaign, index) => (
                <motion.div
                  key={campaign.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.01 }}
                  className="bg-gradient-to-r from-white to-pink-50 rounded-xl p-4 shadow-lg border-2 border-pink-100"
                  data-testid={`campaign-item-${campaign.id}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">{campaign.name}</h4>
                      <div className="flex items-center space-x-2 mb-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(campaign.status)}`}>
                          {getStatusText(campaign.status)}
                        </span>
                        <span className="text-xs text-gray-500">{campaign.platform}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleEditCampaign(campaign)}
                        className="p-2 hover:bg-pink-100 rounded-lg transition-colors"
                        data-testid={`button-edit-campaign-${campaign.id}`}
                      >
                        <Edit3 className="w-4 h-4 text-pink-600" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDeleteCampaign(campaign.id)}
                        className="p-2 hover:bg-pink-100 rounded-lg transition-colors"
                        data-testid={`button-delete-campaign-${campaign.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-pink-600" />
                      </motion.button>
                    </div>
                  </div>

                  {/* Campaign Metrics */}
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-gray-500">予算</p>
                      <p className="text-sm font-semibold text-pink-600">{formatCurrency(campaign.budget)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">使用済み</p>
                      <p className="text-sm font-semibold text-pink-700">{formatCurrency(campaign.spent)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">リーチ</p>
                      <p className="text-sm font-semibold text-pink-600">{formatNumber(campaign.reach)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">エンゲージメント</p>
                      <p className="text-sm font-semibold text-pink-600">{formatNumber(campaign.engagement)}</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>進捗</span>
                      <span className="text-pink-600 font-medium">{Math.round((campaign.spent / campaign.budget) * 100)}%</span>
                    </div>
                    <div className="w-full bg-pink-100 rounded-full h-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((campaign.spent / campaign.budget) * 100, 100)}%` }}
                        className="bg-gradient-to-r from-pink-500 to-pink-600 h-2 rounded-full transition-all duration-300"
                      ></motion.div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      {campaign.startDate} - {campaign.endDate}
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleToggleCampaign(campaign.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                        campaign.status === 'active'
                          ? 'bg-gradient-to-r from-pink-100 to-pink-200 text-pink-800 hover:shadow-md'
                          : 'bg-gradient-to-r from-pink-500 to-pink-600 text-white hover:shadow-md'
                      }`}
                      data-testid={`button-toggle-campaign-${campaign.id}`}
                    >
                      {campaign.status === 'active' ? '一時停止' : '開始'}
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNavigationWithCreator active="account" />
    </div>
  );
};

export default CreatorDashboard;
