# Only-U Fans Platform

## Overview
Only-U is a social media platform connecting creators and fans, focusing on content monetization and audience engagement. It offers post management, real-time messaging, a comprehensive payment system with recurring billing, and dynamic ranking. The platform aims to be a leading hub for creator-fan interaction, providing advanced tools for content creators to monetize their work effectively.

## User Preferences
I prefer iterative development with clear communication on changes. Please ask before making major architectural changes or introducing new dependencies. For UI/UX, maintain the consistent pink gradient design. Ensure all interactive elements have `data-testid` attributes for testing purposes.

## System Architecture
The platform features a modern web architecture: a React frontend built with Vite, styled with Tailwind CSS, and animated with Framer Motion, with i18next for internationalization. The backend uses Express.js. Firebase provides user authentication, real-time messaging, and Firestore as the NoSQL database. Bunny CDN is the primary storage solution for scalable video and image uploads, supporting adult content and ACL-based access controls.

**UI/UX Decisions:**
*   A consistent pink gradient design is applied across all interactive elements.
*   The UI incorporates simplified header designs, smooth animations, and is fully responsive.
*   All interactive components include `data-testid` attributes for testing.
*   The platform features a comprehensive 3D design system with Glassmorphism and Neumorphism aesthetics, including global design tokens for buttons, cards, and shadows.
*   A complete dark mode implementation is available across all pages and components, with theme persistence and a dedicated toggle.
*   Full internationalization support is provided, with a focus on the Japanese language.
*   **Chat Layout Optimization** (November 2025): Fixed gap between message input and bottom navigation by changing main container from `min-h-screen` to `h-screen` with proper flex positioning, ensuring consistent viewport height across all device sizes.

**Technical Implementations:**
*   User management includes authentication and KYC/identity verification for creators.
    - **Phone Number Verification** (implemented): Firebase Phone Authentication with PhoneAuthProvider for existing users, reCAPTCHA verification, SMS code confirmation, updatePhoneNumber to link phone number to authenticated account, Japanese language setting, available for both account settings (`/settings/phone-verification`) and creator registration (`/creator-phone-verification`). **Production Setup Required**: Add Replit domain to Firebase Console → Authentication → Settings → Authorized domains for real SMS delivery.
    - **Email Verification** (implemented): Firebase Email Verification with updateEmail for existing users, automatic verification status checking via polling, email resend functionality, Firestore integration for verification tracking (`/settings/email-verification`)
    - **Authentication Security**: Firebase Auth with reCAPTCHA v2 (configurable: 'normal' for debugging, 'invisible' for production), 3-attempt tracking for code verification, comprehensive error handling for invalid codes/expired sessions/re-authentication requirements
*   Content management supports image/video posting, likes, comments, subscriber-only content, and administrative moderation.
    - **Subscription Content Display** (November 2025): Home page displays subscription-only content with blur filter (`blur-md`) and subscription badge overlay. Locked icon and plan-level badge (VIP/Premium/Basic) indicate required subscription level. Edit Profile page shows plan level information for each subscription plan.
*   Communication features real-time messaging with image sharing (Bunny CDN integration), push/email notifications, and complete tip sending with Stripe Payment Intent integration.
    - **Image Messaging** (November 2025): Users can send images in chat via file selection button, images are uploaded to Bunny CDN with 10MB size limit, preview and cancel functionality, images displayed in chat with click-to-expand, automatic proxy URL conversion for proper rendering
    - **Tip Sending** (November 2025): Full Stripe Payment Intent integration with interactive tip modal (preset amounts ¥500-¥10,000 + custom input), optional message attachment, Stripe Elements for secure card collection, 10% platform fee + 10% tax calculation, backend APIs (`/api/create-tip-payment-intent`, `/api/confirm-tip-payment`), Firestore transaction tracking, creator balance updates
*   Monetization and payments include subscription management with true recurring billing via Stripe Subscriptions, flexible payment options, detailed payment calculations, and subscription-based video quality restrictions. Stripe webhooks are used for secure and automated subscription lifecycle management.
    - **Stripe Recurring Subscriptions** (implemented): Checkout Session API (`mode: 'subscription'`), automatic monthly billing, webhook processing for payment events, subscription cancellation
    - **Modal-Based Subscription Payments** (November 2025): Converted from redirect-based checkout to in-page modal flow using Stripe Subscriptions API. Endpoint `/api/create-subscription-payment-intent` creates/reuses Stripe Subscriptions with `payment_behavior: 'default_incomplete'`, returns client_secret for Stripe Elements integration. Implements incomplete subscription reuse logic to prevent duplicate subscriptions on modal reopen. Requires both `userId` (Firebase UID) and `userEmail` (valid email) for Stripe Customer creation. Webhooks handle subscription lifecycle (invoice.payment_succeeded, customer.subscription.deleted, customer.subscription.updated) with subscriptionID tracking in Firestore for sync.
    - **Subscription-Based Video Quality** (implemented): 720p for free users, 1080p for premium, 4K for VIP/high-quality plan; quality restriction API `/api/video-url/:creatorId/:videoGuid`; Bunny CDN multi-resolution encoding
    - **iFrame Checkout Fix** (November 2025): Stripe Checkout opens in centered popup window (600x800px) with synchronous `window.open()` before async fetch to preserve user activation and avoid popup blockers. Window handle is reused to navigate to Stripe URL on success or closed on error, resolving iframe security restrictions and popup blocking issues in Replit preview environment.
