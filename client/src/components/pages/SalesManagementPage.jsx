import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp, DollarSign, Users, Calendar, Download, Filter, Eye, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import BottomNavigationWithCreator from '../BottomNavigationWithCreator';

const SalesManagementPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [selectedView, setSelectedView] = useState('overview');
  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(true);

  const periods = [
    { id: 'week', name: '週間' },
    { id: 'month', name: '月間' },
    { id: 'year', name: '年間' }
  ];

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    // クリエイターの売上データを取得（tipsコレクションから）
    const tipsQuery = query(
      collection(db, 'tips'),
      where('creatorId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(tipsQuery, (snapshot) => {
      const salesList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          date: data.createdAt?.toDate?.() || new Date(),
          plan: 'チップ',
          subscribers: 1,
          revenue: data.creatorAmount || data.amount || 0, // creatorAmount（手数料控除後）を使用
          type: '新規'
        };
      });
      setSalesData(salesList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, selectedPeriod]);

  const totalRevenue = salesData.reduce((sum, item) => sum + item.revenue, 0);
  const totalSubscribers = salesData.reduce((sum, item) => sum + item.subscribers, 0);
  const newSubscribers = salesData.filter(item => item.type === '新規').reduce((sum, item) => sum + item.subscribers, 0);

  const formatCurrency = (amount) => new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', minimumFractionDigits: 0 }).format(amount);
  const formatDate = (dateString) => new Date(dateString).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 pb-20">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="sticky top-0 bg-gradient-to-r from-pink-500 to-pink-600 border-b border-pink-300 p-6 flex items-center justify-between z-10 shadow-lg">
        <div className="flex items-center">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="text-white mr-4 p-2 hover:bg-white/20 rounded-full" data-testid="button-back">
            <ArrowLeft size={24} />
          </motion.button>
          <div className="flex items-center">
            <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }}>
              <TrendingUp className="w-7 h-7 text-white mr-3" />
            </motion.div>
            <h1 className="text-2xl font-bold text-white">売上管理</h1>
          </div>
        </div>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="bg-white text-pink-600 px-4 py-2 rounded-xl font-bold flex items-center space-x-1 shadow-lg" data-testid="button-export">
          <Download className="w-4 h-4" />
          <span>CSV出力</span>
        </motion.button>
      </motion.div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-pink-100 to-purple-100 rounded-2xl p-5 shadow-xl border-2 border-pink-200 relative overflow-hidden">
            <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute -top-10 -right-10 w-32 h-32 bg-white/30 rounded-full blur-2xl" />
            <div className="relative z-10">
              <p className="text-sm text-pink-700 font-semibold mb-1">総売上</p>
              <p className="text-2xl font-bold text-pink-900" data-testid="text-total-revenue">{formatCurrency(totalRevenue)}</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl p-5 shadow-xl border-2 border-blue-200 relative overflow-hidden">
            <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 20, repeat: Infinity, ease: "linear", delay: 2 }} className="absolute -top-10 -right-10 w-32 h-32 bg-white/30 rounded-full blur-2xl" />
            <div className="relative z-10">
              <p className="text-sm text-blue-700 font-semibold mb-1">総加入者</p>
              <p className="text-2xl font-bold text-blue-900" data-testid="text-total-subscribers">{totalSubscribers}人</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-gradient-to-br from-green-100 to-green-200 rounded-2xl p-5 shadow-xl border-2 border-green-300 relative overflow-hidden">
            <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 20, repeat: Infinity, ease: "linear", delay: 4 }} className="absolute -top-10 -right-10 w-32 h-32 bg-white/30 rounded-full blur-2xl" />
            <div className="relative z-10">
              <p className="text-sm text-green-700 font-semibold mb-1">新規加入</p>
              <p className="text-2xl font-bold text-green-900" data-testid="text-new-subscribers">{newSubscribers}人</p>
            </div>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white rounded-2xl p-5 shadow-xl border-2 border-pink-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900 flex items-center">
              <Sparkles className="w-5 h-5 mr-2 text-pink-500" />
              期間選択
            </h3>
          </div>
          <div className="flex space-x-2">
            {periods.map((period) => (
              <motion.button key={period.id} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setSelectedPeriod(period.id)} className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold transition-all shadow-md ${selectedPeriod === period.id ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white' : 'bg-gray-100 text-gray-700'}`} data-testid={`button-period-${period.id}`}>
                {period.name}
              </motion.button>
            ))}
          </div>
        </motion.div>

        <div className="space-y-3">
          <h3 className="text-xl font-bold text-gray-900">売上明細</h3>
          {salesData.map((sale, index) => (
            <motion.div key={index} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + index * 0.05 }} whileHover={{ scale: 1.02, y: -2 }} className="bg-white rounded-2xl p-5 shadow-lg border-2 border-pink-100">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h4 className="font-bold text-gray-900 text-lg" data-testid={`text-plan-${index}`}>{sale.plan}</h4>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${sale.type === '新規' ? 'bg-gradient-to-r from-green-100 to-green-200 text-green-800 border border-green-300' : 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 border border-blue-300'}`} data-testid={`text-type-${index}`}>{sale.type}</span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span className="flex items-center" data-testid={`text-date-${index}`}><Calendar className="w-4 h-4 mr-1" />{formatDate(sale.date)}</span>
                    <span className="flex items-center" data-testid={`text-subscribers-${index}`}><Users className="w-4 h-4 mr-1" />{sale.subscribers}人</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent" data-testid={`text-revenue-${index}`}>{formatCurrency(sale.revenue)}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="bg-gradient-to-br from-pink-100 to-purple-100 border-2 border-pink-200 rounded-2xl p-6">
          <div className="flex items-start space-x-4">
            <Sparkles className="w-6 h-6 text-pink-600 mt-1" />
            <div>
              <h4 className="font-bold text-pink-900 mb-2 text-lg">売上管理について</h4>
              <ul className="text-base text-pink-800 space-y-2">
                <li>• すべての売上データはリアルタイムで更新されます</li>
                <li>• CSV形式で売上データをエクスポートできます</li>
                <li>• 過去の売上推移を期間別に確認できます</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>

      <BottomNavigationWithCreator active="account" />
    </div>
  );
};

export default SalesManagementPage;
