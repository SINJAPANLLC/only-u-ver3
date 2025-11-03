import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Switch } from '@headlessui/react';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { Upload, Image as ImageIcon, Video, X, Check, Sparkles, FileText, Tag, AlertCircle, CheckCircle2 } from 'lucide-react';
import BottomNavigationWithCreator from '../BottomNavigationWithCreator';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { uploadToCloudinary } from '../../config/cloudinary';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ObjectUploader } from '../ObjectUploader';
import { Loader2, AlertTriangle } from 'lucide-react';

function classNames(...classes) {
    return classes.filter(Boolean).join(' ');
}

const CreatePostPage = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const fileInputRef = useRef(null);

    const [isCreator, setIsCreator] = useState(false);
    const [creatorStatus, setCreatorStatus] = useState('');
    const [loading, setLoading] = useState(true);

    // Form state
    const [title, setTitle] = useState('');
    const [explanation, setExplanation] = useState('');
    const [tags, setTags] = useState('');
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [currentStep, setCurrentStep] = useState('');
    const [filesUploaded, setFilesUploaded] = useState(0);

    // Toggle states
    const [schedulePost, setSchedulePost] = useState(false);
    const [publicationPeriod, setPublicationPeriod] = useState(false);
    const [addPlan, setAddPlan] = useState(false);
    const [singlePostSales, setSinglePostSales] = useState(false);
    const [isExclusiveContent, setIsExclusiveContent] = useState(false);
    const [requiredPlanLevel, setRequiredPlanLevel] = useState('basic');
    const [agreements, setAgreements] = useState({
        copyright: false,
        minors: false,
        censored: false,
        guidelines: false,
    });

    // Check creator status on mount
    React.useEffect(() => {
        const checkCreatorStatus = async () => {
            if (!currentUser) {
                navigate('/login');
                return;
            }

            try {
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setIsCreator(userData.isCreator || false);
                    setCreatorStatus(userData.creatorStatus || 'not_applied');
                } else {
                    setCreatorStatus('not_applied');
                }
            } catch (error) {
                console.error('クリエイターステータスの取得エラー:', error);
            } finally {
                setLoading(false);
            }
        };

        checkCreatorStatus();
    }, [currentUser, navigate]);

    const toggleAgreement = (key) => {
        setAgreements((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleFileUpload = (event) => {
        const files = Array.from(event.target.files);
        setUploadedFiles(prev => [...prev, ...files]);
    };

    const handleFileButtonClick = () => {
        fileInputRef.current?.click();
    };

    const removeFile = (index) => {
        setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    };

    // Helper function to get video duration from file
    const getVideoDurationFromFile = (file) => {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            
            video.onloadedmetadata = () => {
                const duration = video.duration;
                const minutes = Math.floor(duration / 60);
                const seconds = Math.floor(duration % 60);
                const formattedDuration = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                resolve(formattedDuration);
                URL.revokeObjectURL(video.src);
            };
            
            video.onerror = () => {
                resolve('00:00');
                URL.revokeObjectURL(video.src);
            };
            
            video.src = URL.createObjectURL(file);
        });
    };

    // Upload files to Replit Object Storage (server-side upload using @replit/object-storage)
    const uploadFilesToObjectStorage = async (files, postId) => {
        console.log(`Object Storage アップロード開始: ${files.length}個のファイル、投稿ID: ${postId}`);
        setCurrentStep(`${files.length}個のファイルをアップロード中...`);
        setFilesUploaded(0);

        const uploadedResults = [];

        // Get Firebase ID token for authentication
        const idToken = await currentUser.getIdToken();

        for (let index = 0; index < files.length; index++) {
            const file = files[index];

            try {
                setCurrentStep(`${file.name}をアップロード中 (${index + 1}/${files.length})`);
                console.log(`アップロード中 ${index + 1}/${files.length}: ${file.name}`);

                // Get video duration before upload (if it's a video)
                let videoDuration = null;
                if (file.type.startsWith('video/')) {
                    try {
                        videoDuration = await getVideoDurationFromFile(file);
                        console.log(`動画の再生時間: ${videoDuration}`);
                    } catch (error) {
                        console.error('動画の再生時間取得エラー:', error);
                    }
                }

                // Upload file directly to server, which uploads to Object Storage
                const formData = new FormData();
                formData.append('file', file);
                formData.append('visibility', isExclusiveContent ? 'private' : 'public');

                const response = await fetch('/api/objects/upload', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${idToken}`,
                    },
                    body: formData,
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'ファイルのアップロードに失敗しました');
                }

                const { objectPath, storageUri, fileName, contentType, size, thumbnailUrl } = await response.json();

                console.log(`ファイル ${index + 1} アップロード成功`);
                console.log('Object Storage Path:', objectPath);
                console.log('Storage URI:', storageUri);
                if (thumbnailUrl) {
                    console.log('Thumbnail URL:', thumbnailUrl);
                }

                // Convert Bunny Stream thumbnail URL to proxy URL to avoid CORS issues
                let proxyThumbnailUrl = thumbnailUrl;
                if (thumbnailUrl && thumbnailUrl.includes('b-cdn.net') && thumbnailUrl.includes('/thumbnail')) {
                    // Extract video GUID from Bunny Stream thumbnail URL
                    // Example: https://vz-524827.b-cdn.net/1c4adc82-0ee4-4b72-9d53-f8fc634277eb/thumbnail.jpg
                    const guidMatch = thumbnailUrl.match(/\/([0-9a-f-]{36})\//i);
                    if (guidMatch) {
                        const videoGuid = guidMatch[1];
                        proxyThumbnailUrl = `/api/bunny-stream-thumbnail/${videoGuid}`;
                        console.log(`🔄 Converted Bunny Stream thumbnail to proxy URL: ${proxyThumbnailUrl}`);
                    }
                }

                // Use objectPath for API references (will be proxied through /api/proxy)
                const uploadResult = {
                    fileName: fileName,
                    url: objectPath,
                    secure_url: objectPath,
                    type: contentType,
                    size: size,
                    source: 'replit-object-storage',
                    resourceType: contentType.startsWith('video/') ? 'video' : 'image',
                    thumbnailUrl: proxyThumbnailUrl || (contentType.startsWith('video/') ? objectPath : null),
                    objectPath: objectPath,
                    storageUri: storageUri, // Store both for reference
                };

                // Add duration if it's a video
                if (videoDuration) {
                    uploadResult.duration = videoDuration;
                }

                uploadedResults.push(uploadResult);

                setFilesUploaded(index + 1);
                const progress = ((index + 1) / files.length) * 100;
                setUploadProgress(progress);

            } catch (error) {
                console.error(`Error uploading file ${index + 1} (${file.name}):`, error);
                throw new Error(`${file.name}のアップロードに失敗: ${error.message}`);
            }
        }

        console.log('全ファイルアップロード完了');
        setCurrentStep('全ファイルアップロード完了');
        return uploadedResults;
    };

    // Keep legacy Cloudinary upload for backward compatibility
    const uploadFilesToCloudinary = async (files, postId) => {
        console.log(t('createPost.messages.startingUpload') + `: ${files.length}個のファイル、投稿ID: ${postId}`);
        setCurrentStep(`${files.length}個のファイルを${t('createPost.messages.uploadingToCloudinary')}`);
        setFilesUploaded(0);

        const uploadedResults = [];

        for (let index = 0; index < files.length; index++) {
            const file = files[index];

            try {
                setCurrentStep(`${file.name}を${t('createPost.messages.uploadingToCloudinary')} (${index + 1}/${files.length})`);
                console.log(`${t('createPost.messages.uploadingFile')} ${index + 1}/${files.length}: ${file.name}`);

                // Get video duration before upload (if it's a video)
                let videoDuration = null;
                if (file.type.startsWith('video/')) {
                    try {
                        videoDuration = await getVideoDurationFromFile(file);
                        console.log(`動画の再生時間: ${videoDuration}`);
                    } catch (error) {
                        console.error('動画の再生時間取得エラー:', error);
                    }
                }

                const uploadResult = await uploadToCloudinary(file);

                if (!uploadResult.success) {
                    throw new Error(uploadResult.error || 'Cloudinaryへのアップロードに失敗しました');
                }

                console.log(`ファイル ${index + 1} ${t('createPost.messages.fileUploadedSuccess')}`);
                console.log('Cloudinary URL:', uploadResult.url);

                const result = {
                    fileName: file.name,
                    url: uploadResult.url,
                    publicId: uploadResult.publicId,
                    format: uploadResult.format,
                    width: uploadResult.width,
                    height: uploadResult.height,
                    bytes: uploadResult.bytes,
                    type: file.type,
                    size: file.size,
                    source: 'cloudinary',
                    resourceType: uploadResult.resourceType,
                    duration: videoDuration || uploadResult.duration || null,
                    fps: uploadResult.fps || null,
                    thumbnailUrl: file.type.startsWith('video/')
                        ? uploadResult.url.replace('/upload/', '/upload/so_auto,w_300,h_300,c_fill,q_auto,f_jpg/')
                        : null
                };

                uploadedResults.push(result);

                setFilesUploaded(index + 1);
                const progress = ((index + 1) / files.length) * 100;
                setUploadProgress(progress);

            } catch (error) {
                console.error(`Error uploading file ${index + 1} (${file.name}) to Cloudinary:`, error);
                throw new Error(`${file.name}のCloudinaryへのアップロードに失敗: ${error.message}`);
            }
        }

        console.log(t('createPost.messages.allFilesUploaded'));
        setCurrentStep(t('createPost.messages.allFilesUploaded'));
        return uploadedResults;
    };

    const handleSubmit = async () => {
        console.log(t('createPost.messages.startingPostCreation'));

        if (!currentUser) {
            alert(t('createPost.messages.pleaseLogin'));
            navigate('/login');
            return;
        }

        console.log('Current user:', {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            isAnonymous: currentUser.isAnonymous
        });

        if (currentUser.isAnonymous) {
            alert(t('createPost.messages.anonymousCannotPost'));
            navigate('/login');
            return;
        }

        if (!explanation.trim()) {
            alert(t('createPost.messages.enterDescription'));
            return;
        }

        if (!agreements.copyright || !agreements.minors || !agreements.censored || !agreements.guidelines) {
            alert(t('createPost.messages.confirmAgreements'));
            return;
        }

        setIsSubmitting(true);
        setUploadProgress(0);
        setCurrentStep(t('createPost.messages.creatingBasicPost'));
        setFilesUploaded(0);

        try {
            console.log(t('createPost.messages.creatingBasicPost'));
            setCurrentStep('投稿詳細を保存中...');

            const basicPostData = {
                userId: currentUser.uid,
                userName: currentUser.displayName || 'Anonymous',
                userEmail: currentUser.email,
                userAvatar: currentUser.photoURL || null,
                title: title.trim() || '無題',
                explanation: explanation.trim(),
                tags: tags.trim(),
                schedulePost,
                publicationPeriod,
                addPlan,
                singlePostSales,
                isExclusiveContent,
                requiredPlanLevel: isExclusiveContent ? requiredPlanLevel : null,
                visibility: isExclusiveContent ? 'private' : 'public',
                agreements,
                fileCount: uploadedFiles.length,
                files: [],
                imageStorage: 'replit-object-storage',
                dataStorage: 'firebase',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                likes: 0,
                comments: 0,
                status: 'published'
            };

            console.log('Post data to save:', basicPostData);

            const docRef = await addDoc(collection(db, 'posts'), basicPostData);
            console.log(t('createPost.messages.basicPostSaved') + ':', docRef.id);
            setCurrentStep(t('createPost.messages.postCreatedSuccess'));

            if (uploadedFiles.length > 0) {
                console.log(t('createPost.messages.attemptingUpload') + `: ${uploadedFiles.length}個のファイル`);
                setCurrentStep('ファイルアップロードの準備中...');

                try {
                    const uploadedFileUrls = await uploadFilesToObjectStorage(uploadedFiles, docRef.id);
                    console.log(t('createPost.messages.filesUploadedSuccess') + ':', uploadedFileUrls);

                    setCurrentStep('投稿を最終化中...');
                    console.log('📝 Firestoreを更新中:', {
                        postId: docRef.id,
                        filesCount: uploadedFileUrls.length,
                        files: uploadedFileUrls
                    });
                    
                    await updateDoc(doc(db, 'posts', docRef.id), {
                        files: uploadedFileUrls,
                        updatedAt: serverTimestamp()
                    });
                    
                    console.log('✅ Firestore更新成功！投稿ID:', docRef.id);
                    console.log(t('createPost.messages.postUpdatedWithFiles'));
                    setCurrentStep(t('createPost.messages.postCreatedSuccess'));

                } catch (fileError) {
                    console.error(t('createPost.messages.fileUploadError') + ':', fileError);
                    alert(`${t('createPost.messages.postCreatedSuccess')}、${t('createPost.messages.fileUploadFailed')}: ${fileError.message}`);
                }
            } else {
                console.log(t('createPost.messages.noFilesToUpload'));
                setCurrentStep(t('createPost.messages.postCreatedSuccess'));
            }

            setShowSuccessModal(true);

            setTitle('');
            setExplanation('');
            setTags('');
            setUploadedFiles([]);
            setSchedulePost(false);
            setPublicationPeriod(false);
            setAddPlan(false);
            setSinglePostSales(false);
            setIsExclusiveContent(false);
            setAgreements({
                copyright: false,
                minors: false,
                censored: false,
                guidelines: false,
            });

        } catch (error) {
            console.error(t('createPost.messages.postCreationFailed') + ':', error);
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                stack: error.stack
            });

            let errorMessage = 'Unknown error occurred';
            if (error.code) {
                switch (error.code) {
                    case 'permission-denied':
                        errorMessage = t('createPost.messages.permissionDenied') + '\n' +
                                     '1. ログインしている\n' +
                                     '2. Firestoreセキュリティルールが投稿作成を許可している\n' +
                                     '3. 認証トークンが有効である';
                        console.error('🔒 権限が拒否されました。ユーザー:', currentUser?.uid);
                        console.error(t('createPost.messages.updateFirestoreRules'));
                        break;
                    case 'unavailable':
                        errorMessage = t('createPost.messages.serviceUnavailable');
                        break;
                    case 'failed-precondition':
                        errorMessage = 'Database rules prevent this operation. Check Firestore security rules.';
                        break;
                    case 'unauthenticated':
                        errorMessage = t('createPost.messages.notAuthenticated');
                        navigate('/login');
                        break;
                    default:
                        errorMessage = `Error: ${error.message}`;
                }
            } else {
                errorMessage = error.message;
            }

            alert(`${t('createPost.messages.errorPublishing')}: ${errorMessage}`);
        } finally {
            setIsSubmitting(false);
            console.log(t('createPost.messages.postCreationFinished'));
        }
    };

    const handleSuccessModalClose = () => {
        setShowSuccessModal(false);
        setUploadProgress(0);
        setCurrentStep('');
        setFilesUploaded(0);
        navigate('/home');
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center"
                >
                    <Loader2 className="w-12 h-12 text-pink-500 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600 font-semibold">読み込み中...</p>
                </motion.div>
            </div>
        );
    }

    // Not creator or not approved
    if (!isCreator || creatorStatus !== 'approved') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl p-8 shadow-xl border-2 border-pink-100 max-w-md w-full"
                >
                    <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        className="flex justify-center mb-6"
                    >
                        <AlertTriangle className="w-16 h-16 text-pink-500" />
                    </motion.div>
                    
                    <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">
                        {creatorStatus === 'pending' ? 'クリエイター申請審査中' : 
                         creatorStatus === 'rejected' ? 'クリエイター申請が却下されました' :
                         '投稿するにはクリエイター登録が必要です'}
                    </h2>
                    
                    <p className="text-gray-600 text-center mb-6">
                        {creatorStatus === 'pending' ? '現在、クリエイター申請を審査中です。承認されるまでお待ちください。' :
                         creatorStatus === 'rejected' ? '申請が却下されました。詳細はサポートにお問い合わせください。' :
                         'コンテンツを投稿するには、まずクリエイターとして登録する必要があります。'}
                    </p>
                    
                    <div className="space-y-3">
                        {creatorStatus === 'not_applied' && (
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => navigate('/register-creator')}
                                className="w-full bg-gradient-to-r from-pink-500 to-pink-600 text-white py-3 rounded-xl font-semibold hover:from-pink-600 hover:to-pink-700 transition-all shadow-md hover:shadow-lg"
                                data-testid="button-register-creator"
                            >
                                クリエイター登録を開始
                            </motion.button>
                        )}
                        
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => navigate('/account')}
                            className="w-full bg-white border-2 border-pink-200 text-pink-600 py-3 rounded-xl font-semibold hover:bg-pink-50 transition-all"
                            data-testid="button-back-to-account"
                        >
                            アカウントページに戻る
                        </motion.button>
                    </div>
                </motion.div>
                <BottomNavigationWithCreator />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-pink-100 pb-24">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="max-w-4xl mx-auto p-4 sm:p-6"
            >
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-8"
                >
                    <motion.div
                        animate={{ 
                            scale: [1, 1.05, 1],
                            rotate: [0, 5, -5, 0]
                        }}
                        transition={{ 
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="inline-block mb-4"
                    >
                        <Sparkles className="w-12 h-12 text-pink-500" />
                    </motion.div>
                    <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-pink-600 bg-clip-text text-transparent mb-2">
                        {t('createPost.title')}
                    </h1>
                    <p className="text-gray-600">素敵なコンテンツを作成しましょう</p>
                </motion.div>

                <div className="space-y-6">
                    {/* File Upload Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white rounded-2xl p-6 shadow-lg border border-pink-100"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-500 rounded-xl flex items-center justify-center">
                                <Upload className="w-5 h-5 text-white" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">{t('createPost.upload.button')}</h2>
                        </div>

                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleFileButtonClick}
                            className="border-2 border-dashed border-pink-300 rounded-2xl p-8 cursor-pointer hover:border-pink-500 hover:bg-pink-50 transition-all group"
                        >
                            <div className="flex flex-col items-center justify-center text-center">
                                <motion.div
                                    animate={{ y: [0, -10, 0] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                                >
                                    <Upload className="w-8 h-8 text-white" />
                                </motion.div>
                                <p className="text-lg font-semibold text-gray-900 mb-2">
                                    クリックして画像や動画をアップロード
                                </p>
                                <p className="text-sm text-gray-500">
                                    または、ここにファイルをドラッグ＆ドロップ
                                </p>
                            </div>
                        </motion.div>
                        
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/*,video/*"
                            onChange={handleFileUpload}
                            className="hidden"
                        />

                        {uploadedFiles.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="mt-6"
                            >
                                <div className="flex items-center gap-2 mb-4">
                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                    <p className="text-sm font-semibold text-gray-700">
                                        {uploadedFiles.length}個のファイルが選択されています
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                    {uploadedFiles.map((file, index) => (
                                        <motion.div
                                            key={index}
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: index * 0.05 }}
                                            className="relative group"
                                        >
                                            <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl overflow-hidden shadow-md">
                                                {file.type.startsWith('image/') ? (
                                                    <img
                                                        src={URL.createObjectURL(file)}
                                                        alt={file.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : file.type.startsWith('video/') ? (
                                                    <div className="relative w-full h-full">
                                                        <video
                                                            src={URL.createObjectURL(file)}
                                                            className="w-full h-full object-cover"
                                                            muted
                                                        />
                                                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                                                            <div className="w-12 h-12 bg-white bg-opacity-90 rounded-full flex items-center justify-center shadow-lg">
                                                                <Video className="w-6 h-6 text-pink-500" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </div>
                                            
                                            {/* Remove button */}
                                            <motion.button
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}
                                                onClick={() => removeFile(index)}
                                                className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-4 h-4" />
                                            </motion.button>
                                            
                                            <div className="mt-2">
                                                <p className="text-xs font-medium text-gray-700 truncate">{file.name}</p>
                                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                                    {file.type.startsWith('image/') ? (
                                                        <ImageIcon className="w-3 h-3" />
                                                    ) : (
                                                        <Video className="w-3 h-3" />
                                                    )}
                                                    <span>{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </motion.div>

                    {/* Title Input Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white rounded-2xl p-6 shadow-lg border border-pink-100"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                                <FileText className="w-5 h-5 text-white" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">タイトル</h2>
                        </div>
                        <input
                            type="text"
                            id="title"
                            placeholder="魅力的なタイトルを入力してください"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full rounded-xl border-2 border-gray-200 p-4 focus:border-pink-500 focus:ring-4 focus:ring-pink-100 transition-all placeholder-gray-400 text-gray-900 font-medium"
                            data-testid="input-title"
                        />
                    </motion.div>

                    {/* Description Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-white rounded-2xl p-6 shadow-lg border border-pink-100"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-500 rounded-xl flex items-center justify-center">
                                <FileText className="w-5 h-5 text-white" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">
                                {t('createPost.explanation')} <span className="text-pink-500">*</span>
                            </h2>
                        </div>
                        <textarea
                            id="explanation"
                            placeholder={t("createPost.placeholder.explanationText")}
                            value={explanation}
                            onChange={(e) => setExplanation(e.target.value)}
                            className="w-full rounded-xl border-2 border-gray-200 p-4 focus:border-pink-500 focus:ring-4 focus:ring-pink-100 transition-all resize-none min-h-[150px] placeholder-gray-400 text-gray-900"
                        />
                    </motion.div>

                    {/* Tags Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="bg-white rounded-2xl p-6 shadow-lg border border-pink-100"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-500 rounded-xl flex items-center justify-center">
                                <Tag className="w-5 h-5 text-white" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">{t('createPost.tags')}</h2>
                        </div>
                        <input
                            type="text"
                            id="tags"
                            placeholder={t("createPost.placeholder.tagsText")}
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            className="w-full rounded-xl border-2 border-gray-200 p-4 focus:border-pink-500 focus:ring-4 focus:ring-pink-100 transition-all placeholder-gray-400 text-gray-900 font-medium"
                        />
                        <p className="text-sm text-gray-500 mt-2">カンマ（,）で区切って複数のタグを追加できます</p>
                    </motion.div>

                    {/* Additional Options */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="bg-white rounded-2xl p-6 shadow-lg border border-pink-100 space-y-4"
                    >
                        <h3 className="text-lg font-bold text-gray-900 mb-4">追加オプション</h3>
                        
                        {/* Exclusive Content Toggle */}
                        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl">
                            <div>
                                <h4 className="font-semibold text-gray-900">{t('createPost.switches.exclusiveContent')}</h4>
                                <p className="text-sm text-gray-600">サブスクライバー限定コンテンツ</p>
                            </div>
                            <Switch
                                checked={isExclusiveContent}
                                onChange={setIsExclusiveContent}
                                className={`${
                                    isExclusiveContent ? 'bg-gradient-to-r from-pink-500 to-purple-500' : 'bg-gray-300'
                                } relative inline-flex h-8 w-14 items-center rounded-full transition-colors`}
                            >
                                <span
                                    className={`${
                                        isExclusiveContent ? 'translate-x-7' : 'translate-x-1'
                                    } inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-md`}
                                />
                            </Switch>
                        </div>
                        
                        {/* Required Plan Level Selection */}
                        <AnimatePresence>
                            {isExclusiveContent && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="overflow-hidden"
                                >
                                    <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200">
                                        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                            <Sparkles className="w-5 h-5 text-purple-500" />
                                            必要プランレベル
                                        </h4>
                                        <div className="space-y-2">
                                            {[
                                                { value: 'basic', label: 'ベーシック', description: 'ベーシックプラン以上で閲覧可能', color: 'from-blue-500 to-cyan-500' },
                                                { value: 'premium', label: 'プレミアム', description: 'プレミアムプラン以上で閲覧可能', color: 'from-purple-500 to-pink-500' },
                                                { value: 'vip', label: 'VIP', description: 'VIPプランのみ閲覧可能', color: 'from-yellow-500 to-orange-500' }
                                            ].map((plan) => (
                                                <motion.div
                                                    key={plan.value}
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    onClick={() => setRequiredPlanLevel(plan.value)}
                                                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                                                        requiredPlanLevel === plan.value
                                                            ? `bg-gradient-to-r ${plan.color} text-white shadow-lg`
                                                            : 'bg-white border-2 border-gray-200 hover:border-gray-300'
                                                    }`}
                                                    data-testid={`plan-level-${plan.value}`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className={`font-bold ${requiredPlanLevel === plan.value ? 'text-white' : 'text-gray-900'}`}>
                                                                {plan.label}
                                                            </p>
                                                            <p className={`text-xs ${requiredPlanLevel === plan.value ? 'text-white/90' : 'text-gray-500'}`}>
                                                                {plan.description}
                                                            </p>
                                                        </div>
                                                        {requiredPlanLevel === plan.value && (
                                                            <motion.div
                                                                initial={{ scale: 0 }}
                                                                animate={{ scale: 1 }}
                                                                className="w-6 h-6 bg-white rounded-full flex items-center justify-center"
                                                            >
                                                                <Check className="w-4 h-4 text-purple-600" />
                                                            </motion.div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {/* Agreements Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        className="bg-white rounded-2xl p-6 shadow-lg border border-pink-100"
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl flex items-center justify-center">
                                <AlertCircle className="w-5 h-5 text-white" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">
                                規約への同意 <span className="text-pink-500">*</span>
                            </h2>
                        </div>
                        
                        <div className="space-y-3">
                            {[
                                { key: 'copyright', label: t('createPost.agreement.copyright') },
                                { key: 'minors', label: t('createPost.agreement.minors') },
                                { key: 'censored', label: t('createPost.agreement.censored') },
                                { key: 'guidelines', label: t('createPost.agreement.guidelines') }
                            ].map((item) => (
                                <motion.div
                                    key={item.key}
                                    whileHover={{ scale: 1.01 }}
                                    className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                        agreements[item.key]
                                            ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300'
                                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                                    }`}
                                    onClick={() => toggleAgreement(item.key)}
                                >
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                                        agreements[item.key]
                                            ? 'bg-gradient-to-br from-green-500 to-emerald-600 shadow-md'
                                            : 'bg-white border-2 border-gray-300'
                                    }`}>
                                        {agreements[item.key] && (
                                            <Check className="w-4 h-4 text-white" />
                                        )}
                                    </div>
                                    <span className={`text-sm font-medium ${
                                        agreements[item.key] ? 'text-gray-900' : 'text-gray-600'
                                    }`}>
                                        {item.label}
                                    </span>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Submit Button */}
                    <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8 }}
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className={`w-full py-5 rounded-2xl font-bold text-lg shadow-xl transition-all flex items-center justify-center gap-3 ${
                            isSubmitting
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-pink-500 via-purple-500 to-pink-600 text-white hover:shadow-2xl hover:from-pink-600 hover:via-purple-600 hover:to-pink-700'
                        }`}
                        data-testid="button-submit"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-6 h-6 animate-spin" />
                                <span>投稿中...</span>
                            </>
                        ) : (
                            <>
                                <Upload className="w-6 h-6" />
                                <span>{t('createPost.publish')}</span>
                            </>
                        )}
                    </motion.button>

                    {/* Footer Information */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.9 }}
                        className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl p-6 border border-pink-200 shadow-md"
                    >
                        <p className="text-sm text-gray-700 font-semibold mb-4">
                            {t('createPost.footerText.thankYou')}
                        </p>
                        
                        <div className="space-y-3 text-sm text-gray-600">
                            <p>
                                <span className="inline-block w-2 h-2 bg-pink-500 rounded-full mr-2"></span>
                                {t('createPost.footerText.lineone')}
                            </p>
                            <p>
                                <span className="inline-block w-2 h-2 bg-pink-500 rounded-full mr-2"></span>
                                {t('createPost.footerText.linetwo')}
                            </p>
                            <p>
                                <span className="inline-block w-2 h-2 bg-pink-500 rounded-full mr-2"></span>
                                {t('createPost.footerText.linethree')}
                            </p>
                            <p>
                                <span className="inline-block w-2 h-2 bg-pink-500 rounded-full mr-2"></span>
                                {t('createPost.footerText.linefour')}
                            </p>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="mt-4 w-full bg-white border-2 border-pink-300 text-pink-600 py-3 rounded-xl font-semibold hover:bg-pink-50 transition-all shadow-sm"
                        >
                            {t('createPost.footerText.buttonclick')}
                        </motion.button>
                    </motion.div>
                </div>
            </motion.div>

            {/* Success Modal */}
            <AnimatePresence>
                {showSuccessModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                        onClick={handleSuccessModalClose}
                    >
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <motion.div
                                animate={{ 
                                    scale: [1, 1.2, 1],
                                    rotate: [0, 360, 360]
                                }}
                                transition={{ duration: 0.6 }}
                                className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg"
                            >
                                <Check className="w-10 h-10 text-white" />
                            </motion.div>
                            
                            <h2 className="text-2xl font-bold text-center text-gray-900 mb-4">
                                投稿が完了しました！
                            </h2>
                            
                            {uploadProgress > 0 && uploadProgress < 100 && (
                                <div className="mb-6">
                                    <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${uploadProgress}%` }}
                                            className="h-full bg-gradient-to-r from-pink-500 to-purple-500"
                                        />
                                    </div>
                                    <p className="text-sm text-gray-600 text-center mt-2">
                                        {currentStep}
                                    </p>
                                </div>
                            )}
                            
                            <p className="text-gray-600 text-center mb-6">
                                あなたの素敵なコンテンツが公開されました
                            </p>
                            
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleSuccessModalClose}
                                className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all"
                            >
                                ホームに戻る
                            </motion.button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Progress Overlay */}
            <AnimatePresence>
                {isSubmitting && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
                    >
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl"
                        >
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full mx-auto mb-6"
                            />
                            
                            <h3 className="text-xl font-bold text-center text-gray-900 mb-4">
                                {currentStep || '処理中...'}
                            </h3>
                            
                            {uploadedFiles.length > 0 && (
                                <>
                                    <div className="bg-gray-200 rounded-full h-3 overflow-hidden mb-3">
                                        <motion.div
                                            animate={{ width: `${uploadProgress}%` }}
                                            className="h-full bg-gradient-to-r from-pink-500 to-purple-500"
                                        />
                                    </div>
                                    <p className="text-sm text-gray-600 text-center">
                                        {filesUploaded}/{uploadedFiles.length} ファイル完了 ({Math.round(uploadProgress)}%)
                                    </p>
                                </>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <BottomNavigationWithCreator />
        </div>
    );
};

export default CreatePostPage;
