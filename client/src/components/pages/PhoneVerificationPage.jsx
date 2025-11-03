import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Phone, 
  CheckCircle,
  AlertCircle,
  Clock,
  Shield,
  ArrowRight,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { auth, db } from '../../firebase';
import { RecaptchaVerifier, PhoneAuthProvider, updatePhoneNumber } from 'firebase/auth';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import BottomNavigationWithCreator from '../BottomNavigationWithCreator';

const PhoneVerificationPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [step, setStep] = useState(1);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [verificationId, setVerificationId] = useState(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState(null);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    // 言語コードを日本語に設定
    auth.languageCode = 'ja';

    // reCAPTCHAの初期化
    if (!recaptchaVerifier && step === 1) {
      try {
        const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'normal',
          callback: () => {
            console.log('reCAPTCHA解決済み');
          },
          'expired-callback': () => {
            console.log('reCAPTCHA期限切れ');
            setError('認証の有効期限が切れました。ページをリロードしてください。');
          }
        });
        setRecaptchaVerifier(verifier);
      } catch (err) {
        console.error('reCAPTCHA初期化エラー:', err);
        setError('認証システムの初期化に失敗しました。ページをリロードしてください。');
      }
    }

    return () => {
      if (recaptchaVerifier) {
        try {
          recaptchaVerifier.clear();
        } catch (err) {
          console.error('reCAPTCHA クリアエラー:', err);
        }
      }
    };
  }, [step]);

  const formatPhoneNumber = (value) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    if (numbers.length <= 11) return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (e) => {
    setPhoneNumber(formatPhoneNumber(e.target.value));
    setError('');
  };

  const handleSendCode = async () => {
    if (!currentUser) {
      setError('ログインが必要です');
      return;
    }

    const cleanedPhone = phoneNumber.replace(/\D/g, '');
    if (!cleanedPhone || cleanedPhone.length < 10) {
      setError('有効な電話番号を入力してください');
      return;
    }

    if (!recaptchaVerifier) {
      setError('認証システムの初期化中です。しばらく待ってからもう一度お試しください。');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      // 日本の電話番号フォーマット（+81形式に変換）
      const formattedPhone = cleanedPhone.startsWith('0') 
        ? `+81${cleanedPhone.substring(1)}`
        : `+81${cleanedPhone}`;

      console.log('📱 電話番号認証を開始:', formattedPhone);
      console.log('🔐 reCAPTCHA状態:', recaptchaVerifier ? '初期化済み' : '未初期化');

      // SMSを送信（既存ユーザーに電話番号をリンクするための認証コードを取得）
      const provider = new PhoneAuthProvider(auth);
      const verId = await provider.verifyPhoneNumber(formattedPhone, recaptchaVerifier);
      
      console.log('✅ SMS送信成功 - Verification ID:', verId);
      
      setVerificationId(verId);
      setStep(2);
      setCountdown(300);
      setAttempts(0);
    } catch (err) {
      console.error('❌ SMS送信エラー:', err);
      console.error('エラーコード:', err.code);
      console.error('エラーメッセージ:', err.message);
      
      if (err.code === 'auth/invalid-phone-number') {
        setError('無効な電話番号です。正しい形式で入力してください。');
      } else if (err.code === 'auth/too-many-requests') {
        setError('リクエストが多すぎます。しばらく待ってから再度お試しください。');
      } else if (err.code === 'auth/captcha-check-failed') {
        setError('reCAPTCHAの検証に失敗しました。ページをリロードしてください。');
      } else if (err.code === 'auth/quota-exceeded') {
        setError('⚠️ Firebase SMS送信の上限に達しました。Firebaseコンソールで課金プランを確認してください。');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError('⚠️ このドメインは承認されていません。Firebaseコンソールで承認済みドメインを確認してください。');
      } else if (err.code === 'auth/missing-phone-number') {
        setError('電話番号が正しく設定されていません。');
      } else {
        setError(`認証コードの送信に失敗しました: ${err.message || err.code || '不明なエラー'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!currentUser) {
      setError('ログインが必要です');
      return;
    }

    if (!verificationCode || verificationCode.length !== 6) {
      setError('6桁の認証コードを入力してください');
      return;
    }

    if (!verificationId) {
      setError('認証コードが送信されていません');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      // 認証コードから認証情報を作成
      const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
      
      // 既存ユーザーに電話番号を更新
      await updatePhoneNumber(currentUser, credential);
      
      // Firestoreにユーザー情報を保存/更新
      try {
        await setDoc(doc(db, 'users', currentUser.uid), {
          phoneNumber: currentUser.phoneNumber,
          phoneVerified: true,
          verifiedAt: new Date(),
          updatedAt: new Date()
        }, { merge: true });
      } catch (firestoreError) {
        console.error('Firestore更新エラー:', firestoreError);
      }

      setStep(3);
    } catch (err) {
      console.error('認証エラー:', err);
      setAttempts(prev => prev + 1);
      
      if (err.code === 'auth/invalid-verification-code') {
        if (attempts >= 2) {
          setError('認証回数が上限に達しました。最初からやり直してください。');
          setTimeout(() => {
            setStep(1);
            setPhoneNumber('');
            setVerificationCode('');
            setAttempts(0);
            setVerificationId(null);
          }, 2000);
        } else {
          setError(`認証コードが正しくありません。残り${3 - attempts - 1}回`);
          setVerificationCode('');
        }
      } else if (err.code === 'auth/code-expired') {
        setError('認証コードの有効期限が切れました。もう一度送信してください。');
        setStep(1);
        setPhoneNumber('');
        setVerificationCode('');
        setAttempts(0);
        setVerificationId(null);
      } else {
        setError('認証に失敗しました。もう一度お試しください。');
        setVerificationCode('');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (countdown > 0) return;
    
    // ステップ1に戻って再送信
    setStep(1);
    setVerificationCode('');
    setAttempts(0);
    setVerificationId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 pb-20">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="sticky top-0 bg-gradient-to-r from-pink-500 to-pink-600 border-b border-pink-300 p-6 flex items-center z-10 shadow-lg">
        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="text-white mr-4 p-2 hover:bg-white/20 rounded-full" data-testid="button-back">
          <ArrowLeft size={24} />
        </motion.button>
        <div className="flex items-center">
          <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 3, repeat: Infinity }}>
            <Phone className="w-7 h-7 text-white mr-3" />
          </motion.div>
          <h1 className="text-2xl font-bold text-white">電話番号認証</h1>
        </div>
      </motion.div>

      <div className="p-6">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="max-w-md mx-auto">
              <div className="text-center mb-8">
                <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity }} className="w-20 h-20 bg-gradient-to-br from-pink-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-pink-200 shadow-lg">
                  <Phone className="w-10 h-10 text-pink-600" />
                </motion.div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">電話番号を入力</h2>
                <p className="text-gray-600 leading-relaxed">認証用のSMSを送信するために、電話番号を入力してください</p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">電話番号</label>
                  <input 
                    type="tel" 
                    value={phoneNumber} 
                    onChange={handlePhoneChange} 
                    placeholder="090-1234-5678" 
                    className="w-full px-5 py-4 border-2 border-pink-200 rounded-2xl focus:ring-2 focus:ring-pink-500 focus:border-transparent text-lg font-semibold shadow-sm" 
                    data-testid="input-phone" 
                  />
                  <p className="text-sm text-gray-500 mt-2 font-medium">日本の電話番号（090, 080, 070など）</p>
                </div>

                {/* reCAPTCHAコンテナ */}
                <div id="recaptcha-container" className="flex justify-center"></div>

                {error && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center space-x-3 text-red-600 bg-red-50 p-4 rounded-xl border-2 border-red-200">
                    <AlertCircle className="w-6 h-6" />
                    <span className="text-sm font-bold">{error}</span>
                  </motion.div>
                )}

                <motion.button 
                  onClick={handleSendCode} 
                  disabled={isLoading || !phoneNumber || phoneNumber.replace(/\D/g, '').length < 10} 
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
                      <span>認証コードを送信</span>
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
                <h2 className="text-2xl font-bold text-gray-900 mb-3">認証コードを入力</h2>
                <p className="text-gray-600 mb-3">{phoneNumber} に送信された6桁のコードを入力</p>
                {countdown > 0 && (
                  <p className="text-sm font-bold text-pink-600 flex items-center justify-center space-x-2">
                    <Clock className="w-5 h-5" />
                    <span>残り {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}</span>
                  </p>
                )}
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">認証コード</label>
                  <input 
                    type="text" 
                    value={verificationCode} 
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))} 
                    placeholder="123456" 
                    className="w-full px-5 py-4 border-2 border-pink-200 rounded-2xl focus:ring-2 focus:ring-pink-500 text-lg text-center tracking-widest font-bold shadow-sm" 
                    data-testid="input-code" 
                  />
                </div>

                {error && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center space-x-3 text-red-600 bg-red-50 p-4 rounded-xl border-2 border-red-200">
                    <AlertCircle className="w-6 h-6" />
                    <span className="text-sm font-bold">{error}</span>
                  </motion.div>
                )}

                <div className="space-y-3">
                  <motion.button 
                    onClick={handleVerifyCode} 
                    disabled={isLoading || !verificationCode || verificationCode.length !== 6} 
                    whileHover={{ scale: 1.02 }} 
                    whileTap={{ scale: 0.98 }} 
                    className="w-full bg-gradient-to-r from-pink-500 to-pink-600 text-white py-5 rounded-2xl font-bold text-lg hover:shadow-2xl disabled:opacity-50 transition-all flex items-center justify-center space-x-3 shadow-lg" 
                    data-testid="button-verify"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                        <span>認証中...</span>
                      </>
                    ) : (
                      <>
                        <span>認証する</span>
                        <CheckCircle className="w-6 h-6" />
                      </>
                    )}
                  </motion.button>

                  <motion.button 
                    onClick={handleResendCode} 
                    disabled={countdown > 0 || isLoading} 
                    whileHover={{ scale: 1.02 }} 
                    whileTap={{ scale: 0.98 }} 
                    className="w-full bg-gray-100 text-gray-700 py-4 rounded-2xl font-bold hover:bg-gray-200 disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
                  >
                    <RotateCcw className="w-5 h-5" />
                    <span>{countdown > 0 ? `再送信 (${Math.floor(countdown / 60)}:${(countdown % 60).toString().padStart(2, '0')})` : '認証コードを再送信'}</span>
                  </motion.button>
                </div>
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
                電話番号の認証が完了しました。<br />
                {phoneNumber} が認証済みとして登録されました。
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
              <h4 className="font-bold text-pink-900 mb-2 text-lg">電話番号認証について</h4>
              <ul className="text-base text-pink-800 space-y-2">
                <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2" />認証コードは5分間有効です</li>
                <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2" />認証は3回まで試行できます</li>
                <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2" />SMSが届かない場合は再送信してください</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>

      <BottomNavigationWithCreator active="account" />
    </div>
  );
};

export default PhoneVerificationPage;
