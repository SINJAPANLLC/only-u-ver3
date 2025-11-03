import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    Camera,
    Upload,
    Save,
    X,
    User,
    Mail,
    Globe,
    Calendar,
    MapPin,
    Edit3,
    CheckCircle,
    AlertCircle,
    Eye,
    EyeOff,
    Lock,
    Shield,
    Plus,
    Trash2,
    Star,
    DollarSign
} from 'lucide-react';
import BottomNavigationWithCreator from '../BottomNavigationWithCreator';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { doc, getDoc, setDoc, serverTimestamp, deleteField } from 'firebase/firestore';

const EditProfilePage = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const fileInputRef = useRef(null);
    const coverInputRef = useRef(null);
    
    const [formData, setFormData] = useState({
        name: '',
        bio: '',
        website: '',
        twitter: '',
        instagram: '',
        youtube: '',
        isPrivate: false,
        allowMessages: true,
        showOnlineStatus: true,
        allowTagging: true
    });

    const [avatar, setAvatar] = useState('https://via.placeholder.com/150');
    const [coverImage, setCoverImage] = useState('https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=200&fit=crop');
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [showSuccess, setShowSuccess] = useState(false);
    const [subscriptionPlans, setSubscriptionPlans] = useState([]);
    const [showAddPlan, setShowAddPlan] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);

    // Firestoreからユーザーデータを取得
    useEffect(() => {
        const fetchUserData = async () => {
            if (!currentUser) return;

            try {
                const userDocRef = doc(db, 'users', currentUser.uid);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setFormData({
                        name: userData.displayName || userData.name || '',
                        bio: userData.bio || '',
                        website: userData.website || '',
                        twitter: userData.twitter || '',
                        instagram: userData.instagram || '',
                        youtube: userData.youtube || '',
                        isPrivate: userData.isPrivate || false,
                        allowMessages: userData.allowMessages !== undefined ? userData.allowMessages : true,
                        showOnlineStatus: userData.showOnlineStatus !== undefined ? userData.showOnlineStatus : true,
                        allowTagging: userData.allowTagging !== undefined ? userData.allowTagging : true
                    });
                    setAvatar(userData.photoURL || userData.avatar || 'https://via.placeholder.com/150');
                    setCoverImage(userData.coverImage || 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=200&fit=crop');
                    setSubscriptionPlans(userData.subscriptionPlans || []);
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
            }
        };

        fetchUserData();
    }, [currentUser]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const handleAvatarUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setAvatar(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCoverUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setCoverImage(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const validateForm = () => {
        const newErrors = {};
        
        if (!formData.name.trim()) {
            newErrors.name = '名前は必須です';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validateForm() || !currentUser) {
            return;
        }

        setIsLoading(true);
        try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            
            // 保存するデータを準備（空の文字列は含めない）
            const updateData = {
                displayName: formData.name,
                name: formData.name,
                isPrivate: formData.isPrivate,
                allowMessages: formData.allowMessages,
                showOnlineStatus: formData.showOnlineStatus,
                allowTagging: formData.allowTagging,
                photoURL: avatar,
                avatar: avatar,
                coverImage: coverImage,
                subscriptionPlans: subscriptionPlans,
                updatedAt: serverTimestamp()
            };

            // ソーシャルリンクとbioの処理（空の場合は削除）
            updateData.bio = formData.bio || deleteField();
            updateData.website = formData.website || deleteField();
            updateData.twitter = formData.twitter || deleteField();
            updateData.instagram = formData.instagram || deleteField();
            updateData.youtube = formData.youtube || deleteField();
            
            await setDoc(userDocRef, updateData, { merge: true });
            
            setShowSuccess(true);
            setTimeout(() => {
                navigate(`/profile/${currentUser.uid}`, { replace: true });
            }, 2000);
        } catch (error) {
            console.error('プロフィール保存に失敗しました:', error);
            alert('プロフィールの保存に失敗しました。しばらくしてからお試しください。');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        if (window.confirm('変更を保存せずに終了しますか？')) {
            navigate(-1);
        }
    };

    const handleAddPlan = () => {
        setEditingPlan({
            id: Date.now().toString(),
            title: '',
            price: '',
            posts: '',
            description: '',
            isRecommended: false
        });
        setShowAddPlan(true);
    };

    const handleEditPlan = (plan) => {
        setEditingPlan({ ...plan });
        setShowAddPlan(true);
    };

    const handleSavePlan = () => {
        if (!editingPlan.title || !editingPlan.price) {
            alert('タイトルと価格は必須です');
            return;
        }

        const existingIndex = subscriptionPlans.findIndex(p => p.id === editingPlan.id);
        if (existingIndex >= 0) {
            const updated = [...subscriptionPlans];
            updated[existingIndex] = editingPlan;
            setSubscriptionPlans(updated);
        } else {
            setSubscriptionPlans([...subscriptionPlans, editingPlan]);
        }

        setShowAddPlan(false);
        setEditingPlan(null);
    };

    const handleDeletePlan = (planId) => {
        if (window.confirm('このプランを削除しますか？')) {
            setSubscriptionPlans(subscriptionPlans.filter(p => p.id !== planId));
        }
    };

    const handlePlanInputChange = (field, value) => {
        setEditingPlan(prev => ({
            ...prev,
            [field]: value
        }));
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-pink-100 pb-20">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-4 bg-gradient-to-r from-pink-500 to-pink-600 text-white sticky top-0 z-20 shadow-lg"
            >
                <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleCancel} 
                    className="p-2 hover:bg-white/20 rounded-full"
                    data-testid="button-cancel"
                >
                    <ArrowLeft size={20} />
                </motion.button>
                <h1 className="text-lg font-bold">プロフィールを編集</h1>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSave}
                    disabled={isLoading}
                    className="bg-white text-pink-600 px-4 py-2 rounded-full text-sm font-bold hover:bg-pink-50 disabled:bg-gray-300 disabled:text-gray-500 transition-colors shadow-lg"
                    data-testid="button-save"
                >
                    {isLoading ? '保存中...' : '保存'}
                </motion.button>
            </motion.div>

            {/* Success Message */}
            <AnimatePresence>
                {showSuccess && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 m-4 rounded-2xl shadow-lg"
                    >
                        <div className="flex items-center">
                            <CheckCircle className="w-5 h-5 mr-2" />
                            <p className="font-bold">プロフィールが正常に保存されました！</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="p-4 space-y-6">
                {/* Profile Images */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl p-6 shadow-xl border-2 border-pink-100"
                >
                    <h2 className="text-lg font-bold text-pink-900 mb-4 flex items-center">
                        <Camera className="w-5 h-5 mr-2" />
                        プロフィール画像
                    </h2>
                    
                    {/* Avatar */}
                    <div className="flex items-center space-x-4 mb-6">
                        <div className="relative">
                            <img
                                src={avatar}
                                alt="Avatar"
                                className="w-20 h-20 rounded-full object-cover border-2 border-pink-200 shadow-md"
                                data-testid="img-avatar-preview"
                            />
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute -bottom-1 -right-1 bg-gradient-to-r from-pink-500 to-pink-600 text-white p-2 rounded-full shadow-lg"
                                data-testid="button-upload-avatar"
                            >
                                <Camera size={16} />
                            </motion.button>
                        </div>
                        <div>
                            <h3 className="font-bold text-pink-900">プロフィール画像</h3>
                            <p className="text-sm text-pink-600">推奨サイズ: 400x400px</p>
                        </div>
                    </div>

                    {/* Cover Image */}
                    <div className="space-y-2">
                        <h3 className="font-bold text-pink-900">カバー画像</h3>
                        <div className="relative">
                            <img
                                src={coverImage}
                                alt="Cover"
                                className="w-full h-32 object-cover rounded-lg border-2 border-pink-100"
                                data-testid="img-cover-preview"
                            />
                            <motion.button
                                whileHover={{ opacity: 1 }}
                                onClick={() => coverInputRef.current?.click()}
                                className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-lg"
                                data-testid="button-upload-cover"
                            >
                                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                                    <Upload size={20} className="text-white" />
                                </div>
                            </motion.button>
                        </div>
                        <p className="text-sm text-pink-600">推奨サイズ: 1200x400px</p>
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                    />
                    <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleCoverUpload}
                        className="hidden"
                    />
                </motion.div>

                {/* Basic Information */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-2xl p-6 shadow-xl border-2 border-pink-100"
                >
                    <h2 className="text-lg font-bold text-pink-900 mb-4 flex items-center">
                        <User className="w-5 h-5 mr-2" />
                        基本情報
                    </h2>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-pink-900 mb-2">
                                名前 *
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                className={`w-full p-3 border-2 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent ${
                                    errors.name ? 'border-red-500' : 'border-pink-100'
                                }`}
                                placeholder="名前を入力"
                                data-testid="input-name"
                            />
                            {errors.name && (
                                <p className="text-red-500 text-sm mt-1 flex items-center">
                                    <AlertCircle size={16} className="mr-1" />
                                    {errors.name}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-pink-900 mb-2">
                                自己紹介
                            </label>
                            <textarea
                                name="bio"
                                value={formData.bio}
                                onChange={handleInputChange}
                                rows={4}
                                className="w-full p-3 border-2 border-pink-100 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                                placeholder="自己紹介を入力..."
                                maxLength={500}
                                data-testid="input-bio"
                            />
                            <p className="text-sm text-pink-600 mt-1">
                                {formData.bio.length}/500文字
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Social Links */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white rounded-2xl p-6 shadow-xl border-2 border-pink-100"
                >
                    <h2 className="text-lg font-bold text-pink-900 mb-4 flex items-center">
                        <Globe className="w-5 h-5 mr-2" />
                        ソーシャルリンク
                    </h2>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-pink-900 mb-2">
                                WEBサイト
                            </label>
                            <div className="flex items-center">
                                <Globe className="w-5 h-5 text-pink-400 mr-2" />
                                <input
                                    type="url"
                                    name="website"
                                    value={formData.website}
                                    onChange={handleInputChange}
                                    className="flex-1 p-3 border-2 border-pink-100 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                    placeholder="https://example.com"
                                    data-testid="input-website"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-pink-900 mb-2">
                                X (Twitter)
                            </label>
                            <div className="flex items-center">
                                <span className="text-pink-400 mr-2 font-bold">𝕏</span>
                                <input
                                    type="url"
                                    name="twitter"
                                    value={formData.twitter}
                                    onChange={handleInputChange}
                                    className="flex-1 p-3 border-2 border-pink-100 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                    placeholder="https://x.com/username"
                                    data-testid="input-twitter"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-pink-900 mb-2">
                                Instagram
                            </label>
                            <div className="flex items-center">
                                <span className="text-pink-400 mr-2 text-xl">📷</span>
                                <input
                                    type="url"
                                    name="instagram"
                                    value={formData.instagram}
                                    onChange={handleInputChange}
                                    className="flex-1 p-3 border-2 border-pink-100 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                    placeholder="https://instagram.com/username"
                                    data-testid="input-instagram"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-pink-900 mb-2">
                                YouTube
                            </label>
                            <div className="flex items-center">
                                <span className="text-pink-400 mr-2 text-xl">▶️</span>
                                <input
                                    type="url"
                                    name="youtube"
                                    value={formData.youtube}
                                    onChange={handleInputChange}
                                    className="flex-1 p-3 border-2 border-pink-100 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                    placeholder="https://youtube.com/@username"
                                    data-testid="input-youtube"
                                />
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Subscription Plans */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white rounded-2xl p-6 shadow-xl border-2 border-pink-100"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-pink-900 flex items-center">
                            <Star className="w-5 h-5 mr-2" />
                            サブスクリプションプラン
                        </h2>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleAddPlan}
                            className="bg-gradient-to-r from-pink-500 to-pink-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg flex items-center space-x-2"
                            data-testid="button-add-plan"
                        >
                            <Plus className="w-4 h-4" />
                            <span>プラン追加</span>
                        </motion.button>
                    </div>

                    {subscriptionPlans.length > 0 ? (
                        <div className="space-y-3">
                            {subscriptionPlans.map((plan, index) => (
                                <motion.div
                                    key={plan.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl p-4 border-2 border-pink-200"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-pink-900 flex items-center">
                                                {plan.emoji && <span className="mr-2">{plan.emoji}</span>}
                                                {plan.title}
                                                {plan.isRecommended && (
                                                    <span className="ml-2 bg-gradient-to-r from-pink-500 to-pink-600 text-white text-xs px-2 py-1 rounded-full">
                                                        おすすめ
                                                    </span>
                                                )}
                                            </h3>
                                            <p className="text-sm text-pink-700 mt-1">{plan.price} • {plan.posts}投稿</p>
                                            <p className="text-sm text-pink-600 mt-2">{plan.description}</p>
                                            <div className="mt-2 text-xs text-pink-500">
                                                📌 プランレベル: {
                                                    plan.planLevel === 1 || plan.planLevel === 'basic' || plan.planLevel === 'ベーシック' ? 'ベーシック' :
                                                    plan.planLevel === 2 || plan.planLevel === 'premium' || plan.planLevel === 'プレミアム' ? 'プレミアム' :
                                                    plan.planLevel === 3 || plan.planLevel === 'vip' || plan.planLevel === 'VIP' ? 'VIP' :
                                                    '未設定'
                                                }
                                            </div>
                                        </div>
                                        <div className="flex space-x-2 ml-4">
                                            <motion.button
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}
                                                onClick={() => handleEditPlan(plan)}
                                                className="p-2 bg-white text-pink-600 rounded-lg hover:bg-pink-50"
                                                data-testid={`button-edit-plan-${plan.id}`}
                                            >
                                                <Edit3 className="w-4 h-4" />
                                            </motion.button>
                                            <motion.button
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}
                                                onClick={() => handleDeletePlan(plan.id)}
                                                className="p-2 bg-white text-red-500 rounded-lg hover:bg-red-50"
                                                data-testid={`button-delete-plan-${plan.id}`}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </motion.button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl border-2 border-dashed border-pink-300">
                            <Star className="w-12 h-12 mx-auto text-pink-300 mb-3" />
                            <p className="text-pink-600 font-medium mb-3">サブスクリプションプランがありません</p>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleAddPlan}
                                className="bg-gradient-to-r from-pink-500 to-pink-600 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg"
                                data-testid="button-add-first-plan"
                            >
                                最初のプランを追加
                            </motion.button>
                        </div>
                    )}
                </motion.div>

                {/* Privacy Settings */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-white rounded-2xl p-6 shadow-xl border-2 border-pink-100"
                >
                    <h2 className="text-lg font-bold text-pink-900 mb-4 flex items-center">
                        <Shield className="w-5 h-5 mr-2" />
                        プライバシー設定
                    </h2>
                    
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-pink-900">プライベートアカウント</h3>
                                <p className="text-sm text-pink-600">フォロワーを承認制にする</p>
                            </div>
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setFormData(prev => ({ ...prev, isPrivate: !prev.isPrivate }))}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    formData.isPrivate ? 'bg-gradient-to-r from-pink-500 to-pink-600' : 'bg-gray-300'
                                }`}
                                data-testid="toggle-private"
                            >
                                <motion.span
                                    animate={{ x: formData.isPrivate ? 20 : 4 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    className="inline-block h-4 w-4 rounded-full bg-white shadow-md"
                                />
                            </motion.button>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-pink-900">メッセージ受信</h3>
                                <p className="text-sm text-pink-600">他のユーザーからのメッセージを許可</p>
                            </div>
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setFormData(prev => ({ ...prev, allowMessages: !prev.allowMessages }))}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    formData.allowMessages ? 'bg-gradient-to-r from-pink-500 to-pink-600' : 'bg-gray-300'
                                }`}
                                data-testid="toggle-messages"
                            >
                                <motion.span
                                    animate={{ x: formData.allowMessages ? 20 : 4 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    className="inline-block h-4 w-4 rounded-full bg-white shadow-md"
                                />
                            </motion.button>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-pink-900">オンライン状態表示</h3>
                                <p className="text-sm text-pink-600">オンライン状態を他のユーザーに表示</p>
                            </div>
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setFormData(prev => ({ ...prev, showOnlineStatus: !prev.showOnlineStatus }))}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    formData.showOnlineStatus ? 'bg-gradient-to-r from-pink-500 to-pink-600' : 'bg-gray-300'
                                }`}
                                data-testid="toggle-online-status"
                            >
                                <motion.span
                                    animate={{ x: formData.showOnlineStatus ? 20 : 4 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    className="inline-block h-4 w-4 rounded-full bg-white shadow-md"
                                />
                            </motion.button>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-pink-900">タグ付け許可</h3>
                                <p className="text-sm text-pink-600">他のユーザーによるタグ付けを許可</p>
                            </div>
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setFormData(prev => ({ ...prev, allowTagging: !prev.allowTagging }))}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    formData.allowTagging ? 'bg-gradient-to-r from-pink-500 to-pink-600' : 'bg-gray-300'
                                }`}
                                data-testid="toggle-tagging"
                            >
                                <motion.span
                                    animate={{ x: formData.allowTagging ? 20 : 4 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    className="inline-block h-4 w-4 rounded-full bg-white shadow-md"
                                />
                            </motion.button>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Add/Edit Plan Modal */}
            <AnimatePresence>
                {showAddPlan && editingPlan && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowAddPlan(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
                        >
                            <div className="bg-gradient-to-r from-pink-500 to-pink-600 text-white p-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xl font-bold">
                                        {subscriptionPlans.find(p => p.id === editingPlan.id) ? 'プランを編集' : 'プランを追加'}
                                    </h3>
                                    <motion.button
                                        whileHover={{ scale: 1.1, rotate: 90 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => setShowAddPlan(false)}
                                        className="p-2 hover:bg-white/20 rounded-full transition-colors"
                                        data-testid="button-close-plan-modal"
                                    >
                                        <X className="w-5 h-5" />
                                    </motion.button>
                                </div>
                            </div>
                            <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
                                <div>
                                    <label className="block text-sm font-bold text-pink-900 mb-2">
                                        プラン名 *
                                    </label>
                                    <input
                                        type="text"
                                        value={editingPlan.title}
                                        onChange={(e) => handlePlanInputChange('title', e.target.value)}
                                        className="w-full p-3 border-2 border-pink-100 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                        placeholder="例: 最新見放題プラン"
                                        data-testid="input-plan-title"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-pink-900 mb-2">
                                        価格 *
                                    </label>
                                    <input
                                        type="text"
                                        value={editingPlan.price}
                                        onChange={(e) => handlePlanInputChange('price', e.target.value)}
                                        className="w-full p-3 border-2 border-pink-100 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                        placeholder="例: ¥3,980/月"
                                        data-testid="input-plan-price"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-pink-900 mb-2">
                                        投稿数
                                    </label>
                                    <input
                                        type="number"
                                        value={editingPlan.posts}
                                        onChange={(e) => handlePlanInputChange('posts', e.target.value)}
                                        className="w-full p-3 border-2 border-pink-100 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                        placeholder="30"
                                        data-testid="input-plan-posts"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-pink-900 mb-2">
                                        説明
                                    </label>
                                    <textarea
                                        value={editingPlan.description}
                                        onChange={(e) => handlePlanInputChange('description', e.target.value)}
                                        rows={3}
                                        className="w-full p-3 border-2 border-pink-100 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                                        placeholder="プランの説明を入力..."
                                        data-testid="input-plan-description"
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-bold text-pink-900">
                                        おすすめプラン
                                    </label>
                                    <motion.button
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handlePlanInputChange('isRecommended', !editingPlan.isRecommended)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                            editingPlan.isRecommended ? 'bg-gradient-to-r from-pink-500 to-pink-600' : 'bg-gray-300'
                                        }`}
                                        data-testid="toggle-plan-recommended"
                                    >
                                        <motion.span
                                            animate={{ x: editingPlan.isRecommended ? 20 : 4 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                            className="inline-block h-4 w-4 rounded-full bg-white shadow-md"
                                        />
                                    </motion.button>
                                </div>

                                <div className="flex space-x-3 pt-4">
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setShowAddPlan(false)}
                                        className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-bold"
                                        data-testid="button-cancel-plan-modal"
                                    >
                                        キャンセル
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={handleSavePlan}
                                        className="flex-1 bg-gradient-to-r from-pink-500 to-pink-600 text-white py-3 rounded-xl font-bold shadow-lg"
                                        data-testid="button-save-plan-modal"
                                    >
                                        保存
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <BottomNavigationWithCreator active="account" />
        </div>
    );
};

export default EditProfilePage;
