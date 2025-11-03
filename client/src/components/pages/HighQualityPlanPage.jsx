import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Check, 
  Star, 
  Crown,
  CreditCard,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNavigationWithCreator from '../BottomNavigationWithCreator';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { auth, db } from '../../firebase';
import { doc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Initialize Stripe with public key - only if configured
const stripePromise = import.meta.env.VITE_STRIPE_PUBLIC_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY)
  : null;

// Payment form component
const PaymentForm = ({ amount, planId, planName, onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setErrorMessage(submitError.message);
        setIsProcessing(false);
        return;
      }

      console.log('💳 決済処理を開始します...');
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'never',
      });

      if (error) {
        setErrorMessage(error.message);
        setIsProcessing(false);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Payment successful
        onSuccess();
      } else {
        // Payment is processing or requires action
        setErrorMessage('決済の処理中です。しばらくお待ちください。');
        setIsProcessing(false);
      }
    } catch (err) {
      setErrorMessage('決済処理中にエラーが発生しました');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-payment">
      <PaymentElement />
      
      {errorMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-pink-50 border border-pink-200 text-pink-800 px-4 py-3 rounded-lg flex items-start space-x-2"
          data-testid="text-error"
        >
          <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </motion.div>
      )}
      
      <div className="flex space-x-3">
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onCancel}
          className="flex-1 bg-gray-100 text-gray-700 py-4 rounded-xl font-bold hover:bg-gray-200 transition-colors"
          disabled={isProcessing}
          data-testid="button-cancel-payment"
        >
          キャンセル
        </motion.button>
        <motion.button
          type="submit"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={!stripe || isProcessing}
          className="flex-1 bg-gradient-to-r from-pink-500 to-pink-600 text-white py-4 rounded-xl font-bold hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="button-confirm-payment"
        >
          {isProcessing ? '処理中...' : `¥${amount.toLocaleString()}を支払う`}
        </motion.button>
      </div>
    </form>
  );
};

