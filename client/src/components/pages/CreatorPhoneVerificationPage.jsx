import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Phone, ArrowLeft, ArrowRight, RotateCcw, CheckCircle, AlertCircle, Clock, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useCreator } from '../../context/CreatorContext';
import { useAuth } from '../../context/AuthContext';
import { auth, db } from '../../firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

const CreatorPhoneVerificationPage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { applyForCreator } = useCreator();
    const { currentUser } = useAuth();
    
    const [step, setStep] = useState(1); // 1: 電話番号入力, 2: 認証コード入力, 3: 完了
    const [phoneNumber, setPhoneNumber] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [countdown, setCountdown] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [attempts, setAttempts] = useState(0);
    const [formData, setFormData] = useState(null);
    const [confirmationResult, setConfirmationResult] = useState(null);
    const recaptchaVerifierRef = useRef(null);

    // URLパラメータから前のページのデータを取得
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const data = urlParams.get('data');
        if (data) {
            setFormData(JSON.parse(decodeURIComponent(data)));
        } else {
            // formDataがない場合は最初のステップに戻す
            setError('申請データが見つかりません。最初からやり直してください。');
            setTimeout(() => {
                navigate('/register-creator');
            }, 2000);
        }
    }, [navigate]);

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    // Initialize reCAPTCHA
    useEffect(() => {
        // 言語コードを日本語に設定
        auth.languageCode = 'ja';
        
        if (!recaptchaVerifierRef.current) {
            try {
                recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
                    'size': 'normal', // 'normal' = 可視化（デバッグ用）, 'invisible' = 非表示（本番用）
                    'callback': (response) => {
                        console.log('reCAPTCHA solved');
                    },
                    'expired-callback': () => {
                        console.log('reCAPTCHA expired');
                        setError('認証がタイムアウトしました。もう一度お試しください。');
                    }
                });
            } catch (error) {
                console.error('reCAPTCHA initialization error:', error);
                setError('認証システムの初期化に失敗しました。ページをリロードしてください。');
            }
        }

        return () => {
            if (recaptchaVerifierRef.current) {
                try {
                    recaptchaVerifierRef.current.clear();
                } catch (error) {
                    console.error('Error clearing reCAPTCHA:', error);
                }
            }
        };
    }, []);

    const formatPhoneNumber = (value) => {
        const numbers = value.replace(/\D/g, '');
        if (numbers.length <= 3) {
            return numbers;
        } else if (numbers.length <= 7) {
            return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
        } else if (numbers.length <= 11) {
            return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
        } else {
            return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
        }
    };

    const handlePhoneNumberChange = (e) => {
        const input = e.target.value;
        setPhoneNumber(formatPhoneNumber(input));
        setError('');
    };

    const handleSendCode = async () => {
        if (!phoneNumber || phoneNumber.replace(/\D/g, '').length < 10) {
            setError('有効な電話番号を入力してください');
            return;
        }
        
        setIsLoading(true);
        setError('');
        setAttempts(prev => prev + 1);

        try {
            // Format phone number to E.164 format (+81...)
            const cleanNumber = phoneNumber.replace(/\D/g, '');
            let formattedNumber;
            
            if (cleanNumber.startsWith('0')) {
                // Remove leading 0 and add +81
                formattedNumber = '+81' + cleanNumber.substring(1);
            } else if (cleanNumber.startsWith('81')) {
                formattedNumber = '+' + cleanNumber;
            } else {
                formattedNumber = '+81' + cleanNumber;
            }

            console.log('Sending SMS to:', formattedNumber);

            if (!recaptchaVerifierRef.current) {
                throw new Error('reCAPTCHA が初期化されていません。ページを再読み込みしてください。');
            }

            // Send verification code via Firebase Phone Auth
            const confirmation = await signInWithPhoneNumber(
                auth,
                formattedNumber,
                recaptchaVerifierRef.current
            );
            
            setConfirmationResult(confirmation);
            setCountdown(300); // 5 minutes
            setStep(2);
            
            console.log('SMS sent successfully');
        } catch (err) {
            console.error('SMS send error:', err);
            let errorMessage = '認証コードの送信に失敗しました。';
            
            if (err.code === 'auth/invalid-phone-number') {
                errorMessage = '無効な電話番号です。正しい形式で入力してください。';
            } else if (err.code === 'auth/too-many-requests') {
                errorMessage = 'リクエストが多すぎます。しばらくしてからお試しください。';
            } else if (err.code === 'auth/quota-exceeded') {
                errorMessage = 'SMS送信の上限に達しました。後でお試しください。';
            }
            
            setError(errorMessage);
            
            // Reset reCAPTCHA on error
            if (recaptchaVerifierRef.current) {
                try {
                    recaptchaVerifierRef.current.clear();
                    recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
                        'size': 'normal', // 'normal' = 可視化（デバッグ用）, 'invisible' = 非表示（本番用）
                        'callback': (response) => {
                            console.log('reCAPTCHA solved');
                        }
                    });
                } catch (recaptchaError) {
                    console.error('Error resetting reCAPTCHA:', recaptchaError);
                }
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyCode = async () => {
        if (!verificationCode || verificationCode.length !== 6) {
            setError('6桁の認証コードを入力してください');
            return;
        }

        if (!confirmationResult) {
            setError('認証セッションが見つかりません。最初からやり直してください。');
            return;
        }
        
        setIsLoading(true);
        setError('');

        try {
            // Verify the code with Firebase
            await confirmationResult.confirm(verificationCode);
            
            console.log('Phone verification successful');
            setStep(3);
        } catch (err) {
            console.error('Verification error:', err);
            
            let errorMessage = '認証に失敗しました。';
            if (err.code === 'auth/invalid-verification-code') {
                errorMessage = '認証コードが正しくありません。';
            } else if (err.code === 'auth/code-expired') {
                errorMessage = '認証コードの有効期限が切れました。再送信してください。';
            }
            
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendCode = async () => {
        if (countdown > 0) return;
        
        // Reset and resend
        setStep(1);
        setVerificationCode('');
        setConfirmationResult(null);
    };

    const handleComplete = async () => {
        if (!currentUser) {
            setError('ログインしてください。');
            return;
        }

        if (!formData) {
            setError('申請データが見つかりません。最初からやり直してください。');
            setTimeout(() => {
                navigate('/register-creator');
            }, 2000);
            return;
        }

        // Navigate to document submission page with form data
        const dataWithPhone = {
            ...formData,
            phoneNumber: phoneNumber.replace(/\D/g, ''),
            verifiedAt: new Date().toISOString()
        };
        
        const encodedData = encodeURIComponent(JSON.stringify(dataWithPhone));
        navigate(`/document-submission?data=${encodedData}`);
    };

    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                    <>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">電話番号認証</h2>
                        <p className="text-gray-600 mb-6">
                            本人確認のため、SMSで認証コードを送信します。電話番号を入力してください。
                        </p>
                        
                        <div className="relative mb-4">
                            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="tel"
                                placeholder="電話番号 (例: 090-1234-5678)"
                                value={phoneNumber}
                                onChange={handlePhoneNumberChange}
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent text-lg"
                                disabled={isLoading}
                            />
                        </div>
                        
                        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
                        
                        <button
                            onClick={handleSendCode}
                            disabled={isLoading || phoneNumber.replace(/\D/g, '').length < 10}
                            className="w-full bg-pink-500 text-white py-3 rounded-xl font-semibold text-lg hover:bg-pink-600 disabled:bg-gray-300 transition-colors flex items-center justify-center space-x-2"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <ArrowRight size={20} />
                            )}
                            <span>認証コードを送信</span>
                        </button>
                    </>
                );
                
            case 2:
                return (
                    <>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">認証コード入力</h2>
                        <p className="text-gray-600 mb-6">
                            {phoneNumber} に送信された6桁の認証コードを入力してください。
                        </p>
                        
                        <div className="relative mb-4">
                            <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="6桁の認証コード"
                                value={verificationCode}
                                onChange={(e) => { setVerificationCode(e.target.value); setError(''); }}
                                maxLength={6}
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent text-lg tracking-widest"
                                disabled={isLoading}
                            />
                        </div>
                        
                        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
                        
                        <div className="flex justify-between items-center mb-6">
                            <button
                                onClick={handleResendCode}
                                disabled={isLoading || countdown > 0}
                                className={`text-sm font-medium ${countdown > 0 ? 'text-gray-400' : 'text-pink-600 hover:underline'} flex items-center space-x-1`}
                            >
                                <RotateCcw size={16} />
                                <span>{countdown > 0 ? `再送信 (${Math.floor(countdown / 60)}:${('0' + (countdown % 60)).slice(-2)})` : 'コードを再送信'}</span>
                            </button>
                            <span className="text-sm text-gray-500 flex items-center space-x-1">
                                <Clock size={16} />
                                <span>残り {Math.floor(countdown / 60)}:{('0' + (countdown % 60)).slice(-2)}</span>
                            </span>
                        </div>
                        
                        <button
                            onClick={handleVerifyCode}
                            disabled={isLoading || verificationCode.length !== 6}
                            className="w-full bg-pink-500 text-white py-3 rounded-xl font-semibold text-lg hover:bg-pink-600 disabled:bg-gray-300 transition-colors flex items-center justify-center space-x-2"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <CheckCircle size={20} />
                            )}
                            <span>認証する</span>
                        </button>
                    </>
                );
                
            case 3:
                return (
                    <div className="text-center">
                        <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">電話番号認証が完了しました！</h2>
                        <p className="text-gray-600 mb-8">
                            次のステップで本人確認書類を提出してください。
                        </p>
                        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
                        <button
                            onClick={handleComplete}
                            disabled={isLoading}
                            className="w-full bg-pink-500 text-white py-3 rounded-xl font-semibold text-lg hover:bg-pink-600 disabled:bg-gray-300 transition-colors"
                        >
                            {isLoading ? '処理中...' : '書類提出へ進む'}
                        </button>
                    </div>
                );
                
            default:
                return null;
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="min-h-screen bg-white p-4 pb-20 max-w-3xl mx-auto"
        >
            {/* Progress bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div className="flex-1 flex items-center">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500 text-white font-bold">
                        <CheckCircle size={16} />
                    </div>
                    <span className="ml-2 text-xs sm:text-sm text-gray-500">
                        情報を入力
                    </span>
                </div>

                <div className="flex-1 flex items-center">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-white font-bold ${
                        step >= 2 ? 'bg-pink-500' : 'bg-gray-400'
                    }`}>
                        {step > 2 ? <CheckCircle size={16} /> : '2'}
                    </div>
                    <span className={`ml-2 text-xs sm:text-sm ${
                        step >= 2 ? 'font-semibold' : 'text-gray-500'
                    }`}>
                        電話番号認証
                    </span>
                </div>

                <div className="flex-1 flex items-center">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-400 text-white font-bold">3</div>
                    <span className="ml-2 text-xs sm:text-sm text-gray-500">
                        書類を提出
                    </span>
                </div>

                <div className="flex-1 flex items-center">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-400 text-white font-bold">4</div>
                    <span className="ml-2 text-xs sm:text-sm text-gray-500">
                        書類審査
                    </span>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-md mx-auto bg-white rounded-xl shadow-sm p-6">
                {renderStepContent()}
            </div>

            {/* Back button */}
            {step < 3 && (
                <div className="mt-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        <ArrowLeft size={20} />
                        <span>戻る</span>
                    </button>
                </div>
            )}

            {/* reCAPTCHA container (invisible) */}
            <div id="recaptcha-container"></div>
        </motion.div>
    );
};

export default CreatorPhoneVerificationPage;
