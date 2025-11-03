import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Mail, 
  CheckCircle,
  AlertCircle,
  Clock,
  Shield,
  ArrowRight,
  RotateCcw,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { auth, db } from '../../firebase';
import { sendEmailVerification, updateEmail } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import BottomNavigationWithCreator from '../BottomNavigationWithCreator';

const EmailVerificationPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingInterval, setCheckingInterval] = useState(null);

  useEffect(() => {
    // 言語コードを日本語に設定
    auth.languageCode = 'ja';
    
    if (currentUser) {
      setEmail(currentUser.email || '');
      // ユーザーが既に認証済みかチェック
      if (currentUser.emailVerified) {
        setStep(3);
      }
    }
  }, [currentUser]);

  useEffect(() => {
    // コンポーネントアンマウント時にインターバルをクリア
    return () => {
      if (checkingInterval) {
        clearInterval(checkingInterval);
      }
    };
  }, [checkingInterval]);

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    setError('');
  };

  const handleSendVerification = async () => {
    if (!currentUser) {
      setError('ログインが必要です');
      return;
    }

    if (!email || !validateEmail(email)) {
      setError('有効なメールアドレスを入力してください');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      console.log('📧 メール認証を開始:', email);
      console.log('👤 現在のメール:', currentUser.email);
      
      // メールアドレスが変更されている場合は更新
      if (currentUser.email !== email) {
        console.log('📝 メールアドレスを更新中...');
        await updateEmail(currentUser, email);
      }

      // 認証メールを送信
      console.log('📮 認証メールを送信中...');
      await sendEmailVerification(currentUser, {
        url: window.location.origin + '/settings/email-verification',
        handleCodeInApp: false
      });
      
      console.log('✅ 認証メール送信成功');
      setStep(2);
      
      // 認証状態を定期的にチェック
      const interval = setInterval(async () => {
        await currentUser.reload();
        if (currentUser.emailVerified) {
          clearInterval(interval);
          
          console.log('✅ メール認証完了');
          
          // Firestoreのユーザー情報を更新
          try {
            await updateDoc(doc(db, 'users', currentUser.uid), {
              email: currentUser.email,
              emailVerified: true,
              verifiedAt: new Date()
            });
          } catch (firestoreError) {
            console.error('Firestore更新エラー:', firestoreError);
          }
          
          setStep(3);
        }
      }, 3000);
      
      setCheckingInterval(interval);
    } catch (err) {
      console.error('❌ 認証メール送信エラー:', err);
      console.error('エラーコード:', err.code);
      console.error('エラーメッセージ:', err.message);
      
      if (err.code === 'auth/too-many-requests') {
        setError('リクエストが多すぎます。しばらく待ってから再度お試しください。');
      } else if (err.code === 'auth/invalid-email') {
        setError('無効なメールアドレスです。');
      } else if (err.code === 'auth/requires-recent-login') {
        setError('セキュリティのため、再度ログインしてからお試しください。');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('このメールアドレスは既に使用されています。');
      } else if (err.code === 'auth/quota-exceeded') {
        setError('⚠️ メール送信の上限に達しました。しばらく待ってから再度お試しください。');
      } else {
        setError(`認証メールの送信に失敗しました: ${err.message || err.code || '不明なエラー'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!currentUser) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      await sendEmailVerification(currentUser, {
        url: window.location.origin + '/settings/email-verification',
        handleCodeInApp: false
      });
      alert('認証メールを再送信しました');
    } catch (err) {
      console.error('再送信エラー:', err);
      setError('認証メールの再送信に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    if (!currentUser) return;
    
    setIsLoading(true);
    try {
      await currentUser.reload();
      if (currentUser.emailVerified) {
        // Firestoreのユーザー情報を更新
        try {
          await updateDoc(doc(db, 'users', currentUser.uid), {
            email: currentUser.email,
            emailVerified: true,
            verifiedAt: new Date()
          });
        } catch (firestoreError) {
          console.error('Firestore更新エラー:', firestoreError);
        }
        setStep(3);
      } else {
        setError('まだ認証が完了していません。メール内のリンクをクリックしてください。');
      }
    } catch (err) {
      console.error('認証確認エラー:', err);
      setError('認証の確認に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 pb-20">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="sticky top-0 bg-gradient-to-r from-pink-500 to-pink-600 border-b border-pink-300 p-6 flex items-center z-10 shadow-lg">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="text-white mr-4 p-2 hover:bg-white/20 rounded-full">
            <ArrowLeft size={24} />
          </motion.button>
          <h1 className="text-2xl font-bold text-white">メールアドレス認証</h1>
        </motion.div>
        <div className="p-6">
          <div className="max-w-md mx-auto text-center">
            <AlertCircle className="w-16 h-16 text-pink-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-3">ログインが必要です</h2>
            <p className="text-gray-600 mb-6">メールアドレス認証を行うには、まずログインしてください。</p>
            <button onClick={() => navigate('/login')} className="bg-gradient-to-r from-pink-500 to-pink-600 text-white px-8 py-4 rounded-2xl font-bold">
              ログインページへ
            </button>
          </div>
        </div>
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
            <Mail className="w-7 h-7 text-white mr-3" />
          </motion.div>
          <h1 className="text-2xl font-bold text-white">メールアドレス認証</h1>
        </div>
      </motion.div>

      <div className="p-6">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="max-w-md mx-auto">
              <div className="text-center mb-8">
                <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity }} className="w-20 h-20 bg-gradient-to-br from-pink-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-pink-200 shadow-lg">
                  <Mail className="w-10 h-10 text-pink-600" />
                </motion.div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">メールアドレスを認証</h2>
                <p className="text-gray-600 leading-relaxed">認証用のメールを送信します</p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">メールアドレス</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={handleEmailChange} 
                    placeholder="example@email.com" 
                    className="w-full px-5 py-4 border-2 border-pink-200 rounded-2xl focus:ring-2 focus:ring-pink-500 focus:border-transparent text-lg font-semibold shadow-sm" 
                    data-testid="input-email" 
                  />
                </div>

                {error && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center space-x-3 text-red-600 bg-red-50 p-4 rounded-xl border-2 border-red-200">
                    <AlertCircle className="w-6 h-6" />
                    <span className="text-sm font-bold">{error}</span>
                  </motion.div>
                )}

                <motion.button 
                  onClick={handleSendVerification} 
                  disabled={isLoading || !email || !validateEmail(email)} 
                  whileHover={{ scale: 1.02 }} 
                  whileTap={{ scale: 0.98 }} 
                  className="w-full bg-gradient-to-r from-pink-500 to-pink-600 text-white py-5 rounded-2xl font-bold text-lg hover:shadow-2xl disabled:opacity-50 transition-all flex items-center justify-center space-x-3 shadow-lg" 
                  data-testid="button-send-code"
                >
                  {isLoading ? (
                    <>
                      <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                      <span>送信中...</span>
                    </>
                  ) : (
                    <>
                      <span>認証メールを送信</span>
                      <ArrowRight className="w-6 h-6" />
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="max-w-md mx-auto">
              <div className="text-center mb-8">
                <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }} className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-blue-200 shadow-lg">
                  <Shield className="w-10 h-10 text-blue-600" />
                </motion.div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">メールを確認してください</h2>
                <p className="text-gray-600 mb-3">{email} に認証メールを送信しました</p>
                <p className="text-sm font-bold text-pink-600 flex items-center justify-center space-x-2">
                  <Clock className="w-5 h-5" />
                  <span>メール内のリンクをクリックしてください</span>
                </p>
              </div>

              {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center space-x-3 text-red-600 bg-red-50 p-4 rounded-xl border-2 border-red-200 mb-6">
                  <AlertCircle className="w-6 h-6" />
                  <span className="text-sm font-bold">{error}</span>
                </motion.div>
              )}

              <div className="space-y-3">
                <motion.button 
                  onClick={handleCheckVerification} 
                  disabled={isLoading} 
                  whileHover={{ scale: 1.02 }} 
                  whileTap={{ scale: 0.98 }} 
                  className="w-full bg-gradient-to-r from-pink-500 to-pink-600 text-white py-5 rounded-2xl font-bold text-lg hover:shadow-2xl disabled:opacity-50 transition-all flex items-center justify-center space-x-3 shadow-lg" 
                  data-testid="button-verify"
                >
                  {isLoading ? (
                    <>
                      <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                      <span>確認中...</span>
                    </>
                  ) : (
                    <>
                      <span>認証を確認</span>
                      <CheckCircle className="w-6 h-6" />
                    </>
                  )}
                </motion.button>

                <motion.button 
                  onClick={handleResendVerification} 
                  disabled={isLoading} 
                  whileHover={{ scale: 1.02 }} 
                  whileTap={{ scale: 0.98 }} 
                  className="w-full bg-gray-100 text-gray-700 py-4 rounded-2xl font-bold hover:bg-gray-200 disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span>認証メールを再送信</span>
                </motion.button>

                <motion.button 
                  onClick={() => window.open('mailto:', '_blank')} 
                  whileHover={{ scale: 1.02 }} 
                  whileTap={{ scale: 0.98 }} 
                  className="w-full bg-blue-100 text-blue-700 py-4 rounded-2xl font-bold hover:bg-blue-200 transition-all flex items-center justify-center space-x-2"
                >
                  <ExternalLink className="w-5 h-5" />
                  <span>メールアプリを開く</span>
                </motion.button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md mx-auto text-center">
              <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, 360] }} transition={{ duration: 1 }} className="w-24 h-24 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center mx-auto mb-8 border-4 border-green-300 shadow-2xl">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </motion.div>
              
              <h2 className="text-3xl font-bold text-gray-900 mb-4">認証完了！</h2>
              <p className="text-gray-600 mb-8 text-lg leading-relaxed">
                メールアドレスの認証が完了しました。<br />
                {email} が認証済みとして登録されました。
              </p>

              <motion.button 
                onClick={() => navigate('/account')} 
                whileHover={{ scale: 1.05 }} 
                whileTap={{ scale: 0.95 }} 
                className="w-full bg-gradient-to-r from-pink-500 to-pink-600 text-white py-5 rounded-2xl font-bold text-lg hover:shadow-2xl transition-all shadow-lg"
              >
                アカウントに戻る
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-8 bg-gradient-to-br from-pink-100 to-purple-100 border-2 border-pink-200 rounded-2xl p-6 relative overflow-hidden">
          <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute -top-10 -right-10 w-32 h-32 bg-white/30 rounded-full blur-2xl" />
          <div className="flex items-start space-x-4 relative z-10">
            <Sparkles className="w-6 h-6 text-pink-600 mt-1" />
            <div>
              <h4 className="font-bold text-pink-900 mb-2 text-lg">メールアドレス認証について</h4>
              <ul className="text-base text-pink-800 space-y-2">
                <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2" />メール内のリンクをクリックするだけ</li>
                <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2" />認証後は自動的に完了画面へ</li>
                <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2" />迷惑メールフォルダもご確認ください</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>

      <BottomNavigationWithCreator active="account" />
    </div>
  );
};

export default EmailVerificationPage;
