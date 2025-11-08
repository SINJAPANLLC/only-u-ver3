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
*   **Communication:** Features real-time messaging with image sharing via Bunny CDN, push/email notifications, and complete tip sending via Stripe Payment Intent integration.
*   **Monetization & Payments:** Implements subscription management with true recurring billing via Stripe Subscriptions, flexible payment options, detailed payment calculations, and subscription-based video quality restrictions. Stripe webhooks manage the subscription lifecycle. Modal-based subscription payments enhance user experience.
*   **Dynamic Ranking System:** For creators and posts, featuring period-based filtering and real-time updates with optimized Firestore queries using composite indexes.
*   **Admin and Creator Dashboards:** Provide comprehensive management, analytics, and marketing tools.
*   **Storage & CDN:** Bunny CDN is the primary storage provider for all new uploads, supporting direct file delivery, filename sanitization, and video streaming with range requests. Legacy Firebase Storage data remains accessible but new content defaults to Bunny CDN. Bunny Stream thumbnail fetching with intelligent multi-source fallback (official → high quality → medium → default), automatic retry logic, and proper error handling for processing videos.
*   **Performance Optimization:** Includes React warning fixes, video duration extraction, server-side filtering and pagination, creator information caching, and optimized thumbnail display with fallback logic and automatic generation from videos using HTML5 Canvas API. CDN direct delivery and enhanced cache strategies are implemented.
*   **API & Security:** Unified API error handling, authentication middleware, XSS protection with input sanitization, DoS protection with rate limiting, and comprehensive Content Security Policy (CSP) configuration supporting blob: URLs, data: URIs, Bunny CDN, Google Fonts, Workbox Service Worker, and all necessary third-party resources while maintaining strict security.
*   **Deployment:** Configured for Autoscale with `npm run build` and `npm start`, ensuring reliable path resolution and a health endpoint. VPS deployment (only-u.fun) with PM2 process manager, automatic restart, and environment variable management via ecosystem.config.cjs.
*   **Live Streaming (Complete - Phase 2):** Full TikTok-style live streaming with real-time WebRTC peer-to-peer video streaming. Features include:
    *   **WebSocket Signaling Server:** Integrated into Express.js (server/signaling.ts) for offer/answer/ICE candidate exchange between broadcasters and viewers
    *   **Broadcaster Flow:** LiveBroadcastPage creates RTCPeerConnection per viewer, sends offers proactively when viewers join, handles answers and ICE candidates using React refs to prevent closure issues
    *   **Viewer Flow:** LiveViewerPage receives offers from broadcaster, creates answers, establishes WebRTC connection to receive live video stream. Anonymous viewers supported with stable session-based IDs (anonymousIdRef) for consistent WebRTC pairing
    *   **Real-time Chat:** Firestore-based chat overlay on both broadcaster and viewer interfaces. Chat submission requires login, passive viewing is open to guests
    *   **Viewer Management:** Real-time viewer count updates, connection state monitoring, automatic cleanup on disconnect with proper anonymous ID tracking
    *   **UI Design:** TikTok-style full-screen vertical layout with glassmorphism effects, pink gradients, floating chat overlay, and vertical interaction buttons (like/gift). Responsive design for mobile with optimized layouts for small screens (≤375px)
    *   **UI Integration:** Creator Dashboard LIVE button, RankingPage live room browsing with "参加する" (Join) button
    *   **Security Note:** Authentication/authorization for signaling server required before production deployment to prevent spoofing

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