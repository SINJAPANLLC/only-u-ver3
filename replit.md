# Only-U Fans Platform

## Overview
Only-U is a social media platform designed to connect creators and fans, enabling content monetization and audience engagement. It offers comprehensive features for post management, real-time messaging, a robust payment system with recurring billing, and dynamic content ranking. The platform's core ambition is to become a leading hub for creator-fan interaction, providing advanced tools for creators to effectively monetize their work and build their communities.

## User Preferences
I prefer iterative development with clear communication on changes. Please ask before making major architectural changes or introducing new dependencies. For UI/UX, maintain the consistent pink gradient design. Ensure all interactive elements have `data-testid` attributes for testing purposes.

## System Architecture
The platform utilizes a modern web architecture featuring a React frontend built with Vite, styled using Tailwind CSS, and enhanced with Framer Motion for animations. i18next provides internationalization support. The backend is powered by Express.js. Firebase handles user authentication, real-time messaging, and serves as the NoSQL database (Firestore). Bunny CDN is the primary storage solution for scalable video and image uploads, supporting adult content and ACL-based access controls. Radix UI is used for unstyled, accessible UI components.

**UI/UX Decisions:**
*   A consistent pink gradient design is applied across all interactive elements.
*   The UI incorporates simplified header designs, smooth animations, and is fully responsive.
*   All interactive components include `data-testid` attributes for testing.
*   A comprehensive 3D design system with Glassmorphism and Neumorphism aesthetics, including global design tokens, is implemented.
*   Full dark mode implementation with theme persistence and a dedicated toggle is available.
*   Complete internationalization support, with a focus on the Japanese language, is provided.
*   Layout is optimized for native app-like experience on mobile, addressing viewport and scrolling issues, and supporting safe areas.

