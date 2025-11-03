import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Download, 
  Eye,
  Calendar,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Search,
  Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import BottomNavigationWithCreator from '../BottomNavigationWithCreator';

const PurchaseHistoryPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    // Firestoreから購入履歴を取得（orderByを削除してクライアント側でソート）
    const purchasesQuery = query(
      collection(db, 'purchases'),
      where('userId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(purchasesQuery, (snapshot) => {
      const purchasesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate?.() || new Date()
      })).sort((a, b) => b.date - a.date); // クライアント側でソート
      setPurchases(purchasesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, navigate]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', minimumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (dateString) => {
    const date = dateString instanceof Date ? dateString : new Date(dateString);
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'cancelled': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'pending': return <Clock className="w-5 h-5 text-yellow-500" />;
      default: return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return '完了';
      case 'cancelled': return 'キャンセル済み';
      case 'pending': return '処理中';
      default: return '不明';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-700 bg-gradient-to-r from-green-100 to-green-200 border-green-300';
      case 'cancelled': return 'text-red-700 bg-gradient-to-r from-red-100 to-red-200 border-red-300';
      case 'pending': return 'text-yellow-700 bg-gradient-to-r from-yellow-100 to-yellow-200 border-yellow-300';
      default: return 'text-gray-700 bg-gradient-to-r from-gray-100 to-gray-200 border-gray-300';
    }
  };

  const filteredPurchases = purchases.filter(purchase => {
    const matchesFilter = filter === 'all' || purchase.type === filter;
    const matchesSearch = purchase.title?.toLowerCase().includes(searchQuery.toLowerCase()) || purchase.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const totalSpent = purchases.filter(p => p.status === 'completed').reduce((sum, p) => sum + (p.amount || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 pb-20 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 pb-20">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="sticky top-0 bg-gradient-to-r from-pink-500 to-pink-600 border-b border-pink-300 p-6 flex items-center z-10 shadow-lg">
        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="text-white mr-4 p-2 hover:bg-white/20 rounded-full" data-testid="button-back">
          <ArrowLeft size={24} />
        </motion.button>
        <div className="flex items-center">
          <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 3, repeat: Infinity }}>
            <Calendar className="w-7 h-7 text-white mr-3" />
          </motion.div>
          <h1 className="text-2xl font-bold text-white">購入履歴</h1>
        </div>
      </motion.div>

      <div className="p-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-pink-100 to-purple-100 rounded-2xl p-6 border-2 border-pink-200 shadow-xl relative overflow-hidden">
          <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute -top-10 -right-10 w-32 h-32 bg-white/30 rounded-full blur-2xl" />
          <h2 className="text-xl font-bold text-pink-900 mb-4 relative z-10">購入統計</h2>
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-3xl font-bold text-pink-900" data-testid="text-total-spent">{formatCurrency(totalSpent)}</p>
              <p className="text-pink-700 font-medium">総購入額</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-pink-900" data-testid="text-purchase-count">{purchases.filter(p => p.status === 'completed').length}</p>
              <p className="text-pink-700 font-medium">購入回数</p>
            </div>
          </div>
        </motion.div>

        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-4 shadow-lg border-2 border-pink-100">
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-pink-400 w-5 h-5" />
              <input type="text" placeholder="購入を検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-3 border-2 border-pink-100 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent font-semibold" data-testid="input-search" />
            </div>
            <div className="flex space-x-2">
              {[{ id: 'all', label: 'すべて' }, { id: 'subscription', label: 'サブスク' }, { id: 'one-time', label: '単品' }].map((option) => (
                <motion.button key={option.id} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setFilter(option.id)} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${filter === option.id ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-md' : 'bg-gray-100 text-gray-600'}`} data-testid={`button-filter-${option.id}`}>
                  {option.label}
                </motion.button>
              ))}
            </div>
          </motion.div>

          {filteredPurchases.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-8 text-center shadow-lg border-2 border-pink-100">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">購入履歴がありません</p>
            </motion.div>
          ) : (
            filteredPurchases.map((purchase, index) => (
              <motion.div key={purchase.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }} whileHover={{ scale: 1.02, y: -2 }} className="bg-white border-2 border-pink-100 rounded-2xl p-5 shadow-lg">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="font-bold text-lg text-gray-900" data-testid={`text-purchase-title-${purchase.id}`}>{purchase.title || '商品'}</h3>
                      <span className={`px-3 py-1 text-xs font-bold rounded-full border ${getStatusColor(purchase.status)}`} data-testid={`text-status-${purchase.id}`}>{getStatusText(purchase.status)}</span>
                    </div>
                    <p className="text-sm text-gray-600 font-medium mb-2">{purchase.description || ''}</p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span className="flex items-center" data-testid={`text-date-${purchase.id}`}><Calendar className="w-4 h-4 mr-1" />{formatDate(purchase.date)}</span>
                      <span className="flex items-center"><CreditCard className="w-4 h-4 mr-1" />{purchase.paymentMethod || 'カード'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent" data-testid={`text-amount-${purchase.id}`}>{formatCurrency(purchase.amount || 0)}</p>
                    {purchase.nextBilling && (
                      <p className="text-xs text-gray-500 mt-1">次回: {formatDate(purchase.nextBilling)}</p>
                    )}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex-1 bg-gradient-to-r from-pink-100 to-purple-100 text-pink-700 py-2 rounded-xl font-bold text-sm hover:shadow-md transition-all flex items-center justify-center space-x-1" data-testid={`button-view-${purchase.id}`}>
                    <Eye className="w-4 h-4" />
                    <span>詳細</span>
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex-1 bg-blue-100 text-blue-700 py-2 rounded-xl font-bold text-sm hover:bg-blue-200 transition-all flex items-center justify-center space-x-1">
                    <Download className="w-4 h-4" />
                    <span>領収書</span>
                  </motion.button>
                </div>
              </motion.div>
            ))
          )}
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-gradient-to-br from-pink-100 to-purple-100 border-2 border-pink-200 rounded-2xl p-6">
          <div className="flex items-start space-x-4">
            <Sparkles className="w-6 h-6 text-pink-600 mt-1" />
            <div>
              <h4 className="font-bold text-pink-900 mb-2 text-lg">購入履歴について</h4>
              <ul className="text-base text-pink-800 space-y-2">
                <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2" />すべての取引は安全に記録されています</li>
                <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2" />領収書はいつでもダウンロード可能です</li>
                <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2" />過去の購入を検索できます</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>

      <BottomNavigationWithCreator active="account" />
    </div>
  );
};

export default PurchaseHistoryPage;
