import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Target, 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  Users,
  DollarSign,
  Eye,
  Heart,
  Download,
  RefreshCw,
  Plus,
  Edit3,
  Trash2,
  Search,
  ArrowUp,
  ArrowDown,
  Minus,
  CheckCircle,
  AlertTriangle,
  Award
} from 'lucide-react';
import { 
  AdminPageContainer, 
  AdminPageHeader, 
  AdminStatsCard, 
  AdminContentCard, 
  AdminLoadingState 
} from './AdminPageContainer';

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

  return <span>{displayValue}</span>;
};

const KPIDashboard = () => {
  const [kpis, setKpis] = useState([]);
  const [filteredKpis, setFilteredKpis] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalKpis: 0,
    achieved: 0,
    onTrack: 0,
    atRisk: 0,
    avgProgress: 0
  });

  const categoryOptions = [
    { value: 'all', label: 'すべて' },
    { value: 'revenue', label: '収益' },
    { value: 'users', label: 'ユーザー' },
    { value: 'engagement', label: 'エンゲージメント' },
    { value: 'conversion', label: 'コンバージョン' }
  ];

  useEffect(() => {
    loadKPIs();
  }, []);

  useEffect(() => {
    let filtered = [...kpis];

    if (searchTerm) {
      filtered = filtered.filter(kpi =>
        kpi.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        kpi.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterCategory !== 'all') {
      filtered = filtered.filter(kpi => kpi.category === filterCategory);
    }

    setFilteredKpis(filtered);
  }, [kpis, searchTerm, filterCategory]);

  useEffect(() => {
    const totalKpis = kpis.length;
    const achieved = kpis.filter(k => k.progress >= 100).length;
    const onTrack = kpis.filter(k => k.progress >= 70 && k.progress < 100).length;
    const atRisk = kpis.filter(k => k.progress < 70).length;
    const avgProgress = kpis.length > 0 ? kpis.reduce((sum, k) => sum + k.progress, 0) / kpis.length : 0;

    setStats({ totalKpis, achieved, onTrack, atRisk, avgProgress });
  }, [kpis]);

  const loadKPIs = () => {
    // TODO: Firestore から KPI データを取得
    setKpis([]);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'achieved': return 'bg-green-100 text-green-700';
      case 'on_track': return 'bg-blue-100 text-blue-700';
      case 'at_risk': return 'bg-yellow-100 text-yellow-700';
      case 'behind': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'up': return <ArrowUp className="w-4 h-4 text-green-500" />;
      case 'down': return <ArrowDown className="w-4 h-4 text-red-500" />;
      default: return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'revenue': return <DollarSign className="w-5 h-5 text-green-500" />;
      case 'users': return <Users className="w-5 h-5 text-blue-500" />;
      case 'engagement': return <Heart className="w-5 h-5 text-pink-500" />;
      case 'conversion': return <Target className="w-5 h-5 text-purple-500" />;
      default: return <BarChart3 className="w-5 h-5 text-gray-500" />;
    }
  };

  if (loading) {
    return <AdminLoadingState message="KPIデータを読み込み中..." />;
  }

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="KPIダッシュボード"
        description="主要業績評価指標の管理とトラッキング"
        icon={Target}
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
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
              data-testid="button-export"
            >
              <Download className="w-4 h-4" />
              <span className="font-medium">エクスポート</span>
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-pink-600 rounded-xl text-white hover:from-pink-600 hover:to-pink-700 transition-all shadow-md hover:shadow-lg"
              data-testid="button-new-kpi"
            >
              <Plus className="w-4 h-4" />
              <span className="font-medium">新規KPI</span>
            </motion.button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <AdminStatsCard
          title="総KPI数"
          value={<AnimatedNumber value={stats.totalKpis} />}
          icon={Target}
          color="blue"
        />
        <AdminStatsCard
          title="達成済み"
          value={<AnimatedNumber value={stats.achieved} />}
          icon={CheckCircle}
          color="green"
        />
        <AdminStatsCard
          title="順調"
          value={<AnimatedNumber value={stats.onTrack} />}
          icon={TrendingUp}
          color="blue"
        />
        <AdminStatsCard
          title="要注意"
          value={<AnimatedNumber value={stats.atRisk} />}
          icon={AlertTriangle}
          color="yellow"
        />
        <AdminStatsCard
          title="平均進捗率"
          value={`${stats.avgProgress.toFixed(1)}%`}
          icon={Award}
          color="pink"
        />
      </div>

      <AdminContentCard title="検索とフィルター">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="KPIを検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
              data-testid="input-search"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
            data-testid="select-category"
          >
            {categoryOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </AdminContentCard>

      <div className="space-y-4">
        {filteredKpis.map((kpi, index) => (
          <motion.div
            key={kpi.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <AdminContentCard>
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      {getCategoryIcon(kpi.category)}
                      <h3 className="text-lg font-semibold text-gray-900">{kpi.name}</h3>
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(kpi.status)}`}>
                        {kpi.status === 'on_track' ? '順調' : kpi.status === 'achieved' ? '達成' : '要注意'}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-3">{kpi.description}</p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>担当者: {kpi.owner}</span>
                      <span>•</span>
                      <span>カテゴリ: {categoryOptions.find(c => c.value === kpi.category)?.label}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      data-testid={`button-view-${kpi.id}`}
                    >
                      <Eye className="w-5 h-5" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      data-testid={`button-edit-${kpi.id}`}
                    >
                      <Edit3 className="w-5 h-5" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      data-testid={`button-delete-${kpi.id}`}
                    >
                      <Trash2 className="w-5 h-5" />
                    </motion.button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                    <p className="text-sm text-gray-600 mb-1">現在値</p>
                    <p className="text-2xl font-bold text-gray-900">{kpi.currentValue.toLocaleString()} {kpi.unit}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl">
                    <p className="text-sm text-gray-600 mb-1">目標値</p>
                    <p className="text-2xl font-bold text-gray-900">{kpi.targetValue.toLocaleString()} {kpi.unit}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl">
                    <p className="text-sm text-gray-600 mb-1">達成率</p>
                    <div className="flex items-center space-x-2">
                      {getTrendIcon(kpi.trend)}
                      <p className="text-2xl font-bold text-gray-900">{kpi.progress.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">進捗</span>
                    <span className="font-medium text-gray-900">{kpi.progress.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${kpi.progress}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-full rounded-full ${
                        kpi.progress >= 100 ? 'bg-gradient-to-r from-green-500 to-green-600' :
                        kpi.progress >= 70 ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
                        'bg-gradient-to-r from-yellow-500 to-yellow-600'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </AdminContentCard>
          </motion.div>
        ))}
      </div>
    </AdminPageContainer>
  );
};

export default KPIDashboard;
