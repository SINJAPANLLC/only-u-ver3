import React, { useEffect, useState } from "react";
import { motion } from 'framer-motion';
import { 
  Crown,
  Search, 
  Ban, 
  UserCheck, 
  Shield,
  Clock,
  CheckCircle,
  Eye,
  RefreshCw,
  Download,
  XCircle,
  Users,
  DollarSign,
  FileText
} from 'lucide-react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
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

export default function Creators() {
  const { toast } = useToast();
  const [creators, setCreators] = useState([]);
  const [filteredCreators, setFilteredCreators] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterVerification, setFilterVerification] = useState('all');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [stats, setStats] = useState({
    total: 0,
    verified: 0,
    pending: 0,
    banned: 0,
    active: 0
  });

  const statusOptions = [
    { value: 'all', label: 'すべて' },
    { value: 'active', label: 'アクティブ' },
    { value: 'banned', label: 'BAN済み' },
    { value: 'pending', label: '承認待ち' },
    { value: 'suspended', label: '一時停止' }
  ];

  const verificationOptions = [
    { value: 'all', label: 'すべて' },
    { value: 'verified', label: '認証済み' },
    { value: 'pending', label: '認証待ち' },
    { value: 'rejected', label: '認証拒否' }
  ];

  useEffect(() => {
    loadCreators();
  }, []);

  const loadCreators = async () => {
    try {
      setLoading(true);
      // Firestore から isCreator === true のユーザーを取得
      const q = query(
        collection(db, 'users'),
        where('isCreator', '==', true),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const creatorsData = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().displayName || 'Unknown',
        email: doc.data().email || '',
        status: doc.data().creatorStatus || 'active',
        verification: doc.data().kycStatus || 'pending',
        joinDate: doc.data().createdAt?.toDate?.()?.toISOString?.().split('T')[0] || '',
        lastLogin: doc.data().lastLoginAt?.toDate?.()?.toISOString?.().split('T')[0] || '',
        posts: 0, // TODO: posts collection から取得
        followers: 0, // TODO: followers collection から取得
        revenue: doc.data().totalEarnings || 0,
        rating: 0, // TODO: ratings collection から取得
        category: doc.data().category || '未設定'
      }));
      
      setCreators(creatorsData);
      setFilteredCreators(creatorsData);
      
      setStats({
        total: creatorsData.length,
        verified: creatorsData.filter(c => c.verification === 'verified').length,
        pending: creatorsData.filter(c => c.status === 'pending').length,
        banned: creatorsData.filter(c => c.status === 'banned').length,
        active: creatorsData.filter(c => c.status === 'active').length
      });
    } catch (error) {
      console.error('Error loading creators:', error);
      toast({
        title: 'エラー',
        description: 'クリエイターデータの取得に失敗しました',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = [...creators];

    if (searchTerm) {
      filtered = filtered.filter(creator =>
        creator.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        creator.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        creator.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(creator => creator.status === filterStatus);
    }

    if (filterVerification !== 'all') {
      filtered = filtered.filter(creator => creator.verification === filterVerification);
    }

    setFilteredCreators(filtered);
  }, [creators, searchTerm, filterStatus, filterVerification]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      loadCreators();
      setIsRefreshing(false);
    }, 1000);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'banned': return 'text-red-600 bg-red-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'suspended': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getVerificationColor = (verification) => {
    switch (verification) {
      case 'verified': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'rejected': return 'text-red-600 bg-red-100';
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

  if (loading) {
    return <AdminLoadingState message="クリエイターデータを読み込み中..." />;
  }

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="クリエイター管理"
        description="クリエイターアカウントの管理、認証、ステータス確認を行います"
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <AdminStatsCard
          title="総クリエイター数"
          value={<AnimatedNumber value={stats.total} />}
          icon={Users}
          color="blue"
        />
        <AdminStatsCard
          title="認証済み"
          value={<AnimatedNumber value={stats.verified} />}
          icon={CheckCircle}
          color="green"
        />
        <AdminStatsCard
          title="承認待ち"
          value={<AnimatedNumber value={stats.pending} />}
          icon={Clock}
          color="orange"
        />
        <AdminStatsCard
          title="アクティブ"
          value={<AnimatedNumber value={stats.active} />}
          icon={UserCheck}
          color="purple"
        />
        <AdminStatsCard
          title="BAN済み"
          value={<AnimatedNumber value={stats.banned} />}
          icon={Ban}
          color="pink"
        />
      </div>

      <AdminContentCard title="検索・フィルター">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="クリエイターを検索..."
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
              value={filterVerification}
              onChange={(e) => setFilterVerification(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              data-testid="select-verification"
            >
              {verificationOptions.map(verification => (
                <option key={verification.value} value={verification.value}>
                  {verification.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </AdminContentCard>

      <AdminTableContainer>
        {filteredCreators.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  クリエイター
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ステータス
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  認証状態
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  統計
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  売上
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
              {filteredCreators.map((creator, index) => (
                <motion.tr 
                  key={creator.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className="hover:bg-pink-50 transition-colors"
                  data-testid={`row-creator-${creator.id}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center text-white font-semibold ring-2 ring-pink-100">
                          {creator.name.charAt(0)}
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-semibold text-gray-900">
                          {creator.name}
                        </div>
                        <div className="text-sm text-gray-500">{creator.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(creator.status)}`}>
                      {statusOptions.find(s => s.value === creator.status)?.label || creator.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getVerificationColor(creator.verification)}`}>
                      {verificationOptions.find(v => v.value === creator.verification)?.label || creator.verification}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      <div className="flex items-center space-x-3 text-xs">
                        <span className="flex items-center text-gray-600">
                          <FileText className="w-3 h-3 mr-1" />
                          <span className="font-semibold text-gray-900">{creator.posts}</span>
                        </span>
                        <span className="flex items-center text-gray-600">
                          <Users className="w-3 h-3 mr-1" />
                          <span className="font-semibold text-gray-900">{creator.followers}</span>
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm font-semibold text-gray-900">
                      <DollarSign className="w-4 h-4 text-green-600" />
                      {creator.revenue.toLocaleString()}円
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(creator.joinDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      className="text-pink-600 hover:text-pink-900 flex items-center space-x-1"
                      data-testid={`button-view-${creator.id}`}
                    >
                      <Eye className="w-4 h-4" />
                      <span>詳細</span>
                    </motion.button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        ) : (
          <AdminEmptyState
            icon={Crown}
            title="クリエイターが見つかりません"
            description="検索条件を変更してください"
          />
        )}
      </AdminTableContainer>
    </AdminPageContainer>
  );
}
