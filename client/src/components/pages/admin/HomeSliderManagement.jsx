import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Image as ImageIcon,
  Plus,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  ExternalLink,
  GripVertical,
  Upload,
  RefreshCw,
  Check,
  X,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { db, auth } from '../../../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, query, onSnapshot, writeBatch } from 'firebase/firestore';
import { AdminPageContainer, AdminPageHeader } from './AdminPageContainer';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const HomeSliderManagement = () => {
  const [sliders, setSliders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedSlider, setSelectedSlider] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // フォーム状態
  const [formData, setFormData] = useState({
    title: '',
    imageUrl: '',
    link: '',
    position: 0,
    isActive: true
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  
  const { toast } = useToast();

  // スライダーデータをリアルタイム取得
  useEffect(() => {
    const q = query(collection(db, 'homeSliders'), orderBy('position', 'asc'));
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const slidersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setSliders(slidersData);
        setLoading(false);
      },
      (error) => {
        console.error('スライダー取得エラー:', error);
        toast({
          title: 'エラー',
          description: 'スライダーデータの取得に失敗しました',
          variant: 'destructive'
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [toast]);

  // 画像ファイル選択
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 画像ファイルのみ許可
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'エラー',
        description: '画像ファイルのみアップロード可能です',
        variant: 'destructive'
      });
      return;
    }

    setImageFile(file);
    
    // プレビュー生成
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // 画像アップロード（Object Storage）
  const uploadImage = async () => {
    if (!imageFile) return null;

    setIsUploading(true);
    
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('ログインが必要です');
      }

      const idToken = await currentUser.getIdToken();
      const formData = new FormData();
      formData.append('file', imageFile);
      formData.append('visibility', 'public');

      const response = await fetch('/api/objects/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('画像のアップロードに失敗しました');
      }

      const { objectPath } = await response.json();
      return objectPath;
    } catch (error) {
      console.error('画像アップロードエラー:', error);
      toast({
        title: 'エラー',
        description: error.message || '画像のアップロードに失敗しました',
        variant: 'destructive'
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  // スライダー追加
  const handleAddSlider = async () => {
    if (!formData.title.trim()) {
      toast({
        title: 'エラー',
        description: 'タイトルを入力してください',
        variant: 'destructive'
      });
      return;
    }

    if (!imageFile && !formData.imageUrl.trim()) {
      toast({
        title: 'エラー',
        description: '画像を選択してください',
        variant: 'destructive'
      });
      return;
    }

    try {
      // 画像をアップロード
      let imageUrl = formData.imageUrl;
      if (imageFile) {
        const uploadedUrl = await uploadImage();
        if (!uploadedUrl) return;
        imageUrl = uploadedUrl;
      }

      // 最大のposition値を取得
      const maxPosition = sliders.length > 0 
        ? Math.max(...sliders.map(s => s.position || 0))
        : -1;

      await addDoc(collection(db, 'homeSliders'), {
        title: formData.title.trim(),
        imageUrl: imageUrl,
        link: formData.link.trim() || null,
        position: maxPosition + 1,
        isActive: formData.isActive,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast({
        title: '成功',
        description: 'スライダーを追加しました'
      });

      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error('スライダー追加エラー:', error);
      toast({
        title: 'エラー',
        description: 'スライダーの追加に失敗しました',
        variant: 'destructive'
      });
    }
  };

  // スライダー編集
  const handleEditSlider = async () => {
    if (!selectedSlider) return;

    if (!formData.title.trim()) {
      toast({
        title: 'エラー',
        description: 'タイトルを入力してください',
        variant: 'destructive'
      });
      return;
    }

    try {
      // 新しい画像がアップロードされた場合
      let imageUrl = formData.imageUrl;
      if (imageFile) {
        const uploadedUrl = await uploadImage();
        if (!uploadedUrl) return;
        imageUrl = uploadedUrl;
      }

      await updateDoc(doc(db, 'homeSliders', selectedSlider.id), {
        title: formData.title.trim(),
        imageUrl: imageUrl,
        link: formData.link.trim() || null,
        position: formData.position,
        isActive: formData.isActive,
        updatedAt: serverTimestamp()
      });

      toast({
        title: '成功',
        description: 'スライダーを更新しました'
      });

      setShowEditModal(false);
      resetForm();
    } catch (error) {
      console.error('スライダー更新エラー:', error);
      toast({
        title: 'エラー',
        description: 'スライダーの更新に失敗しました',
        variant: 'destructive'
      });
    }
  };

  // スライダー削除
  const handleDeleteSlider = async () => {
    if (!selectedSlider) return;

    try {
      await deleteDoc(doc(db, 'homeSliders', selectedSlider.id));

      toast({
        title: '成功',
        description: 'スライダーを削除しました'
      });

      setShowDeleteModal(false);
      setSelectedSlider(null);
    } catch (error) {
      console.error('スライダー削除エラー:', error);
      toast({
        title: 'エラー',
        description: 'スライダーの削除に失敗しました',
        variant: 'destructive'
      });
    }
  };

  // 表示/非表示切り替え
  const toggleSliderActive = async (slider) => {
    try {
      await updateDoc(doc(db, 'homeSliders', slider.id), {
        isActive: !slider.isActive,
        updatedAt: serverTimestamp()
      });

      toast({
        title: '成功',
        description: `スライダーを${!slider.isActive ? '表示' : '非表示'}にしました`
      });
    } catch (error) {
      console.error('表示切り替えエラー:', error);
      toast({
        title: 'エラー',
        description: '表示状態の変更に失敗しました',
        variant: 'destructive'
      });
    }
  };

  // スライダーを上に移動
  const moveSliderUp = async (slider, currentIndex) => {
    if (currentIndex === 0) return; // 既に一番上
    
    try {
      const prevSlider = sliders[currentIndex - 1];
      const batch = writeBatch(db);
      
      // 位置を入れ替え
      batch.update(doc(db, 'homeSliders', slider.id), {
        position: prevSlider.position,
        updatedAt: serverTimestamp()
      });
      
      batch.update(doc(db, 'homeSliders', prevSlider.id), {
        position: slider.position,
        updatedAt: serverTimestamp()
      });
      
      await batch.commit();
      
      toast({
        title: '成功',
        description: 'スライダーを上に移動しました'
      });
    } catch (error) {
      console.error('並び替えエラー:', error);
      toast({
        title: 'エラー',
        description: '並び替えに失敗しました',
        variant: 'destructive'
      });
    }
  };

  // スライダーを下に移動
  const moveSliderDown = async (slider, currentIndex) => {
    if (currentIndex === sliders.length - 1) return; // 既に一番下
    
    try {
      const nextSlider = sliders[currentIndex + 1];
      const batch = writeBatch(db);
      
      // 位置を入れ替え
      batch.update(doc(db, 'homeSliders', slider.id), {
        position: nextSlider.position,
        updatedAt: serverTimestamp()
      });
      
      batch.update(doc(db, 'homeSliders', nextSlider.id), {
        position: slider.position,
        updatedAt: serverTimestamp()
      });
      
      await batch.commit();
      
      toast({
        title: '成功',
        description: 'スライダーを下に移動しました'
      });
    } catch (error) {
      console.error('並び替えエラー:', error);
      toast({
        title: 'エラー',
        description: '並び替えに失敗しました',
        variant: 'destructive'
      });
    }
  };

  // フォームリセット
  const resetForm = () => {
    setFormData({
      title: '',
      imageUrl: '',
      link: '',
      position: 0,
      isActive: true
    });
    setImageFile(null);
    setImagePreview('');
    setSelectedSlider(null);
  };

  // 編集モーダルを開く
  const openEditModal = (slider) => {
    setSelectedSlider(slider);
    setFormData({
      title: slider.title || '',
      imageUrl: slider.imageUrl || '',
      link: slider.link || '',
      position: slider.position || 0,
      isActive: slider.isActive !== false
    });
    setImagePreview(slider.imageUrl || '');
    setShowEditModal(true);
  };

  // 削除モーダルを開く
  const openDeleteModal = (slider) => {
    setSelectedSlider(slider);
    setShowDeleteModal(true);
  };

  if (loading) {
    return (
      <AdminPageContainer>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-pink-500 border-r-transparent mb-4"></div>
            <p className="text-gray-600 font-medium">読み込み中...</p>
          </div>
        </div>
      </AdminPageContainer>
    );
  }

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="ホームスライダー管理"
        description="ホームページの横型スライダー画像を管理"
        icon={ImageIcon}
        actions={
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-pink-600 rounded-xl text-white hover:from-pink-600 hover:to-pink-700 transition-all shadow-md hover:shadow-lg"
            data-testid="button-add-slider"
          >
            <Plus className="w-4 h-4" />
            <span className="font-medium">スライダー追加</span>
          </motion.button>
        }
      />

      {/* スライダー一覧 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {sliders.map((slider, index) => (
            <motion.div
              key={slider.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -4 }}
              className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
              data-testid={`slider-card-${slider.id}`}
            >
              {/* 画像プレビュー */}
              <div className="relative aspect-video bg-gray-100">
                <img
                  src={slider.imageUrl}
                  alt={slider.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src = '/logo192.png';
                  }}
                />
                
                {/* 表示/非表示バッジ */}
                <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold ${
                  slider.isActive 
                    ? 'bg-green-100 text-green-800 border border-green-300' 
                    : 'bg-gray-100 text-gray-800 border border-gray-300'
                }`}>
                  {slider.isActive ? '表示中' : '非表示'}
                </div>

                {/* 並び順バッジと並び替えボタン */}
                <div className="absolute top-3 left-3 flex items-center space-x-2">
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center font-bold text-gray-900 shadow-md">
                    {index + 1}
                  </div>
                  
                  {/* 並び替えボタン */}
                  <div className="flex flex-col space-y-1">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => moveSliderUp(slider, index)}
                      disabled={index === 0}
                      className={`w-6 h-6 rounded-full flex items-center justify-center shadow-md transition-colors ${
                        index === 0
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-white text-gray-700 hover:bg-pink-100 hover:text-pink-600'
                      }`}
                      data-testid={`button-move-up-${slider.id}`}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => moveSliderDown(slider, index)}
                      disabled={index === sliders.length - 1}
                      className={`w-6 h-6 rounded-full flex items-center justify-center shadow-md transition-colors ${
                        index === sliders.length - 1
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-white text-gray-700 hover:bg-pink-100 hover:text-pink-600'
                      }`}
                      data-testid={`button-move-down-${slider.id}`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </motion.button>
                  </div>
                </div>
              </div>

              {/* コンテンツ */}
              <div className="p-4">
                <h3 className="font-bold text-gray-900 mb-2 truncate" data-testid={`slider-title-${slider.id}`}>
                  {slider.title || 'タイトルなし'}
                </h3>
                
                {slider.link && (
                  <div className="flex items-center space-x-1 text-xs text-gray-500 mb-3">
                    <ExternalLink className="w-3 h-3" />
                    <span className="truncate">{slider.link}</span>
                  </div>
                )}

                {/* アクション */}
                <div className="flex items-center space-x-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleSliderActive(slider)}
                    className={`flex-1 flex items-center justify-center space-x-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      slider.isActive
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                    data-testid={`button-toggle-${slider.id}`}
                  >
                    {slider.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    <span>{slider.isActive ? '非表示' : '表示'}</span>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => openEditModal(slider)}
                    className="flex items-center justify-center w-10 h-10 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                    data-testid={`button-edit-${slider.id}`}
                  >
                    <Edit className="w-4 h-4" />
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => openDeleteModal(slider)}
                    className="flex items-center justify-center w-10 h-10 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                    data-testid={`button-delete-${slider.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 空の状態 */}
      {sliders.length === 0 && (
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ImageIcon className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">スライダーがありません</h3>
          <p className="text-gray-500 mb-6">新しいスライダーを追加してください</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-pink-600 rounded-xl text-white hover:from-pink-600 hover:to-pink-700 transition-all shadow-md hover:shadow-lg font-medium"
          >
            <Plus className="w-5 h-5" />
            <span>最初のスライダーを追加</span>
          </motion.button>
        </div>
      )}

      {/* 追加モーダル */}
      <Dialog open={showAddModal} onOpenChange={(open) => {
        setShowAddModal(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">スライダー追加</DialogTitle>
            <DialogDescription className="text-gray-500">
              新しいスライダー画像を追加します
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 画像アップロード */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                画像 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                {imagePreview ? (
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100 mb-2">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview('');
                      }}
                      className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-pink-500 transition-colors bg-gray-50">
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500">クリックして画像を選択</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* タイトル */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                タイトル <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="スライダーのタイトル"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                data-testid="input-title"
              />
            </div>

            {/* リンク */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                リンク（オプション）
              </label>
              <input
                type="url"
                value={formData.link}
                onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                placeholder="https://example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                data-testid="input-link"
              />
            </div>

            {/* 表示/非表示 */}
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                data-testid="checkbox-active"
              />
              <label htmlFor="isActive" className="text-sm font-semibold text-gray-700">
                すぐに表示する
              </label>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setShowAddModal(false);
                resetForm();
              }}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              data-testid="button-cancel-add"
            >
              キャンセル
            </button>
            <button
              onClick={handleAddSlider}
              disabled={isUploading}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-lg hover:from-pink-600 hover:to-pink-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="button-confirm-add"
            >
              {isUploading ? '追加中...' : '追加'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 編集モーダル */}
      <Dialog open={showEditModal} onOpenChange={(open) => {
        setShowEditModal(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">スライダー編集</DialogTitle>
            <DialogDescription className="text-gray-500">
              スライダー情報を編集します
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 画像アップロード */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                画像
              </label>
              <div className="relative">
                {imagePreview ? (
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100 mb-2">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(selectedSlider?.imageUrl || '');
                      }}
                      className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-pink-500 transition-colors bg-gray-50">
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500">クリックして画像を変更</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* タイトル */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                タイトル <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="スライダーのタイトル"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                data-testid="input-edit-title"
              />
            </div>

            {/* リンク */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                リンク（オプション）
              </label>
              <input
                type="url"
                value={formData.link}
                onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                placeholder="https://example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                data-testid="input-edit-link"
              />
            </div>

            {/* 並び順 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                並び順
              </label>
              <input
                type="number"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: parseInt(e.target.value) || 0 })}
                min="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                data-testid="input-edit-position"
              />
            </div>

            {/* 表示/非表示 */}
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="isActiveEdit"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                data-testid="checkbox-edit-active"
              />
              <label htmlFor="isActiveEdit" className="text-sm font-semibold text-gray-700">
                表示する
              </label>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setShowEditModal(false);
                resetForm();
              }}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              data-testid="button-cancel-edit"
            >
              キャンセル
            </button>
            <button
              onClick={handleEditSlider}
              disabled={isUploading}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-lg hover:from-pink-600 hover:to-pink-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="button-confirm-edit"
            >
              {isUploading ? '更新中...' : '更新'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 削除確認モーダル */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">スライダーを削除</DialogTitle>
            <DialogDescription className="text-gray-500">
              本当にこのスライダーを削除しますか？この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>

          {selectedSlider && (
            <div className="py-4">
              <div className="aspect-video rounded-lg overflow-hidden bg-gray-100 mb-3">
                <img
                  src={selectedSlider.imageUrl}
                  alt={selectedSlider.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-sm font-semibold text-gray-900">{selectedSlider.title}</p>
            </div>
          )}

          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setShowDeleteModal(false);
                setSelectedSlider(null);
              }}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              data-testid="button-cancel-delete"
            >
              キャンセル
            </button>
            <button
              onClick={handleDeleteSlider}
              className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
              data-testid="button-confirm-delete"
            >
              削除
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminPageContainer>
  );
};

export default HomeSliderManagement;
