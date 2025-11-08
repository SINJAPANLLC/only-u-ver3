import React, { useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UnreadMessagesProvider } from './context/UnreadMessagesContext';
import { UserStatsProvider } from './context/UserStatsContext';
import { CreatorProvider } from './context/CreatorContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';

// 年齢確認は遅延読み込みしない（最初に必要）
import AgeVerification from './components/pages/AgeVerification';

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
    <div className="text-center">
      <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-pink-500 border-r-transparent"></div>
      <p className="mt-4 text-pink-600 font-medium">読み込み中...</p>
    </div>
  </div>
);

// 主要ページの遅延読み込み
const Home = lazy(() => import('./components/pages/Home'));
const SearchPage = lazy(() => import('./components/pages/SearchPage'));
const SocialFeedScreen = lazy(() => import('./components/pages/feed'));
const SwipeMatchPage = lazy(() => import('./components/pages/SwipeMatchPage'));
const RankingPage = lazy(() => import('./components/pages/RankingPage'));
const VideoPage = lazy(() => import('./components/pages/VideoPage'));
const ImagePage = lazy(() => import('./components/pages/ImagePage'));
const LandingPage = lazy(() => import('./components/pages/LandingPage'));

// プロフィール・アカウント関連
const AccountPage = lazy(() => import('./components/pages/AccountPage'));
const LoggedInAccountPage = lazy(() => import('./components/pages/LoggedInAccount'));
const ProfilePage = lazy(() => import('./components/pages/ProfilePage'));
const EditProfilePage = lazy(() => import('./components/pages/EditProfilePage'));

// 認証関連
const MyFansLogin = lazy(() => import('./Auth/login_page'));
const MyFansSignUp = lazy(() => import('./Auth/sign_up'));

// 投稿・コンテンツ作成
const CreatePostPage = lazy(() => import('./components/pages/CreatePostPage'));
const GenreNavigationSystem = lazy(() => import('./components/pages/Ranking/GenreCategoryList'));
const GenreDataPage = lazy(() => import('./components/pages/GenreDataPage'));

// ライブ配信
const CreateLivePage = lazy(() => import('./components/pages/CreateLivePage'));
const LiveBroadcastPage = lazy(() => import('./components/pages/LiveBroadcastPage'));
const LiveViewerPage = lazy(() => import('./components/pages/LiveViewerPage'));

// 通知・通知一覧
const NotificationPage = lazy(() => import('./components/pages/NotificationPage'));

// いいね・購入履歴
const LikePurchasePage = lazy(() => import('./components/pages/LikePurchedViewPage'));
const PurchaseHistoryPage = lazy(() => import('./components/pages/PurchaseHistoryPage'));

// プラン・支払い
const HighQualityPlanPage = lazy(() => import('./components/pages/HighQualityPlanPage'));
const CurrentPlanPage = lazy(() => import('./components/pages/CurrentPlanPage'));
const PaymentMethodsPage = lazy(() => import('./components/pages/PaymentMethodsPage'));
const CouponListPage = lazy(() => import('./components/pages/CouponListPage'));
const ActivePlansPage = lazy(() => import('./components/pages/ActivePlansPage'));

// クリエイター関連
const RegisterCreatorPage = lazy(() => import('./components/pages/RegisterCreatorPage'));
const CreatorDashboard = lazy(() => import('./components/pages/CreatorDashboard'));
const CreatorRankingPage = lazy(() => import('./components/pages/CreatorRankingPage'));
const MyPostsPage = lazy(() => import('./components/pages/MyPostsPage'));
const PostCommentsPage = lazy(() => import('./components/pages/PostCommentsPage'));
const SalesManagementPage = lazy(() => import('./components/pages/SalesManagementPage'));
const BankAccountRegistrationPage = lazy(() => import('./components/pages/BankAccountRegistrationPage'));
const TransferRequestPage = lazy(() => import('./components/pages/TransferRequestPage'));
const CouponManagementPage = lazy(() => import('./components/pages/CouponManagementPage'));
const CreatorPhoneVerificationPage = lazy(() => import('./components/pages/CreatorPhoneVerificationPage'));
const CreatorRegistrationCompletePage = lazy(() => import('./components/pages/CreatorRegistrationCompletePage'));
const DocumentSubmissionPage = lazy(() => import('./components/pages/DocumentSubmissionPage'));