const HighQualityPlanPage = () => {
  const navigate = useNavigate();
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [clientSecret, setClientSecret] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  
  // Creator's set price (base amount)
  const creatorPrice = 1000; // クリエイターが設定した金額
  const consumptionTaxRate = 0.10; // 消費税10%
  const purchaseFeeRate = 0.10; // 購入手数料10%
  
  // Calculate fees
  const consumptionTax = Math.floor(creatorPrice * consumptionTaxRate);
  const purchaseFee = Math.floor(creatorPrice * purchaseFeeRate);
  const totalAmount = creatorPrice + consumptionTax + purchaseFee;

  const plans = [
    {
      id: 'monthly',
      name: '月額プラン',
      price: creatorPrice, // クリエイター設定金額を表示
      originalPrice: null,
      discount: null,
      features: [
        '4K画質動画視聴'
      ],
      popular: true
    }
  ];

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const handleProceedToPayment = async () => {
    setIsLoadingPayment(true);
    
    const user = auth.currentUser;
    if (!user) {
      alert('ログインが必要です');
      setIsLoadingPayment(false);
      navigate('/');
      return;
    }

    try {
      // Create Subscription with Payment Intent for recurring payment
      const response = await fetch('/api/create-subscription-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: 'high-quality-plan',
          planTitle: '高画質プラン（月額）',
          planPrice: creatorPrice,
          creatorId: 'platform',
          creatorName: 'Only-U Platform',
          userId: user.uid,
          userEmail: user.email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || '決済の準備中にエラーが発生しました';
        alert(errorMsg);
        setIsLoadingPayment(false);
        return;
      }

      const data = await response.json();
      
      if (data.clientSecret) {
        // Show payment form modal with client secret
        setClientSecret(data.clientSecret);
        setShowPaymentDetails(false);
        setShowPaymentForm(true);
        setIsLoadingPayment(false);
      } else {
        alert('Client Secretが取得できませんでした');
        setIsLoadingPayment(false);
      }
    } catch (error) {
      console.error('Error creating payment intent:', error);
      alert(error.message || '決済の準備中にエラーが発生しました');
      setIsLoadingPayment(false);
    }
  };

  const handlePaymentSuccess = async () => {
    setShowPaymentForm(false);
    setPaymentSuccess(true);
    
    try {
      const user = auth.currentUser;
      if (user) {
        // Save subscription info to Firestore
        await setDoc(doc(db, 'users', user.uid, 'subscriptions', 'highQualityPlan'), {
          planId: 'monthly',
          planName: '高画質プラン - 月額プラン',
          price: totalAmount,
          status: 'active',
          startDate: serverTimestamp(),
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        });

        // Save purchase history
        await addDoc(collection(db, 'purchases'), {
          userId: user.uid,
          planId: 'monthly',
          planName: '高画質プラン - 月額プラン',
          amount: totalAmount,
          currency: 'JPY',
          status: 'completed',
          paymentMethod: 'stripe',
          createdAt: serverTimestamp(),
        });

        console.log('Subscription and purchase saved to Firestore');
      }
    } catch (error) {
      console.error('Error saving to Firestore:', error);
    }
    
    // Auto close success message after 3 seconds
    setTimeout(() => {
      setPaymentSuccess(false);
      navigate(-1);
    }, 3000);
  };

  const handleCancelPayment = () => {
    setShowPaymentForm(false);
    setClientSecret('');
    setShowPaymentDetails(false);
  };

  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#ec4899',
        colorBackground: '#ffffff',
        colorText: '#1f2937',
        colorDanger: '#ef4444',
        borderRadius: '12px',
      },
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-pink-50 pb-20">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="sticky top-0 bg-gradient-to-r from-pink-500 to-pink-600 border-b border-pink-300 p-6 flex items-center z-10 shadow-lg">
        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="text-white mr-4 p-2 hover:bg-white/20 rounded-full" data-testid="button-back">
          <ArrowLeft size={24} />
        </motion.button>
        <div className="flex items-center">
          <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }}>
            <Crown className="w-7 h-7 text-white mr-3" />
          </motion.div>
          <h1 className="text-2xl font-bold text-white">高画質プラン</h1>
        </div>
      </motion.div>

      <div className="p-6 space-y-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity }} className="w-20 h-20 bg-gradient-to-br from-pink-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-pink-200 shadow-xl">
            <Crown className="w-10 h-10 text-pink-600" />
          </motion.div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent mb-2">高画質プラン</h2>
          <p className="text-gray-600 font-medium">最高品質の動画を広告なしでお楽しみください</p>
        </motion.div>

        {plans.map((plan, index) => (
          <motion.div key={plan.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + index * 0.1 }} className="bg-white border-2 border-pink-100 rounded-2xl p-6 shadow-xl">
            {plan.popular && (
              <div className="mb-4">
                <span className="bg-gradient-to-r from-pink-500 to-pink-600 text-white px-4 py-2 rounded-full text-sm font-bold inline-flex items-center space-x-2">
                  <Star className="w-4 h-4" />
                  <span>人気プラン</span>
                </span>
              </div>
            )}
            <h3 className="text-2xl font-bold text-gray-900 mb-2" data-testid="text-plan-name">{plan.name}</h3>
            <div className="flex items-baseline space-x-2 mb-6">
              <span className="text-4xl font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent" data-testid="text-plan-price">{formatCurrency(plan.price)}</span>
              <span className="text-gray-600 font-medium">/月</span>
            </div>
            <div className="space-y-3 mb-6">
              {plan.features.map((feature, idx) => (
                <motion.div key={idx} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + idx * 0.05 }} className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-gradient-to-br from-pink-100 to-pink-100 rounded-full flex items-center justify-center border border-pink-200">
                    <Check className="w-4 h-4 text-pink-600" />
                  </div>
                  <span className="text-gray-700 font-medium" data-testid={`text-feature-${idx}`}>{feature}</span>
                </motion.div>
              ))}
            </div>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowPaymentDetails(true)} className="w-full bg-gradient-to-r from-pink-500 to-pink-600 text-white py-5 rounded-2xl font-bold text-lg hover:shadow-2xl transition-all shadow-lg flex items-center justify-center space-x-3" data-testid="button-subscribe">
              <CreditCard className="w-6 h-6" />
              <span>今すぐ登録する</span>
            </motion.button>
          </motion.div>
        ))}
      </div>

      {/* Payment Details Modal */}
      <AnimatePresence>
        {showPaymentDetails && (
          <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setShowPaymentDetails(false)} data-testid="modal-payment-details">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} onClick={(e) => e.stopPropagation()} className="bg-white rounded-t-3xl p-6 pb-24 w-full max-w-md max-h-[85vh] overflow-y-auto" data-testid="container-payment-details">
              <h3 className="text-xl font-bold text-gray-900 mb-4">お支払い詳細</h3>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between"><span className="text-gray-600">プラン料金</span><span className="font-bold">{formatCurrency(creatorPrice)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">消費税（10%）</span><span className="font-bold">{formatCurrency(consumptionTax)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">購入手数料（10%）</span><span className="font-bold">{formatCurrency(purchaseFee)}</span></div>
                <div className="border-t-2 border-pink-100 pt-3 flex justify-between"><span className="text-lg font-bold">お支払い合計</span><span className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent" data-testid="text-total-amount">{formatCurrency(totalAmount)}</span></div>
              </div>
              <motion.button 
                whileHover={{ scale: 1.02 }} 
                whileTap={{ scale: 0.98 }} 
                onClick={handleProceedToPayment}
                disabled={isLoadingPayment}
                className="w-full bg-gradient-to-r from-pink-500 to-pink-600 text-white py-5 rounded-2xl font-bold text-lg hover:shadow-2xl transition-all disabled:opacity-50"
                data-testid="button-proceed-payment"
              >
                {isLoadingPayment ? '準備中...' : '支払いへ進む'}
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stripe Payment Form Modal */}
      <AnimatePresence>
        {showPaymentForm && clientSecret && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="modal-payment-form">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
              data-testid="container-payment-form"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-2">お支払い情報</h3>
              <p className="text-gray-600 mb-6">安全な決済でプランに登録</p>
              
              <Elements stripe={stripePromise} options={options}>
                <PaymentForm 
                  amount={totalAmount}
                  planId="monthly"
                  planName="高画質プラン - 月額プラン"
                  onSuccess={handlePaymentSuccess}
                  onCancel={handleCancelPayment}
                />
              </Elements>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {paymentSuccess && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="modal-payment-success">
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.8 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md text-center"
              data-testid="container-payment-success"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="w-20 h-20 bg-gradient-to-br from-pink-100 to-pink-200 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <CheckCircle className="w-12 h-12 text-pink-600" />
              </motion.div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent mb-2">
                決済完了！
              </h3>
              <p className="text-gray-600 mb-4">
                高画質プランへのご登録ありがとうございます
              </p>
              <div className="bg-gradient-to-r from-pink-50 to-pink-100 rounded-xl p-4">
                <p className="text-sm text-gray-700">
                  4K画質の動画をお楽しみください
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <BottomNavigationWithCreator active="account" />
    </div>
  );
};

export default HighQualityPlanPage;