*   A dynamic ranking system for creators and posts includes period-based filtering and real-time updates with optimized Firestore queries.
*   Admin and Creator Dashboards provide comprehensive management, analytics, and marketing tools.
*   Dynamic data display and management from Firestore with real-time listeners.
*   **Bunny CDN Storage** (ACTIVE): Primary storage provider for production, automatically used when BUNNY_STORAGE_API_KEY and BUNNY_STORAGE_ZONE_NAME are set. All new uploads are stored in Bunny CDN (zone: onlyu-videos, region: de). Existing Firebase Storage data remains accessible for backward compatibility.
    - **Upload API** (November 2025): POST `/api/upload` endpoint uploads files directly to Bunny Storage using storageAdapter. Supports multipart/form-data with multer middleware, Firebase authentication required, returns proxy URL for immediate playback.
    - **Storage Zone Direct Access** (November 2025): Uses Bunny Storage API (storage.bunnycdn.com) with AccessKey authentication for reliable file delivery. Proxy route automatically handles authentication and CORS headers for all media files.
    - **Filename Sanitization** (November 2025): All uploaded files are automatically sanitized to ASCII-safe filenames with timestamp prefix, preventing URL encoding issues with non-ASCII characters (e.g., Japanese filenames → `1762100000000-filename.mp4`)
    - **Video Streaming** (November 2025): Proxy route supports HTTP Range requests with 206 Partial Content responses, enabling efficient video streaming from Bunny Storage API
    - **URL Path Correction** (November 2025): Automatic detection and correction of duplicate path segments (e.g., `/api/proxy/public/public/` → `/api/proxy/public/`)
    - **Automatic Migration** (November 2025): Legacy Firebase Storage files are automatically migrated to Bunny CDN on first access via proxy route
*   **Firestore Query Optimization**: Composite indexes created for ranking queries (visibility + isExclusiveContent + createdAt, with optional tags filter). Queries utilize `limit`, `orderBy`, and batching for efficient data retrieval.
*   Unified API error handling is implemented with middleware, an `AppError` hierarchy, and consistent JSON responses.
*   Enhanced security includes authentication middleware, XSS protection with input sanitization, and DoS protection with rate limiting.
    - **Admin Route Protection** (November 2025): All admin endpoints (`/api/admin/*`, `/api/notifications/*`, `/api/featured-*/*`) protected with `verifyAdminToken` middleware using HttpOnly cookies and cryptographic session signing
    - **Initial Admin Setup** (November 2025): One-time admin initialization endpoint (`/api/admin/initialize`) protected by INITIAL_ADMIN_SECRET environment variable, creates first admin user with role='admin' in Firestore
*   Firebase Storage authentication supports service account credentials for secure access.
*   A KYC approval workflow for creators manages status tracking and UI rendering.
*   Video playback is supported with range requests for efficient streaming.
*   **Performance Optimization** (November 2025): React warning fixes, video duration extraction optimization (stored in Firestore), server-side filtering and pagination for RankingPosts with score-based re-sorting, Creators page optimization (limit 100, pagination), UserManagement immediate UI updates after mutations. HOME page vertical cards and creator icons now display actual Firestore data with creator information caching. Ranking posts thumbnail display improved with comprehensive fallback logic (thumbnailUrl/secure_url/url/storageUri) and automatic `/objects/` to `/api/proxy/public/` URL conversion for proper image and video thumbnail rendering. Video thumbnails use first frame display when dedicated thumbnail images are unavailable (video element with preload="metadata").
    - **CDN Direct Delivery** (November 2025): Public files (`public/` prefix) are now served directly from Bunny CDN (`https://{cdnHostname}/{encodedKey}`) bypassing the proxy for maximum performance. Private files continue using `/api/proxy/` for access control. Special characters in filenames are URI-encoded automatically.
    - **Enhanced Cache Strategy** (November 2025): Proxy routes include `Cache-Control: public, max-age=31536000, stale-while-revalidate=86400` headers, allowing browsers to serve stale content while revalidating in the background (24-hour window), improving perceived performance.
    - **Video Thumbnail Optimization** (November 2025): Home page and Ranking page now use Bunny Stream's auto-generated thumbnail images (`thumbnail.jpg`) when available, otherwise display video first frame with `#t=0.001` fragment. Unified thumbnail loading logic prioritizes `thumbnailUrl` (if image file) over video URLs for all content types. HOME page includes automatic fallback from thumbnail images to video elements on error (403/load failures), using `data-video-url` attribute for reliable fallback handling. Ranking page uses `<video>` elements with `preload="metadata"` to display video thumbnails efficiently.
*   Deployment is configured for Autoscale with `npm run build` and `npm start`, ensuring reliable path resolution, a single external port (80), and an `/api/health` endpoint.

## External Dependencies
*   **Firebase**: Authentication, Realtime Database, Firestore. Firebase Storage is used for legacy data only (existing uploads before Bunny CDN activation).
*   **Bunny CDN**: **ACTIVE** - Primary storage and CDN solution for all new uploads (zone: onlyu-videos, region: de, hostname: only-u.fun). Supports adult content, multi-resolution video encoding, and automatic thumbnail generation via Bunny Stream.
*   **Stripe**: Payment gateway for subscriptions and transactions.
*   **React**: Frontend UI library.
*   **Vite**: Frontend build tool.
*   **Tailwind CSS**: Styling framework.
*   **Framer Motion**: Animation library.
*   **i18next**: Internationalization framework.
*   **Express.js**: Backend web framework.
*   **Radix UI**: Unstyled, accessible UI component library.