// 設定関連
const SettingsPage = lazy(() => import('./components/pages/SettingsPage'));
const EmailNotificationSettingsPage = lazy(() => import('./components/pages/EmailNotificationSettingsPage'));
const FollowListPage = lazy(() => import('./components/pages/FollowListPage'));
const BlockedUsersPage = lazy(() => import('./components/pages/BlockedUsersPage'));
const PersonalInfoPage = lazy(() => import('./components/pages/PersonalInfoPage'));
const PhoneVerificationPage = lazy(() => import('./components/pages/PhoneVerificationPage'));
const EmailVerificationPage = lazy(() => import('./components/pages/EmailVerificationPage'));
const HelpPage = lazy(() => import('./components/pages/HelpPage'));
const SwitchAccountPage = lazy(() => import('./components/pages/SwitchAccountPage'));
const LanguageSettings = lazy(() => import('./components/pages/LanguagePage'));

// 法的ページ
const TermsOfUse = lazy(() => import('./components/pages/TermsOfUse'));
const PrivacyPolicy = lazy(() => import('./components/pages/PrivacyPolicy'));
const LegalNotice = lazy(() => import('./components/pages/LegalNotice'));
const ContentGuidelines = lazy(() => import('./components/pages/ContentGuidelines'));

// 管理者関連
const AdminLoginPage = lazy(() => import('./components/pages/AdminLoginPage'));
const AdminLayout = lazy(() => import('./components/pages/admin/AdminLayout'));
const Dashboard = lazy(() => import("./components/pages/admin/Dashboard"));
const Users = lazy(() => import("./components/pages/admin/Users"));
const Creators = lazy(() => import('./components/pages/admin/Creators'));
const Reports = lazy(() => import("./components/pages/admin/Reports"));
const Posts = lazy(() => import("./components/pages/admin/Posts"));
const Sales = lazy(() => import("./components/pages/admin/Sales"));
const Verification = lazy(() => import("./components/pages/admin/Verification"));
const NotificationManagement = lazy(() => import("./components/pages/admin/NotificationManagement"));
const UserManagement = lazy(() => import("./components/pages/admin/UserManagement"));
const AnalyticsDashboard = lazy(() => import("./components/pages/admin/AnalyticsDashboard"));
const PostManagement = lazy(() => import("./components/pages/admin/PostManagement"));
const RevenueManagement = lazy(() => import("./components/pages/admin/RevenueManagement"));
const KYCManagement = lazy(() => import("./components/pages/admin/KYCManagement"));
const PDCAManagement = lazy(() => import("./components/pages/admin/PDCAManagement"));
const CustomerFeedback = lazy(() => import("./components/pages/admin/CustomerFeedback"));
const ABTesting = lazy(() => import("./components/pages/admin/ABTesting"));
const KPIDashboard = lazy(() => import("./components/pages/admin/KPIDashboard"));
const ReportManagement = lazy(() => import("./components/pages/admin/ReportManagement"));
const EmailNotificationManagement = lazy(() => import("./components/pages/admin/EmailNotificationManagement"));
const PushNotificationManagement = lazy(() => import("./components/pages/admin/PushNotificationManagement"));
const FeaturedPickupManagement = lazy(() => import("./components/pages/admin/FeaturedPickupManagement"));
const HomeSliderManagement = lazy(() => import("./components/pages/admin/HomeSliderManagement"));
const TransferRequestManagement = lazy(() => import("./components/pages/admin/TransferRequestManagement"));
const AdminLogin = lazy(() => import("./components/pages/admin/AdminLogin"));

const AccountWrapper = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <LoggedInAccountPage /> : <AccountPage />;
};
// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [isVerified, setIsVerified] = useState(
    localStorage.getItem('ageVerified') === 'true'
  );

  const handleVerification = (verified) => {
    if (verified) {
      setIsVerified(true);
      localStorage.setItem('ageVerified', 'true');
    }
  };

  // If not age verified, show age verification
  if (!isVerified) {
    return <AgeVerification onVerify={handleVerification} />;
  }

  // If age verified but not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If both age verified and authenticated, show the protected content
  return children;
};

