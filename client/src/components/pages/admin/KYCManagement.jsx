import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  Download,
  RefreshCw,
  FileText,
  User,
  X,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminStatsCard,
  AdminContentCard,
  AdminTableContainer,
  AdminEmptyState,
  AdminLoadingState
} from './AdminPageContainer';
import { db } from '../../../firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '../../../hooks/use-toast';

const AnimatedNumber = ({ value, duration = 2 }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime;
    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = (currentTime - startTime) / (duration * 1000);
      
      if (progress < 1) {
        setDisplayValue(Math.floor(value * progress));
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span>{displayValue.toLocaleString()}</span>;
};

export default function KYCManagement() {
  const { toast } = useToast();
  const [applications, setApplications] = useState([]);
  const [filteredApplications, setFilteredApplications] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    needsReview: 0
  });

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const statusOptions = [
    { value: 'all', label: 'すべて' },
    { value: 'pending', label: '審査待ち' },
    { value: 'under_review', label: '審査中' },
    { value: 'approved', label: '承認済み' },
    { value: 'rejected', label: '却下' },
    { value: 'needs_info', label: '追加情報必要' }
  ];

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = () => {
    setLoading(true);
    
    const q = query(collection(db, 'creatorApplications'), orderBy('submittedAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const applicationsData = snapshot.docs.map(doc => {
        const data = doc.data();
        const submittedDate = data.submittedAt?.toDate?.() || new Date();
        const reviewedDate = data.reviewedAt?.toDate?.() || null;
        
        return {
          id: doc.id,
          userId: data.userId,
          userName: data.userName || '名前なし',
          email: data.email || '',
          furiganaFamily: data.furiganaFamily || '',
          furiganaFirst: data.furiganaFirst || '',
          address: data.address || '',
          dob: data.dob || '',
          contentKind: data.contentKind || '',
          phoneNumber: data.phoneNumber || '',
          documents: data.documents || null,
          status: data.status || 'pending',
          submittedDate: submittedDate.toISOString().split('T')[0],
          reviewedDate: reviewedDate ? reviewedDate.toISOString().split('T')[0] : null,
          reviewedBy: data.reviewedBy || null,
          rejectionReason: data.rejectionReason || '',
          documentType: 'クリエイター登録申請',
          notes: data.rejectionReason || ''
        };
      });
      
      setApplications(applicationsData);
      setFilteredApplications(applicationsData);
      
      const newStats = {
        total: applicationsData.length,
        pending: applicationsData.filter(app => app.status === 'pending').length,
        approved: applicationsData.filter(app => app.status === 'approved').length,
        rejected: applicationsData.filter(app => app.status === 'rejected').length,
        needsReview: applicationsData.filter(app => app.status === 'under_review' || app.status === 'needs_info').length
      };
      
      setStats(newStats);
      setLoading(false);
    }, (error) => {
      console.error('Error loading creator applications:', error);
      setLoading(false);
      toast({
        title: 'エラー',
        description: 'クリエイター申請データの読み込みに失敗しました',
        variant: 'destructive'
      });
    });

    return unsubscribe;
  };


  const handleApproveApplication = async (application) => {
    setIsProcessing(true);
    try {
      const applicationRef = doc(db, 'creatorApplications', application.id);
      await updateDoc(applicationRef, {
        status: 'approved',
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      if (application.userId) {
        const userRef = doc(db, 'users', application.userId);
        await updateDoc(userRef, {
          isCreator: true,
          creatorStatus: 'approved',
          kycStatus: 'approved',
          isVerified: true,
          updatedAt: serverTimestamp()
        });
      }

      toast({
        title: '成功',
        description: `${application.userName}のクリエイター申請を承認しました`,
      });
      
      setDetailModalOpen(false);
    } catch (error) {
      console.error('Error approving application:', error);
      toast({
        title: 'エラー',
        description: 'クリエイター承認処理に失敗しました',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectApplication = async (application) => {
    const reason = prompt('却下理由を入力してください：');
    if (!reason) return;

    setIsProcessing(true);
    try {
      const applicationRef = doc(db, 'creatorApplications', application.id);
      await updateDoc(applicationRef, {
        status: 'rejected',
        rejectionReason: reason,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      if (application.userId) {
        const userRef = doc(db, 'users', application.userId);
        await updateDoc(userRef, {
          isCreator: false,
          creatorStatus: 'rejected',
          kycStatus: 'rejected',
          isVerified: false,
          updatedAt: serverTimestamp()
        });
      }

      toast({
        title: '成功',
        description: `${application.userName}のクリエイター申請を却下しました`,
      });
      
      setDetailModalOpen(false);
    } catch (error) {
      console.error('Error rejecting application:', error);
      toast({
        title: 'エラー',
        description: 'クリエイター却下処理に失敗しました',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const openDetailModal = (application) => {
    setSelectedApplication(application);
    setDetailModalOpen(true);
  };

  useEffect(() => {
    let filtered = [...applications];

    if (searchTerm) {
      filtered = filtered.filter(app =>
        app.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.userId.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(app => app.status === filterStatus);
    }

    setFilteredApplications(filtered);
  }, [applications, searchTerm, filterStatus]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      loadApplications();
      setIsRefreshing(false);
    }, 1000);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'text-green-600 bg-green-100';
      case 'rejected': return 'text-red-600 bg-red-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'under_review': return 'text-blue-600 bg-blue-100';
      case 'needs_info': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'under_review': return <Eye className="w-4 h-4" />;
      case 'needs_info': return <AlertTriangle className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  if (loading) {
    return <AdminLoadingState message="KYC申請データを読み込み中..." />;
  }

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="KYC管理"
        description="本人確認書類の審査・承認を管理します"
        icon={Shield}
        actions={
          <>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
              data-testid="button-refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="font-medium">更新</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-pink-600 rounded-xl text-white hover:from-pink-600 hover:to-pink-700 transition-all shadow-md hover:shadow-lg"
              data-testid="button-export"
            >
              <Download className="w-4 h-4" />
              <span className="font-medium">レポート出力</span>
            </motion.button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <AdminStatsCard
          title="総申請数"
          value={<AnimatedNumber value={stats.total} />}
          icon={FileText}
          color="blue"
        />
        <AdminStatsCard
          title="審査待ち"
          value={<AnimatedNumber value={stats.pending} />}
          icon={Clock}
          color="orange"
        />
        <AdminStatsCard
          title="承認済み"
          value={<AnimatedNumber value={stats.approved} />}
          icon={CheckCircle}
          color="green"
        />
        <AdminStatsCard
          title="却下"
          value={<AnimatedNumber value={stats.rejected} />}
          icon={XCircle}
          color="red"
        />
        <AdminStatsCard
          title="要確認"
          value={<AnimatedNumber value={stats.needsReview} />}
          icon={AlertTriangle}
          color="pink"
        />
      </div>

      <AdminContentCard title="検索・フィルター">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="申請者を検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                data-testid="input-search"
              />
            </div>
          </div>

          <div className="md:w-56">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              data-testid="select-status"
            >
              {statusOptions.map(status => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </AdminContentCard>

      <AdminTableContainer>
        {filteredApplications.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  申請者
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  書類種別
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ステータス
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  申請日
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  審査日
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  備考
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredApplications.map((app, index) => (
                <motion.tr
                  key={app.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className="hover:bg-pink-50 transition-colors"
                  data-testid={`row-application-${app.id}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center text-white font-semibold ring-2 ring-pink-100">
                          {app.userName.charAt(0)}
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-semibold text-gray-900">
                          {app.userName}
                        </div>
                        <div className="text-sm text-gray-500">{app.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <FileText className="w-4 h-4 mr-2 text-gray-400" />
                      {app.documentType}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex items-center space-x-1 text-xs leading-5 font-semibold rounded-full ${getStatusColor(app.status)}`}>
                      {getStatusIcon(app.status)}
                      <span>{statusOptions.find(s => s.value === app.status)?.label || app.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(app.submittedDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {app.reviewedDate ? formatDate(app.reviewedDate) : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {app.notes || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => openDetailModal(app)}
                        className="flex items-center space-x-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                        data-testid={`button-detail-${app.id}`}
                      >
                        <Eye className="w-3 h-3" />
                        <span>詳細</span>
                      </motion.button>
                      {app.status !== 'approved' && app.status !== 'rejected' && (
                        <>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleApproveApplication(app)}
                            disabled={isProcessing}
                            className="flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
                            data-testid={`button-approve-${app.id}`}
                          >
                            <CheckCircle className="w-3 h-3" />
                            <span>承認</span>
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleRejectApplication(app)}
                            disabled={isProcessing}
                            className="flex items-center space-x-1 px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                            data-testid={`button-reject-${app.id}`}
                          >
                            <XCircle className="w-3 h-3" />
                            <span>却下</span>
                          </motion.button>
                        </>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        ) : (
          <AdminEmptyState
            icon={Shield}
            title="申請が見つかりません"
            description="検索条件を変更してください"
          />
        )}
      </AdminTableContainer>

      {/* 詳細モーダル */}
      <AnimatePresence>
        {detailModalOpen && selectedApplication && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setDetailModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
              data-testid="modal-kyc-detail"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Shield className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">KYC申請詳細</h3>
                </div>
                <button
                  onClick={() => setDetailModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  data-testid="button-close-detail-modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* 申請者情報 */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                    <User className="w-4 h-4" />
                    <span>申請者情報</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">氏名</div>
                      <div className="font-medium text-gray-900">{selectedApplication.userName}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">メールアドレス</div>
                      <div className="font-medium text-gray-900">{selectedApplication.email}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">ユーザーID</div>
                      <div className="font-medium text-gray-900">{selectedApplication.userId}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">ステータス</div>
                      <span className={`inline-flex items-center space-x-1 px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedApplication.status)}`}>
                        {getStatusIcon(selectedApplication.status)}
                        <span>{statusOptions.find(s => s.value === selectedApplication.status)?.label}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* 書類情報 */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                    <FileText className="w-4 h-4" />
                    <span>提出書類</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">書類種別</div>
                      <div className="font-medium text-gray-900">{selectedApplication.documentType}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">申請日</div>
                      <div className="font-medium text-gray-900">{formatDate(selectedApplication.submittedDate)}</div>
                    </div>
                    {selectedApplication.reviewedDate && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">審査日</div>
                        <div className="font-medium text-gray-900">{formatDate(selectedApplication.reviewedDate)}</div>
                      </div>
                    )}
                    {selectedApplication.reviewedBy && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">審査者</div>
                        <div className="font-medium text-gray-900">{selectedApplication.reviewedBy}</div>
                      </div>
                    )}
                  </div>
                  
                  {/* アップロードされた書類 */}
                  {selectedApplication.documents && (
                    <div className="mt-4 space-y-3">
                      <div className="text-xs text-gray-500 mb-2">アップロードされた書類</div>
                      {selectedApplication.documents.identityDocument && (
                        <a
                          href={`/api/proxy/.private/${selectedApplication.documents.identityDocument.split('/').pop()}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all group"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                              <FileText className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">身分証明書</div>
                              <div className="text-xs text-gray-500">クリックして表示</div>
                            </div>
                          </div>
                          <Download className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                        </a>
                      )}
                      {selectedApplication.documents.selfieWithID && (
                        <a
                          href={`/api/proxy/.private/${selectedApplication.documents.selfieWithID.split('/').pop()}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 bg-white border border-pink-200 rounded-lg hover:bg-pink-50 hover:border-pink-300 transition-all group"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-pink-100 rounded-lg group-hover:bg-pink-200 transition-colors">
                              <User className="w-4 h-4 text-pink-600" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">身分証を持ったセルフィー</div>
                              <div className="text-xs text-gray-500">本人確認写真</div>
                            </div>
                          </div>
                          <Download className="w-4 h-4 text-gray-400 group-hover:text-pink-600 transition-colors" />
                        </a>
                      )}
                      {selectedApplication.documents.addressProof && (
                        <a
                          href={`/api/proxy/.private/${selectedApplication.documents.addressProof.split('/').pop()}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all group"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                              <FileText className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">住所確認書類</div>
                              <div className="text-xs text-gray-500">クリックして表示</div>
                            </div>
                          </div>
                          <Download className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* 備考 */}
                {selectedApplication.notes && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">備考</h4>
                    <p className="text-sm text-gray-700">{selectedApplication.notes}</p>
                  </div>
                )}

                {/* アクションボタン */}
                {selectedApplication.status !== 'approved' && selectedApplication.status !== 'rejected' && (
                  <div className="flex space-x-3 pt-4 border-t border-gray-200">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        handleApproveApplication(selectedApplication);
                        setDetailModalOpen(false);
                      }}
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50"
                      data-testid="button-approve-modal"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>{isProcessing ? '処理中...' : '承認する'}</span>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        handleRejectApplication(selectedApplication);
                        setDetailModalOpen(false);
                      }}
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all disabled:opacity-50"
                      data-testid="button-reject-modal"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>{isProcessing ? '処理中...' : '却下する'}</span>
                    </motion.button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminPageContainer>
  );
}
