import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Building, CreditCard, CheckCircle, AlertCircle, Shield, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import BottomNavigationWithCreator from '../BottomNavigationWithCreator';

const BankAccountRegistrationPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState({
    bankName: '',
    branchName: '',
    accountType: 'normal',
    accountNumber: '',
    accountHolder: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [existingAccountId, setExistingAccountId] = useState(null);
  const [loading, setLoading] = useState(true);

  const accountTypes = [
    { id: 'normal', name: '普通' },
    { id: 'checking', name: '当座' },
    { id: 'savings', name: '貯蓄' }
  ];

  // 既存の口座情報を取得
  useEffect(() => {
    const fetchBankAccount = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        const q = query(
          collection(db, 'bankAccounts'),
          where('userId', '==', currentUser.uid)
        );
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const accountData = querySnapshot.docs[0].data();
          setExistingAccountId(querySnapshot.docs[0].id);
          setFormData({
            bankName: accountData.bankName || '',
            branchName: accountData.branchName || '',
            accountType: accountData.accountType || 'normal',
            accountNumber: accountData.accountNumber || '',
            accountHolder: accountData.accountHolder || ''
          });
        }
      } catch (error) {
        console.error('口座情報の取得エラー:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBankAccount();
  }, [currentUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
      alert('ログインが必要です');
      return;
    }

    setIsSubmitting(true);

    try {
      const accountData = {
        userId: currentUser.uid,
        userName: currentUser.displayName || 'Unknown User',
        bankName: formData.bankName,
        branchName: formData.branchName,
        accountType: formData.accountType,
        accountNumber: formData.accountNumber,
        accountHolder: formData.accountHolder,
        status: 'active',
        updatedAt: new Date()
      };

      if (existingAccountId) {
        // 既存データを更新
        await updateDoc(doc(db, 'bankAccounts', existingAccountId), accountData);
      } else {
        // 新規登録
        await addDoc(collection(db, 'bankAccounts'), {
          ...accountData,
          createdAt: new Date()
        });
      }

      setIsSubmitting(false);
      setIsRegistered(true);
    } catch (error) {
      console.error('口座登録エラー:', error);
      alert('口座登録に失敗しました。もう一度お試しください。');
      setIsSubmitting(false);
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

  if (isRegistered) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 pb-20">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="sticky top-0 bg-gradient-to-r from-pink-500 to-pink-600 border-b border-pink-300 p-6 flex items-center z-10 shadow-lg">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="text-white mr-4 p-2 hover:bg-white/20 rounded-full" data-testid="button-back">
            <ArrowLeft size={24} />
          </motion.button>
          <h1 className="text-2xl font-bold text-white">{existingAccountId ? '更新完了' : '登録完了'}</h1>
        </motion.div>

        <div className="p-6">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl p-8 text-center shadow-xl border-2 border-pink-100">
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }}>
              <CheckCircle className="w-24 h-24 text-green-500 mx-auto mb-6" />
            </motion.div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">口座登録完了！</h2>
            <p className="text-gray-600 mb-6 text-lg">
              銀行口座の登録が完了しました。<br />
              収益の振込申請が可能になりました。
            </p>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => navigate('/transfer-request')} className="bg-gradient-to-r from-pink-500 to-pink-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-2xl transition-all shadow-lg" data-testid="button-transfer">
              振込申請へ
            </motion.button>
          </motion.div>
        </div>

        <BottomNavigationWithCreator active="account" />
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
          <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}>
            <Building className="w-7 h-7 text-white mr-3" />
          </motion.div>
          <h1 className="text-2xl font-bold text-white">銀行口座登録</h1>
        </div>
      </motion.div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6">
          <div className="flex items-start space-x-4">
            <Shield className="w-6 h-6 text-blue-600 mt-1" />
            <div>
              <h3 className="font-bold text-blue-900 mb-2 text-lg">安全な口座登録</h3>
              <p className="text-base text-blue-800">
                入力された口座情報は暗号化され、安全に保管されます。収益の振込にのみ使用されます。
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl p-6 shadow-xl border-2 border-pink-100 space-y-5">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <Sparkles className="w-6 h-6 mr-2 text-pink-500" />
            口座情報
          </h3>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">銀行名 *</label>
            <input type="text" required value={formData.bankName} onChange={(e) => setFormData({...formData, bankName: e.target.value})} className="w-full px-4 py-3 border-2 border-pink-100 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent font-semibold text-lg" placeholder="例: みずほ銀行" data-testid="input-bank-name" />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">支店名 *</label>
            <input type="text" required value={formData.branchName} onChange={(e) => setFormData({...formData, branchName: e.target.value})} className="w-full px-4 py-3 border-2 border-pink-100 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent font-semibold text-lg" placeholder="例: 渋谷支店" data-testid="input-branch-name" />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">口座種別 *</label>
            <div className="grid grid-cols-3 gap-3">
              {accountTypes.map((type) => (
                <motion.button key={type.id} type="button" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setFormData({...formData, accountType: type.id})} className={`px-4 py-3 rounded-xl font-bold transition-all shadow-md ${formData.accountType === type.id ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white' : 'bg-gray-100 text-gray-700'}`} data-testid={`button-account-type-${type.id}`}>
                  {type.name}
                </motion.button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">口座番号 *</label>
            <input type="text" required value={formData.accountNumber} onChange={(e) => setFormData({...formData, accountNumber: e.target.value})} className="w-full px-4 py-3 border-2 border-pink-100 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent font-semibold text-lg" placeholder="例: 1234567" maxLength="7" data-testid="input-account-number" />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">口座名義 *</label>
            <input type="text" required value={formData.accountHolder} onChange={(e) => setFormData({...formData, accountHolder: e.target.value})} className="w-full px-4 py-3 border-2 border-pink-100 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent font-semibold text-lg" placeholder="例: ヤマダタロウ（全角カナ）" data-testid="input-account-holder" />
            <p className="text-xs text-gray-500 mt-1 font-medium">※ 全角カタカナで入力してください</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-gradient-to-br from-pink-100 to-purple-100 border-2 border-pink-200 rounded-2xl p-6">
          <div className="flex items-start space-x-4">
            <AlertCircle className="w-6 h-6 text-pink-600 mt-1" />
            <div>
              <h4 className="font-bold text-pink-900 mb-2 text-lg">重要事項</h4>
              <ul className="text-base text-pink-800 space-y-2">
                <li>• 本人名義の口座のみ登録できます</li>
                <li>• 一度登録すると変更には審査が必要です</li>
                <li>• 振込手数料は自己負担となります</li>
              </ul>
            </div>
          </div>
        </motion.div>

        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={isSubmitting} className="w-full bg-gradient-to-r from-pink-500 to-pink-600 text-white py-5 rounded-2xl font-bold text-xl shadow-xl hover:shadow-2xl transition-all flex items-center justify-center space-x-3 disabled:opacity-50" data-testid="button-submit">
          {isSubmitting ? (
            <>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-6 h-6 border-3 border-white border-t-transparent rounded-full" />
              <span>登録中...</span>
            </>
          ) : (
            <>
              <CheckCircle className="w-6 h-6" />
              <span>口座を登録する</span>
            </>
          )}
        </motion.button>
      </form>

      <BottomNavigationWithCreator active="account" />
    </div>
  );
};

export default BankAccountRegistrationPage;