**Technical Implementations:**
*   **User Management:** Includes Firebase Phone and Email Authentication, KYC/identity verification for creators, and admin route protection with cryptographic session signing.
*   **Content Management:** Supports image/video posting, likes, comments, subscriber-only content, administrative moderation, and subscription-based content display with blur filters for locked content.
*   **Communication:** Features Tinder-style swipe-match system (`SwipeMatchPage` at `/matching`, with `/messages` redirect for backward compatibility) with horizontal swipe gestures for mutual-like matching. Enhanced UI with full-card cover photo background (with gradient fallback), dynamic text styling for readability, full-size default logo (/logo192.png) fallback, and proper active state in bottom navigation. Real-time messaging (`MessagesUI` at `/chat`) with image sharing via Bunny CDN, push/email notifications, and complete tip sending via Stripe Payment Intent integration. Firestore collections: `userLikes/{userId}/likes/{targetUserId}` for swipe decisions, `matches/{matchId}` for mutual likes with automatic deterministic chatRoomId generation (sorted user IDs joined with underscore) for seamless chat handoff.
*   **Monetization & Payments:** Implements subscription management with true recurring billing via Stripe Subscriptions, flexible payment options, detailed payment calculations, and subscription-based video quality restrictions. Stripe webhooks manage the subscription lifecycle. Modal-based subscription payments enhance user experience.
*   **Dynamic Ranking System:** For creators and posts, featuring period-based filtering and real-time updates with optimized Firestore queries using composite indexes.
*   **Admin Dashboard (Comprehensive Management System):** A complete administrative interface for platform monitoring, moderation, and analytics. All admin pages use production Firestore data (no mock data) and follow consistent UX patterns with toast notifications, modal confirmations, accurate real-time statistics, and comprehensive error handling.
    *   **User Management:** Real-time user statistics (total users, creators, active users, banned users), role management (toggle creator/admin status), user details modal with tabs (profile, stats, posts, subscriptions), ban/unban functionality, and accurate stats computed from local data to ensure consistency.
    *   **Live Stream Management:** Monitor and manage live broadcasts with accurate statistics (total streams, active streams, ended streams, average viewers, average duration). Features include:
        *   **Stream History:** Ended broadcasts are preserved with isActive: false, status: 'ended', and endedAt timestamp for historical tracking
        *   **Filter Functionality:** Tab-based filters (All/Active/Ended) to view current and past broadcasts
        *   **Enhanced Table:** Displays creator info, title, viewer count, start time, and end time for comprehensive audit trail
        *   **Manual Refresh:** Dedicated refresh button with skipLoading flag to keep UI visible while data reloads (spinner in button only, no full-screen loader)
        *   **End/Delete Actions:** End stream with confirmation modal (updates status), delete stream with modal confirmation
        *   **Accurate Statistics:** All stats derived from same local dataset to prevent numerator/denominator mismatches
    *   **Match Management:** Track Tinder-style matches between users with accurate statistics (total matches, today's matches, this week's matches, this month's matches). Displays both users' avatars and names in table rows, delete match with confirmation modal showing both users' details, and optimized local state updates for immediate UI reflection.
    *   **Message Management:** Monitor chat rooms and messages with accurate statistics (total chat rooms, total messages, active chat rooms). Features include chat room list sorted by message count, view messages interface with sender information, delete individual messages with confirmation modal showing message preview (text/image), and message count updates using local state arithmetic (avoiding extra Firestore queries).
    *   **Home Slider Management:** Complete CRUD interface for managing homepage slider images. Features include:
        *   **Real-time Updates:** Firestore onSnapshot listener for live synchronization across all admin sessions
        *   **Image Upload:** Object Storage integration with preview and validation
        *   **Reordering:** Up/down buttons with atomic writeBatch swaps for position changes
        *   **Visibility Toggle:** Quick show/hide controls without deletion
        *   **Image Management:** Add, edit, delete sliders with modal confirmations
        *   **Data Structure:** Firestore `homeSliders` collection with fields: imageUrl, title, link, position, isActive, createdAt, updatedAt
        *   **Frontend Integration:** FeaturedCreators.jsx fetches active sliders (isActive === true) with client-side position sorting and automatic fallback to static images
    *   **Creator Management:** Displays creators from Firestore users collection (isCreator === true) with real-time stats, verification status, and earnings data (no mock data).
    *   **Common Patterns Across Admin Pages:**
        *   **Production Data Only:** All pages use real Firestore data; mock data completely removed from KPIDashboard, KYCManagement, and Creators
        *   **Toast Notifications:** Success/error feedback using shadcn toast component instead of alert/confirm
        *   **Confirmation Modals:** Animated modals with Framer Motion for all destructive actions (delete, ban, end stream)
        *   **Accurate Statistics:** All stats computed from single local dataset (no mixing of Firestore counts with local aggregates) to ensure consistency
        *   **Manual Refresh:** Dedicated refresh button with skipLoading flag to keep UI visible while data reloads (spinner in button only, no full-screen loader)
        *   **Error Resilience:** Promise.allSettled for parallel queries to handle partial Firestore failures gracefully, per-section error states, toast notifications for user feedback
        *   **Optimized Updates:** After mutations, update local state immediately and recompute stats from updated data (no full refetch)
        *   **data-testid Attributes:** All interactive elements include test IDs for automated testing
    *   **Creator Dashboard:** Comprehensive tools for creators including analytics, earnings tracking, content management, and marketing features.
*   **Storage & CDN:** Bunny CDN is the primary storage provider for all new uploads, supporting direct file delivery, filename sanitization, and video streaming with range requests. Legacy Firebase Storage data remains accessible but new content defaults to Bunny CDN. Bunny Stream thumbnail fetching with intelligent multi-source fallback (official → high quality → medium → default), automatic retry logic, and proper error handling for processing videos.
*   **Performance Optimization:** Includes React warning fixes, video duration extraction, server-side filtering and pagination, creator information caching, and optimized thumbnail display with fallback logic and automatic generation from videos using HTML5 Canvas API. CDN direct delivery and enhanced cache strategies are implemented.
*   **API & Security:** Unified API error handling, authentication middleware, XSS protection with input sanitization, DoS protection with rate limiting, and comprehensive Content Security Policy (CSP) configuration supporting blob: URLs, data: URIs, Bunny CDN, Google Fonts, Workbox Service Worker, and all necessary third-party resources while maintaining strict security.
*   **Deployment:** Configured for Autoscale with `npm run build` and `npm start`, ensuring reliable path resolution and a health endpoint. VPS deployment (only-u.fun) with PM2 process manager, automatic restart, and environment variable management via ecosystem.config.cjs.
*   **Live Streaming (Complete - Phase 2):** Full TikTok-style live streaming with real-time WebRTC peer-to-peer video streaming. Features include:
    *   **WebSocket Signaling Server:** Integrated into Express.js (server/signaling.ts) for offer/answer/ICE candidate exchange between broadcasters and viewers
    *   **Broadcaster Flow:** LiveBroadcastPage creates RTCPeerConnection per viewer, sends offers proactively when viewers join, handles answers and ICE candidates using React refs to prevent closure issues. Broadcast end updates room status (isActive: false, status: 'ended', endedAt) instead of deleting, preserving history for admin tracking
    *   **Viewer Flow:** Auto-play integration via useLiveViewer hook in RankingPage. WebRTC connection established automatically without join button. LiveViewerPage receives offers from broadcaster, creates answers, establishes WebRTC connection to receive live video stream. Anonymous viewers supported with stable session-based IDs (anonymousIdRef) for consistent WebRTC pairing. Viewers automatically redirected when broadcast ends (status === 'ended' detection)
    *   **Stream Lifecycle:** Active broadcasts visible to users (isActive === true); ended broadcasts hidden from frontend but preserved in Firestore for admin review and analytics
    *   **Real-time Chat:** Firestore-based chat overlay on both broadcaster and viewer interfaces. Chat submission requires login, passive viewing is open to guests
    *   **Viewer Management:** Real-time viewer count updates, connection state monitoring, automatic cleanup on disconnect with proper anonymous ID tracking
    *   **UI Design:** TikTok-style full-screen vertical layout with glassmorphism effects, pink gradients, floating chat overlay, and vertical interaction buttons (like/gift). Responsive design for mobile with optimized layouts for small screens (≤375px). Default avatar: /logo192.png with proper error fallback
    *   **UI Integration:** Creator Dashboard LIVE button, RankingPage auto-play live streaming without join button (filters for isActive === true)
    *   **Creator Info:** RankingPage fetches creator profiles from users collection with efficient batching for accurate display
    *   **Security Note:** Authentication/authorization for signaling server required before production deployment to prevent spoofing
*   **Tip System:** Complete tip sending via Stripe Checkout with webhook-based creator earnings. Features include:
    *   **Frontend:** Tip modal in RankingPage with preset amounts (¥500-¥10,000)
    *   **Backend:** `/api/create-tip-checkout` endpoint creates Stripe Checkout sessions with metadata
    *   **Webhook:** `checkout.session.completed` event handler processes tips with robust error handling, metadata validation, and idempotency
    *   **Earnings:** Automatic update of creator's availableBalance and totalEarnings (90% to creator, 10% platform fee)
    *   **Records:** Tips stored in `tips` collection, transactions in `transactions` collection for admin tracking

## External Dependencies
*   **Firebase**: Authentication, Firestore (NoSQL database), Realtime Database. Firebase Storage is used for legacy data only.
*   **Bunny CDN**: Primary storage and CDN for all new uploads (zone: onlyu-videos, region: de, hostname: only-u.fun), supporting adult content, multi-resolution video encoding, and automatic thumbnail generation via Bunny Stream.
*   **Stripe**: Payment gateway for subscriptions, transactions, and tip sending.
*   **React**: Frontend UI library.
*   **Vite**: Frontend build tool.
*   **Tailwind CSS**: Styling framework.
*   **Framer Motion**: Animation library.
*   **i18next**: Internationalization framework.
*   **Express.js**: Backend web framework.
*   **Radix UI**: Unstyled, accessible UI component library.