// App Routes Component
const AppRoutes = () => {
  const { isAuthenticated } = useAuth();
  const [isVerified, setIsVerified] = useState(
    localStorage.getItem('ageVerified') === 'true'
  );

  const handleVerification = (verified) => {
    if (verified) {
      setIsVerified(true);
      localStorage.setItem('ageVerified', 'true');
    }
  };

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Age verification route */}
        <Route
          path="/age-verification"
          element={<AgeVerification onVerify={handleVerification} />}
        />

      {/* Authentication routes - only accessible if age verified */}
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/home" replace /> :
            !isVerified ? <Navigate to="/age-verification" replace /> :
              <MyFansLogin />
        }
      />
      <Route
        path="/signup"
        element={
          isAuthenticated ? <Navigate to="/home" replace /> :
            !isVerified ? <Navigate to="/age-verification" replace /> :
              <MyFansSignUp />
        }
      />

      {/* Protected routes */}
      <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/feed" element={<ProtectedRoute><SocialFeedScreen /></ProtectedRoute>} />
      <Route path="/rankingpage" element={<ProtectedRoute><RankingPage /></ProtectedRoute>} />
      <Route path="/GenreNavigationSystem" element={<ProtectedRoute><GenreNavigationSystem /></ProtectedRoute>} />
      <Route path="/messages" element={<ProtectedRoute><SwipeMatchPage /></ProtectedRoute>} />
      {/* <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} /> */}
      <Route path="/account" element={<ProtectedRoute><AccountWrapper /></ProtectedRoute>} />
      <Route path="/create-post" element={<ProtectedRoute><CreatePostPage /></ProtectedRoute>} />
      <Route path="/create-live" element={<ProtectedRoute><CreateLivePage /></ProtectedRoute>} />
      <Route path="/live-broadcast/:roomId" element={<ProtectedRoute><LiveBroadcastPage /></ProtectedRoute>} />
      <Route path="/live-viewer/:roomId" element={<ProtectedRoute><LiveViewerPage /></ProtectedRoute>} />
      <Route path="/search" element={<SearchPage />} />

      <Route path="/genre/:genreName" element={<ProtectedRoute><GenreDataPage /></ProtectedRoute>} />
      <Route path="/video/:id" element={<ProtectedRoute><VideoPage /></ProtectedRoute>} />
      <Route path="/profile/:id" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

      <Route path="/added-content/:contentType?" element={<ProtectedRoute><LikePurchasePage /></ProtectedRoute>} />

      <Route path="/notifications" element={<ProtectedRoute><NotificationPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/profile/:userId" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/creator-dashboard" element={<ProtectedRoute><CreatorDashboard /></ProtectedRoute>} />
      <Route path="/terms" element={<TermsOfUse />} /> {/* Add this route */}

      {/* Other legal pages */}
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/legal" element={<LegalNotice />} />
      <Route path="/guidelines" element={<ContentGuidelines />} />
      {/* <Route path="/help" element={<HelpPage />} /> */}
      <Route path="/settings/languages" element={<LanguageSettings />} />
      {/* Default route */}
      <Route path="/subscription" element={<ProtectedRoute><div>Subscription Page</div></ProtectedRoute>} />
      <Route path="/plans" element={<ProtectedRoute><div>Plans Page</div></ProtectedRoute>} />
      <Route path="/high-quality-plan" element={<ProtectedRoute><HighQualityPlanPage /></ProtectedRoute>} />
      <Route path="/current-plan" element={<ProtectedRoute><CurrentPlanPage /></ProtectedRoute>} />
      <Route path="/payment-methods" element={<ProtectedRoute><PaymentMethodsPage /></ProtectedRoute>} />
      <Route path="/purchase-history" element={<ProtectedRoute><PurchaseHistoryPage /></ProtectedRoute>} />
      <Route path="/coupons" element={<ProtectedRoute><CouponListPage /></ProtectedRoute>} />
      <Route path="/creator-ranking" element={<ProtectedRoute><CreatorRankingPage /></ProtectedRoute>} />
      <Route path="/active-plans" element={<ProtectedRoute><ActivePlansPage /></ProtectedRoute>} />
      <Route path="/my-posts" element={<ProtectedRoute><MyPostsPage /></ProtectedRoute>} />
      <Route path="/post-comments" element={<ProtectedRoute><PostCommentsPage /></ProtectedRoute>} />
      <Route path="/sales-management" element={<ProtectedRoute><SalesManagementPage /></ProtectedRoute>} />
      <Route path="/bank-account-registration" element={<ProtectedRoute><BankAccountRegistrationPage /></ProtectedRoute>} />
      <Route path="/transfer-request" element={<ProtectedRoute><TransferRequestPage /></ProtectedRoute>} />
      <Route path="/coupon-management" element={<ProtectedRoute><CouponManagementPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/settings/email-notifications" element={<ProtectedRoute><EmailNotificationSettingsPage /></ProtectedRoute>} />
      <Route path="/settings/follow-list" element={<ProtectedRoute><FollowListPage /></ProtectedRoute>} />
      <Route path="/settings/blocked-users" element={<ProtectedRoute><BlockedUsersPage /></ProtectedRoute>} />
      <Route path="/settings/personal-info" element={<ProtectedRoute><PersonalInfoPage /></ProtectedRoute>} />
      <Route path="/settings/phone-verification" element={<ProtectedRoute><PhoneVerificationPage /></ProtectedRoute>} />
      <Route path="/settings/email-verification" element={<ProtectedRoute><EmailVerificationPage /></ProtectedRoute>} />
      <Route path="/settings/notifications" element={<ProtectedRoute><NotificationPage /></ProtectedRoute>} />
      <Route path="/settings/language" element={<ProtectedRoute><LanguageSettings /></ProtectedRoute>} />
      <Route path="/settings/help" element={<ProtectedRoute><HelpPage /></ProtectedRoute>} />
      <Route path="/amount-available" element={<ProtectedRoute><div>Amount Available Page</div></ProtectedRoute>} />
      {/* <Route path="/register-creator" element={<ProtectedRoute><RegisterCreatorPage /></ProtectedRoute>} /> */}
      <Route path="/register-creator" element={<ProtectedRoute><RegisterCreatorPage /></ProtectedRoute>} />
      <Route path="/referral-program" element={<ProtectedRoute><div>Referral Program Page</div></ProtectedRoute>} />
      <Route path="/switch-account" element={<ProtectedRoute><SwitchAccountPage /></ProtectedRoute>} />
      <Route path="/creator-phone-verification" element={<ProtectedRoute><CreatorPhoneVerificationPage /></ProtectedRoute>} />
      <Route path="/document-submission" element={<ProtectedRoute><DocumentSubmissionPage /></ProtectedRoute>} />
      <Route path="/creator-registration-complete" element={<ProtectedRoute><CreatorRegistrationCompletePage /></ProtectedRoute>} />
      <Route path="/edit-profile" element={<ProtectedRoute><EditProfilePage /></ProtectedRoute>} />
      <Route path="/image/:id" element={<ProtectedRoute><ImagePage /></ProtectedRoute>} />
      <Route path="/lp" element={<LandingPage />} />
      <Route path="/logout" element={<ProtectedRoute><div>Logout Handler</div></ProtectedRoute>} />

      {/* Admin login route */}
      <Route path="/admin/login" element={<AdminLogin />} />
      
      {/* Admin management routes - protected by AdminLayout */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="creators" element={<Creators />} />
                <Route path="reports" element={<ReportManagement />} />
                <Route path="email-notifications" element={<EmailNotificationManagement />} />
                <Route path="push-notifications" element={<PushNotificationManagement />} />
        <Route path="featured-pickup" element={<FeaturedPickupManagement />} />
        <Route path="home-slider" element={<HomeSliderManagement />} />
        <Route path="transfer-requests" element={<TransferRequestManagement />} />
        <Route path="posts" element={<PostManagement />} />
        <Route path="sales" element={<RevenueManagement />} />
        <Route path="verification" element={<KYCManagement />} />
        <Route path="notifications" element={<NotificationManagement />} />
        <Route path="analytics" element={<AnalyticsDashboard />} />
        <Route path="pdca" element={<PDCAManagement />} />
        <Route path="feedback" element={<CustomerFeedback />} />
        <Route path="ab-testing" element={<ABTesting />} />
        <Route path="kpi" element={<KPIDashboard />} />
      </Route>

      <Route
        path="/"
        element={
          isAuthenticated ? <Navigate to="/home" replace /> :
            <LandingPage />
        }
      />
      </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <UnreadMessagesProvider>
          <UserStatsProvider>
            <CreatorProvider>
              <NotificationProvider>
                <Router>
                  <div className="App min-h-screen bg-white dark:bg-black transition-colors duration-300">
                    <AppRoutes />
                  </div>
                </Router>
              </NotificationProvider>
            </CreatorProvider>
          </UserStatsProvider>
        </UnreadMessagesProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
