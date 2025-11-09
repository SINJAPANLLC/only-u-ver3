import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import cookieParser from "cookie-parser";
import Stripe from "stripe";
import crypto from "crypto";
import multer from "multer";
import { ObjectStorageService } from "./objectStorage";
import { storageAdapter } from "./storage-adapter";
import { bunnyStreamClient } from "./bunny-stream";

// Initialize Stripe with secret key from environment variables
// Reference: blueprint:javascript_stripe integration
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-09-30.clover",
    })
  : null;

// Ensure SESSION_SECRET is available (required for secure session tokens)
// Fail fast if SESSION_SECRET is not configured
if (!process.env.SESSION_SECRET) {
  throw new Error('Missing required environment variable: SESSION_SECRET. Admin authentication requires this for secure token signing.');
}
const SESSION_SECRET = process.env.SESSION_SECRET;

// Notifications are now stored in Firestore collection 'notifications'
// Featured pickups are now stored in Firestore collection 'featuredPickups'
// Posts are now stored in Firestore collection 'posts'

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes for the application
  app.use(express.json());
  app.use(cookieParser()); // Required for reading HttpOnly cookies in verifyAdminToken
  
  // Admin authentication middleware (uses HttpOnly cookie with signature verification)
  // Defined early so it can be used by all admin routes
  async function verifyAdminToken(req: any, res: any, next: any) {
    try {
      // Get session token from HttpOnly cookie
      const token = req.cookies?.adminSession;
      
      if (!token) {
        return res.status(401).json({ error: "No session found" });
      }

      // Verify token signature and expiration
      const verifiedSession = verifySecureSessionToken(token);
      if (!verifiedSession) {
        res.clearCookie('adminSession');
        return res.status(401).json({ error: "Invalid or expired session" });
      }

      // Verify email matches admin email
      const adminEmail = process.env.ADMIN_EMAIL || "info@sinjapan.jp";
      if (verifiedSession.email !== adminEmail) {
        res.clearCookie('adminSession');
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Attach admin email to request object
      (req as any).adminEmail = verifiedSession.email;
      next();
    } catch (error) {
      res.clearCookie('adminSession');
      return res.status(401).json({ error: "Invalid session token" });
    }
  }
  
  // Health check endpoint (デプロイのヘルスチェック用)
  // Note: Root (/) is served by static files (index.html) in production
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", message: "Server is running" });
  });

  // Placeholder for user management routes (Admin only)
  app.get("/api/users", verifyAdminToken, async (_req, res) => {
    res.json({ message: "User routes placeholder - MongoDB connection required" });
  });

  // Placeholder for identity verification routes
  app.get("/api/identity", async (_req, res) => {
    res.json({ message: "Identity routes placeholder - MongoDB connection required" });
  });

  // ===== Notification Management Endpoints (Firestore-based) =====
  
  // Get all notifications (Admin用)
  app.get("/api/notifications", verifyAdminToken, async (_req, res) => {
    try {
      const { firestore } = await import('./firebase');
      
      const notificationsSnapshot = await firestore
        .collection('notifications')
        .orderBy('createdAt', 'desc')
        .get();
      
      const notifications = notificationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date()
      }));
      
      res.json(notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });

  // Get user-specific notifications (for home page)
  app.get("/api/notifications/user", async (_req, res) => {
    try {
      const { firestore } = await import('./firebase');
      
      console.log('📬 Fetching user notifications...');
      
      // Firestoreコンポジットインデックス不要な方法：全件取得してクライアント側でフィルタ
      const notificationsSnapshot = await firestore
        .collection('notifications')
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();
      
      console.log(`📦 Found ${notificationsSnapshot.size} notifications in Firestore`);
      
      // クライアント側でtargetフィルタリング
      const userNotifications = notificationsSnapshot.docs
        .map(doc => {
          const data = doc.data() as any;
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date()
          };
        })
        .filter((notification: any) => 
          notification.target === 'all' || notification.target === 'users'
        )
        .slice(0, 50);
      
      console.log(`✅ Returning ${userNotifications.length} user notifications`);
      res.json(userNotifications);
    } catch (error) {
      console.error('❌ Error fetching user notifications:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
      }
      res.json([]); // エラー時は空配列を返す
    }
  });

  // Create a new notification (admin only)
  app.post("/api/notifications", verifyAdminToken, async (req, res) => {
    try {
      console.log('📬 Creating notification with data:', req.body);
      const { type, title, message, target, priority, category } = req.body;

      if (!title || !message) {
        console.error('❌ Missing required fields:', { title, message });
        return res.status(400).json({ error: "Title and message are required" });
      }

      const { firestore, admin } = await import('./firebase');
      
      const newNotification = {
        type: type || 'system',
        title,
        message,
        target: target || 'all',
        priority: priority || 'medium',
        category: category || 'admin',
        status: 'sent',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        readBy: [], // 既読ユーザーのID配列
        readCount: 0
      };

      console.log('💾 Attempting to save notification to Firestore:', newNotification);
      const docRef = await firestore.collection('notifications').add(newNotification);
      console.log('✅ Notification saved with ID:', docRef.id);
      
      // 作成した通知を取得して返す
      const createdDoc = await docRef.get();
      const createdNotification = {
        id: docRef.id,
        ...createdDoc.data(),
        createdAt: new Date()
      };
      
      console.log('📤 Returning notification:', createdNotification);
      res.status(201).json(createdNotification);
    } catch (error) {
      console.error('❌ Error creating notification:', error);
      if (error instanceof Error) {
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Failed to create notification', details: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create notification', details: String(error) });
      }
    }
  });

  // Delete a notification (admin only)
  app.delete("/api/notifications/:id", verifyAdminToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { firestore } = await import('./firebase');
      
      await firestore.collection('notifications').doc(id).delete();
      
      res.json({ message: "Notification deleted successfully" });
    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({ error: "Failed to delete notification" });
    }
  });

  // Mark notification as read (for specific user)
  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;
      const { firestore, admin } = await import('./firebase');
      
      const notificationRef = firestore.collection('notifications').doc(id);
      const notificationDoc = await notificationRef.get();
      
      if (!notificationDoc.exists) {
        return res.status(404).json({ error: "Notification not found" });
      }

      // ユーザーIDを既読リストに追加
      await notificationRef.update({
        readBy: admin.firestore.FieldValue.arrayUnion(userId || 'anonymous'),
        readCount: admin.firestore.FieldValue.increment(1)
      });
      
      const updatedDoc = await notificationRef.get();
      res.json({
        id: notificationRef.id,
        ...updatedDoc.data()
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  // ===== Featured Pickup Management Endpoints =====

  // Get all posts (for admin selection)
  app.get("/api/posts", async (_req, res) => {
    try {
      const { firestore } = await import('./firebase');
      
      const postsSnapshot = await firestore
        .collection('posts')
        .orderBy('createdAt', 'desc')
        .get();
      
      const posts = postsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || data.explanation || 'Untitled',
          duration: data.duration || '00:00',
          thumbnail: data.files?.[0]?.url || data.thumbnailUrl || '/genre-1.png',
          userId: data.userId,
          userName: data.username || 'Unknown',
          userAvatar: data.userAvatar || '/logo192.png',
          userFollowers: data.userFollowers || 0,
          likes: Array.isArray(data.likes) ? data.likes.length : (data.likes || 0),
          bookmarks: data.bookmarks || 0,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          isNew: false
        };
      });
      
      res.json(posts);
    } catch (error) {
      console.error('Error fetching posts:', error);
      res.status(500).json({ error: 'Failed to fetch posts' });
    }
  });

  // Get all featured pickups with post details
  app.get("/api/featured-pickup", async (_req, res) => {
    try {
      const { firestore } = await import('./firebase');
      
      // Firestoreからピックアップを取得
      const pickupsSnapshot = await firestore
        .collection('featuredPickups')
        .where('isActive', '==', true)
        .orderBy('position', 'asc')
        .get();
      
      if (pickupsSnapshot.empty) {
        return res.json([]);
      }

      // 投稿データを並行取得
      const pickupsWithDetails = await Promise.all(
        pickupsSnapshot.docs.map(async (doc) => {
          const pickupData = doc.data();
          const postId = pickupData.postId;
          
          // Firestoreから投稿データを取得
          const postDoc = await firestore.collection('posts').doc(postId).get();
          
          if (!postDoc.exists) {
            return null;
          }
          
          const postData = postDoc.data();
          if (!postData) {
            return null;
          }
          
          return {
            id: doc.id,
            postId: pickupData.postId,
            position: pickupData.position,
            createdAt: pickupData.createdAt,
            addedBy: pickupData.addedBy,
            post: {
              id: postDoc.id,
              title: postData.title || postData.explanation || 'Untitled',
              duration: postData.duration || '00:00',
              thumbnail: postData.thumbnailUrl || postData.files?.[0]?.thumbnailUrl || '/genre-1.png',
              userId: postData.userId,
              userName: postData.userName || 'Anonymous',
              userAvatar: postData.userAvatar || '/logo192.png',
              userFollowers: postData.userFollowers || 0,
              likes: postData.likes || 0,
              bookmarks: postData.bookmarks || 0,
              createdAt: postData.createdAt,
              isNew: postData.isNew !== false
            }
          };
        })
      );

      const validPickups = pickupsWithDetails.filter(item => item !== null);
      res.json(validPickups);
    } catch (error) {
      console.error('Error fetching featured pickups:', error);
      res.status(500).json({ error: 'Failed to fetch featured pickups' });
    }
  });

  // Add a post to featured pickup (admin only)
  app.post("/api/featured-pickup", verifyAdminToken, async (req, res) => {
    try {
      const { firestore } = await import('./firebase');
      const { postId, position } = req.body;

      if (!postId) {
        return res.status(400).json({ error: "Post ID is required" });
      }

      // Check if post exists in Firestore
      const postDoc = await firestore.collection('posts').doc(postId).get();
      if (!postDoc.exists) {
        return res.status(404).json({ error: "Post not found" });
      }

      // Check if post already exists in featured pickup
      const existingPickup = await firestore
        .collection('featuredPickups')
        .where('postId', '==', postId)
        .where('isActive', '==', true)
        .get();
      
      if (!existingPickup.empty) {
        return res.status(400).json({ error: "Post already in featured pickup" });
      }

      // Get current maximum position
      const pickupsSnapshot = await firestore
        .collection('featuredPickups')
        .where('isActive', '==', true)
        .orderBy('position', 'desc')
        .limit(1)
        .get();
      
      const maxPosition = pickupsSnapshot.empty ? 0 : pickupsSnapshot.docs[0].data().position;

      const newPickup = {
        postId,
        position: position || maxPosition + 1,
        createdAt: new Date(),
        addedBy: 'admin',
        isActive: true
      };

      const docRef = await firestore.collection('featuredPickups').add(newPickup);
      
      res.status(201).json({ id: docRef.id, ...newPickup });
    } catch (error) {
      console.error('Error adding featured pickup:', error);
      res.status(500).json({ error: 'Failed to add featured pickup' });
    }
  });

  // Update featured pickup position (admin only)
  app.patch("/api/featured-pickup/:id", verifyAdminToken, async (req, res) => {
    try {
      const { firestore } = await import('./firebase');
      const { id } = req.params;
      const { position } = req.body;
      
      const pickupRef = firestore.collection('featuredPickups').doc(id);
      const pickupDoc = await pickupRef.get();
      
      if (!pickupDoc.exists) {
        return res.status(404).json({ error: "Featured pickup not found" });
      }

      const updateData: any = {};
      if (position !== undefined) {
        updateData.position = position;
      }
      
      await pickupRef.update(updateData);
      
      const updatedDoc = await pickupRef.get();
      res.json({ id: updatedDoc.id, ...updatedDoc.data() });
    } catch (error) {
      console.error('Error updating featured pickup:', error);
      res.status(500).json({ error: 'Failed to update featured pickup' });
    }
  });

  // Reorder featured pickups (admin only)
  app.patch("/api/featured-pickup/reorder", verifyAdminToken, async (req, res) => {
    try {
      const { firestore } = await import('./firebase');
      const { pickupIds } = req.body;
      
      if (!Array.isArray(pickupIds)) {
        return res.status(400).json({ error: "pickupIds must be an array" });
      }

      // Update positions in batch
      const batch = firestore.batch();
      pickupIds.forEach((id, index) => {
        const pickupRef = firestore.collection('featuredPickups').doc(id);
        batch.update(pickupRef, { position: index + 1 });
      });
      
      await batch.commit();
      
      // Fetch updated pickups
      const pickupsSnapshot = await firestore
        .collection('featuredPickups')
        .where('isActive', '==', true)
        .orderBy('position', 'asc')
        .get();
      
      const pickups = pickupsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      res.json(pickups);
    } catch (error) {
      console.error('Error reordering featured pickups:', error);
      res.status(500).json({ error: 'Failed to reorder featured pickups' });
    }
  });

  // Delete a featured pickup (admin only)
  app.delete("/api/featured-pickup/:id", verifyAdminToken, async (req, res) => {
    try {
      const { firestore } = await import('./firebase');
      const { id } = req.params;
      
      const pickupRef = firestore.collection('featuredPickups').doc(id);
      const pickupDoc = await pickupRef.get();
      
      if (!pickupDoc.exists) {
        return res.status(404).json({ error: "Featured pickup not found" });
      }

      // Soft delete by setting isActive to false
      await pickupRef.update({ isActive: false });
      
      res.json({ message: "Featured pickup deleted successfully" });
    } catch (error) {
      console.error('Error deleting featured pickup:', error);
      res.status(500).json({ error: 'Failed to delete featured pickup' });
    }
  });

  // ===== Featured Creators Management Endpoints =====

  // Get all featured creators with user details
  app.get("/api/featured-creators", async (_req, res) => {
    try {
      const { firestore } = await import('./firebase');
      
      const creatorsSnapshot = await firestore
        .collection('featuredCreators')
        .where('isActive', '==', true)
        .orderBy('position', 'asc')
        .get();
      
      if (creatorsSnapshot.empty) {
        return res.json([]);
      }

      const creatorsWithDetails = await Promise.all(
        creatorsSnapshot.docs.map(async (doc) => {
          const creatorData = doc.data();
          const userId = creatorData.userId;
          
          const userDoc = await firestore.collection('users').doc(userId).get();
          
          if (!userDoc.exists) {
            return null;
          }
          
          const userData = userDoc.data();
          if (!userData) {
            return null;
          }
          
          return {
            id: doc.id,
            userId: creatorData.userId,
            position: creatorData.position,
            createdAt: creatorData.createdAt,
            addedBy: creatorData.addedBy,
            user: {
              id: userDoc.id,
              name: userData.displayName || userData.username || 'Anonymous',
              avatar: userData.photoURL || '/logo192.png',
              followers: userData.followerCount || 0,
              likes: userData.totalLikes || 0,
              isVerified: userData.isVerified || false
            }
          };
        })
      );

      const validCreators = creatorsWithDetails.filter(item => item !== null);
      res.json(validCreators);
    } catch (error) {
      console.error('Error fetching featured creators:', error);
      res.status(500).json({ error: 'Failed to fetch featured creators' });
    }
  });

  // Add a creator to featured creators (admin only)
  app.post("/api/featured-creators", verifyAdminToken, async (req, res) => {
    try {
      const { firestore } = await import('./firebase');
      const { userId, position } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      const userDoc = await firestore.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        return res.status(404).json({ error: "User not found" });
      }

      const existingCreator = await firestore
        .collection('featuredCreators')
        .where('userId', '==', userId)
        .where('isActive', '==', true)
        .get();
      
      if (!existingCreator.empty) {
        return res.status(400).json({ error: "Creator already in featured list" });
      }

      const creatorsSnapshot = await firestore
        .collection('featuredCreators')
        .where('isActive', '==', true)
        .orderBy('position', 'desc')
        .limit(1)
        .get();
      
      const maxPosition = creatorsSnapshot.empty ? 0 : creatorsSnapshot.docs[0].data().position;

      const newCreator = {
        userId,
        position: position || maxPosition + 1,
        createdAt: new Date(),
        addedBy: 'admin',
        isActive: true
      };

      const docRef = await firestore.collection('featuredCreators').add(newCreator);
      
      res.status(201).json({ id: docRef.id, ...newCreator });
    } catch (error) {
      console.error('Error adding featured creator:', error);
      res.status(500).json({ error: 'Failed to add featured creator' });
    }
  });

  // Update featured creator position (admin only)
  app.patch("/api/featured-creators/:id", verifyAdminToken, async (req, res) => {
    try {
      const { firestore } = await import('./firebase');
      const { id } = req.params;
      const { position } = req.body;
      
      const creatorRef = firestore.collection('featuredCreators').doc(id);
      const creatorDoc = await creatorRef.get();
      
      if (!creatorDoc.exists) {
        return res.status(404).json({ error: "Featured creator not found" });
      }

      const updateData: any = {};
      if (position !== undefined) {
        updateData.position = position;
      }
      
      await creatorRef.update(updateData);
      
      const updatedDoc = await creatorRef.get();
      res.json({ id: updatedDoc.id, ...updatedDoc.data() });
    } catch (error) {
      console.error('Error updating featured creator:', error);
      res.status(500).json({ error: 'Failed to update featured creator' });
    }
  });

  // Delete a featured creator (admin only)
  app.delete("/api/featured-creators/:id", verifyAdminToken, async (req, res) => {
    try {
      const { firestore } = await import('./firebase');
      const { id } = req.params;
      
      const creatorRef = firestore.collection('featuredCreators').doc(id);
      const creatorDoc = await creatorRef.get();
      
      if (!creatorDoc.exists) {
        return res.status(404).json({ error: "Featured creator not found" });
      }

      await creatorRef.update({ isActive: false });
      
      res.json({ message: "Featured creator deleted successfully" });
    } catch (error) {
      console.error('Error deleting featured creator:', error);
      res.status(500).json({ error: 'Failed to delete featured creator' });
    }
  });

  // Object Storage Routes
  // Reference: blueprint:javascript_object_storage integration
  
  // Serve public assets from object storage
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    const { ObjectStorageService } = await import("./objectStorage");
    const objectStorageService = new ObjectStorageService();
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Legacy /objects/ path - serve directly with Bunny CDN priority
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      // Extract filename from /objects/filename.ext
      const parts = req.path.slice(1).split("/");
      if (parts.length < 2) {
        return res.status(404).json({ error: "Invalid path" });
      }
      
      const filename = parts.slice(1).join("/");
      const folder = 'public'; // Legacy paths are always public
      const isBunnyConfigured = !!(process.env.BUNNY_STORAGE_API_KEY && process.env.BUNNY_STORAGE_ZONE_NAME);
      
      console.log('🔍 Legacy /objects/ request for:', filename, 'Range:', req.headers.range);
      
      // Determine content type from filename
      const ext = filename.toLowerCase().split('.').pop();
      let contentType = 'application/octet-stream';
      if (ext === 'mp4') contentType = 'video/mp4';
      else if (ext === 'mov') contentType = 'video/quicktime';
      else if (ext === 'webm') contentType = 'video/webm';
      else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
      else if (ext === 'png') contentType = 'image/png';
      else if (ext === 'gif') contentType = 'image/gif';
      else if (ext === 'webp') contentType = 'image/webp';
      
      let fileBuffer: Buffer;
      
      // Strategy 1: Try Bunny CDN first (if configured)
      if (isBunnyConfigured) {
        const cdnHostname = process.env.BUNNY_CDN_HOSTNAME || `${process.env.BUNNY_STORAGE_ZONE_NAME}.b-cdn.net`;
        const bunnyUrl = `https://${cdnHostname}/${folder}/${filename}`;
        
        console.log('🐰 Trying Bunny CDN:', bunnyUrl);
        
        try {
          const bunnyResponse = await fetch(bunnyUrl);
          if (bunnyResponse.ok) {
            console.log('✅ Bunny CDN HIT - Fast delivery!');
            const arrayBuffer = await bunnyResponse.arrayBuffer();
            fileBuffer = Buffer.from(arrayBuffer);
          } else {
            console.log('⚠️ Bunny CDN MISS - Migrating from Firebase...');
            throw new Error('Not in Bunny CDN yet');
          }
        } catch (bunnyCdnError) {
          // File not in Bunny CDN, download from Firebase and migrate
          const { ObjectStorageService } = await import("./objectStorage");
          const { storage } = await import('./firebase');
          const objectStorageService = new ObjectStorageService();
          
          const objectPath = `/objects/${filename}`;
          const filePath = await objectStorageService.getObjectEntityFile(objectPath);
          
          console.log('📥 Downloading from Firebase:', filePath);
          
          const bucket = storage.bucket();
          const file = bucket.file(filePath);
          const [fbBuffer] = await file.download();
          
          if (!fbBuffer || fbBuffer.length === 0) {
            return res.status(404).json({ error: 'File not found' });
          }
          
          fileBuffer = fbBuffer;
          console.log('✅ Firebase download complete:', fileBuffer.length, 'bytes');
          
          // Auto-migrate to Bunny CDN in background (don't wait)
          (async () => {
            try {
              const { storageAdapter } = await import('./storage-adapter');
              const bunnyKey = `${folder}/${filename}`;
              await storageAdapter.upload(bunnyKey, fileBuffer, contentType);
              console.log('🚀 Auto-migrated to Bunny CDN:', bunnyKey);
            } catch (migrationError) {
              console.error('⚠️ Migration to Bunny CDN failed:', migrationError);
            }
          })();
        }
      } else {
        // No Bunny CDN, use Firebase Storage only
        const { ObjectStorageService } = await import("./objectStorage");
        const { storage } = await import('./firebase');
        const objectStorageService = new ObjectStorageService();
        
        const objectPath = `/objects/${filename}`;
        const filePath = await objectStorageService.getObjectEntityFile(objectPath);
        
        console.log('📥 Downloading from Firebase:', filePath);
        
        const bucket = storage.bucket();
        const file = bucket.file(filePath);
        const [fbBuffer] = await file.download();
        
        if (!fbBuffer || fbBuffer.length === 0) {
          return res.status(404).json({ error: 'File not found' });
        }
        
        fileBuffer = fbBuffer;
        console.log('✅ Downloaded from Firebase:', fileBuffer.length, 'bytes');
      }
      
      const fileSize = fileBuffer.length;
      
      // Handle Range requests for video streaming
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;
        
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, stale-while-revalidate=86400',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Range',
          'Cross-Origin-Resource-Policy': 'cross-origin',
        });
        
        res.end(fileBuffer.slice(start, end + 1));
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, stale-while-revalidate=86400',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Range',
          'Cross-Origin-Resource-Policy': 'cross-origin',
        });
        
        res.end(fileBuffer);
      }
    } catch (error: any) {
      console.error("Error serving legacy object:", error);
      if (!res.headersSent) {
        return res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  // Custom error class for authentication failures
  class AuthenticationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AuthenticationError';
    }
  }

  // Helper function to verify Firebase token (throws AuthenticationError if invalid/missing)
  async function verifyFirebaseToken(authHeader: string | undefined): Promise<string> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or invalid authorization header');
    }
    
    const token = authHeader.substring(7);
    try {
      const { auth } = await import('./firebase');
      const decodedToken = await auth.verifyIdToken(token);
      return decodedToken.uid;
    } catch (error) {
      console.error("Firebase token verification failed:", error);
      throw new AuthenticationError('Invalid authentication token');
    }
  }

  // Configure multer for in-memory file uploads
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 500 * 1024 * 1024, // 500MB limit for videos
    }
  });

  // Server-side file upload endpoint - requires authentication and creator status
  app.post("/api/objects/upload", upload.single('file'), async (req, res) => {
    try {
      // Verify Firebase authentication
      const userId = await verifyFirebaseToken(req.headers.authorization);

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Validate file type (images and videos only)
      const allowedMimeTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/quicktime', 'video/webm', 'video/avi', 'video/mov'
      ];
      
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ 
          error: "Invalid file type. Only images and videos are allowed." 
        });
      }

      // TODO: Re-enable creator verification once Firestore authentication is properly configured
      // Temporarily disabled due to Firestore authentication issues
      // const { firestore } = await import('./firebase');
      // const userDoc = await firestore.collection('users').doc(userId).get();
      // if (!userDoc.exists) {
      //   return res.status(403).json({ error: "User not found" });
      // }
      // const userData = userDoc.data();
      // if (!userData.isCreator || userData.creatorStatus !== 'approved') {
      //   return res.status(403).json({ 
      //     error: "Only approved creators can upload content" 
      //   });
      // }

      const { visibility = 'public' } = req.body;
      const isVideo = req.file.mimetype.startsWith('video/');
      
      let uploadResult: any;
      let thumbnailUrl: string | null = null;

      // Check if Bunny CDN is configured
      const isBunnyConfigured = !!(process.env.BUNNY_STORAGE_API_KEY && process.env.BUNNY_STORAGE_ZONE_NAME);

      if (isBunnyConfigured) {
        // Upload to Bunny CDN
        // Sanitize filename: remove non-ASCII characters and special chars, keep extension
        const originalName = req.file.originalname;
        const ext = originalName.substring(originalName.lastIndexOf('.'));
        const sanitizedBase = originalName
          .substring(0, originalName.lastIndexOf('.'))
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .substring(0, 50);
        const safeFileName = `${Date.now()}-${sanitizedBase}${ext}`;
        const key = `${visibility}/${safeFileName}`;
        
        console.log(`📝 Sanitized filename: ${originalName} -> ${safeFileName}`);

        const publicUrl = await storageAdapter.upload(
          key,
          req.file.buffer,
          req.file.mimetype
        );

        // For videos, try to generate thumbnail using Bunny Stream
        if (isVideo && bunnyStreamClient.isConfigured()) {
          console.log('📹 Uploading video to Bunny Stream for encoding...');
          const streamVideo = await bunnyStreamClient.uploadVideo(
            req.file.buffer,
            req.file.originalname
          );
          
          if (streamVideo) {
            thumbnailUrl = bunnyStreamClient.getThumbnailUrl(streamVideo.guid);
            console.log(`✅ Video thumbnail: ${thumbnailUrl}`);
          }
        } else if (isVideo && storageAdapter.generateThumbnail) {
          thumbnailUrl = await storageAdapter.generateThumbnail(key);
        }

        uploadResult = {
          objectPath: publicUrl,
          storageUri: `bunny-cdn://${key}`,
          url: publicUrl,
          secure_url: publicUrl,
          thumbnailUrl: thumbnailUrl || publicUrl,
          source: 'bunny-cdn',
        };
      } else {
        // Fallback to existing storage (Firebase/Replit Object Storage)
        console.log('⚠️  Bunny CDN not configured, using fallback storage');
        const { ObjectStorageService } = await import("./objectStorage");
        const objectStorageService = new ObjectStorageService();

        const legacyResult = await objectStorageService.uploadFile(
          req.file.buffer,
          req.file.originalname,
          userId,
          req.file.mimetype,
          visibility
        );

        uploadResult = {
          objectPath: legacyResult.objectPath,
          storageUri: legacyResult.storageUri,
          source: 'replit-object-storage',
        };
      }
      
      res.json({ 
        ...uploadResult,
        fileName: req.file.originalname,
        contentType: req.file.mimetype,
        size: req.file.size,
        resourceType: isVideo ? 'video' : 'image',
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      if (error instanceof AuthenticationError) {
        return res.status(401).json({ error: error.message });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update content metadata after upload (set ACL policy and save to Firestore)
  app.put("/api/content/upload-complete", async (req, res) => {
    if (!req.body.contentURL) {
      return res.status(400).json({ error: "contentURL is required" });
    }

    try {
      // Verify Firebase authentication
      const userId = await verifyFirebaseToken(req.headers.authorization);

      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      const { visibility = 'public', contentType, title, postId, aclRules } = req.body;

      let objectPath: string;
      let storagePath: string;

      // Try to set ACL policy, but continue if it fails
      try {
        objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
          req.body.contentURL,
          {
            owner: userId,
            visibility: visibility,
            aclRules: aclRules || undefined,
          },
        );

        // Get the actual storage path for reference
        const objectFilePath = await objectStorageService.getObjectEntityFile(objectPath);
        const { storage } = await import('./firebase');
        const bucket = storage.bucket();
        storagePath = `gs://${bucket.name}/${objectFilePath}`;
        
        // Note: makePublic() is not available due to Public Access Prevention on Replit Object Storage
        // Files will be accessed via signed URLs or ACL policies instead
      } catch (aclError) {
        console.error("Warning: ACL setting failed, using URL as-is:", aclError);
        // Fallback: use the normalized path from URL
        objectPath = await objectStorageService.normalizeObjectEntityPath(req.body.contentURL);
        storagePath = req.body.contentURL;
      }

      // Save metadata to Firestore
      const { firestore, admin } = await import('./firebase');
      
      const contentMetadata = {
        objectPath,           // Normalized path: /objects/<uuid>.<ext>
        storagePath,          // Actual GCS path: gs://bucket/path or URL
        contentType,
        title: title || 'Untitled',
        owner: userId,
        visibility,
        uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
        postId: postId || null,
      };

      // Save to Firestore content_uploads collection with better error handling
      let contentDoc;
      try {
        contentDoc = await firestore.collection('content_uploads').add(contentMetadata);
      } catch (firestoreError) {
        console.error("Firestore save error:", firestoreError);
        // Return success even if Firestore save fails - file is uploaded
        return res.status(200).json({
          objectPath: objectPath,
          contentId: null,
          message: "Content uploaded successfully (metadata save pending)",
          warning: "Metadata not saved to database",
        });
      }

      res.status(200).json({
        objectPath: objectPath,
        contentId: contentDoc.id,
        message: "Content uploaded and metadata saved successfully",
      });
    } catch (error) {
      console.error("Error in upload-complete:", error);
      if (error instanceof AuthenticationError) {
        return res.status(401).json({ error: error.message });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Stripe payment route for one-time payments (subscription plan purchases)
  // Reference: blueprint:javascript_stripe integration
  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      const { amount, currency = "jpy", planId, planName, description, creatorId, roomId } = req.body;
      
      // Validate amount
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      // Security: Limit maximum payment amount (100,000 yen)
      if (amount > 100000) {
        return res.status(400).json({ error: "Amount exceeds maximum limit" });
      }

      // Validate currency
      if (currency && currency !== "jpy") {
        return res.status(400).json({ error: "Only JPY currency is supported" });
      }

      if (!stripe) {
        return res.status(500).json({ error: "Payment system not configured" });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount), // Amount in yen (no need to multiply by 100 for JPY)
        currency: currency,
        description: description || undefined,
        metadata: {
          planId: planId || '',
          planName: planName || '',
          creatorId: creatorId || '',
          roomId: roomId || '',
          type: roomId ? 'tip' : 'plan',
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });
      
      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      res
        .status(500)
        .json({ error: "Error creating payment intent: " + error.message });
    }
  });

  // Secure session token generation with HMAC signature
  function generateSecureSessionToken(email: string): string {
    const timestamp = Date.now();
    const payload = `${email}:${timestamp}`;
    const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
    return Buffer.from(`${payload}:${signature}`).toString('base64');
  }

  function verifySecureSessionToken(token: string): { email: string; timestamp: number } | null {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const parts = decoded.split(':');
      if (parts.length !== 3) return null;
      
      const [email, timestampStr, signature] = parts;
      const timestamp = parseInt(timestampStr);
      
      // Verify signature using the same SESSION_SECRET
      const payload = `${email}:${timestamp}`;
      const expectedSignature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
      
      if (signature !== expectedSignature) {
        return null; // Invalid signature
      }
      
      // Check expiration (24 hours)
      const tokenAge = Date.now() - timestamp;
      if (tokenAge > 24 * 60 * 60 * 1000) {
        return null; // Expired
      }
      
      return { email, timestamp };
    } catch {
      return null;
    }
  }

  // Admin authentication endpoint
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      // Verify admin credentials (environment variables for security)
      const adminEmail = process.env.ADMIN_EMAIL || "info@sinjapan.jp";
      const adminPassword = process.env.ADMIN_PASSWORD || "Kazuya8008";

      if (email === adminEmail && password === adminPassword) {
        // Generate a cryptographically signed session token
        const sessionToken = generateSecureSessionToken(email);
        
        // Set HttpOnly cookie for security (not accessible via JavaScript)
        res.cookie('adminSession', sessionToken, {
          httpOnly: true, // Not accessible via JavaScript
          secure: process.env.NODE_ENV === 'production', // HTTPS only in production
          sameSite: 'strict', // CSRF protection
          maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });
        
        res.json({
          success: true,
          email,
          expiresIn: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
        });
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
    } catch (error: any) {
      console.error("Error during admin login:", error);
      res.status(500).json({ error: "Login error: " + error.message });
    }
  });

  // Verify admin session endpoint
  app.get("/api/admin/verify", verifyAdminToken, (req: any, res) => {
    res.json({ success: true, email: req.adminEmail });
  });

  // Admin logout endpoint
  app.post("/api/admin/logout", verifyAdminToken, (req, res) => {
    res.clearCookie('adminSession');
    res.json({ success: true });
  });

  // Initialize first admin user (one-time setup)
  // Protected by INITIAL_ADMIN_SECRET environment variable
  app.post("/api/admin/initialize", async (req, res) => {
    try {
      const { email, password, displayName, secret } = req.body;
      
      if (!email || !password || !displayName || !secret) {
        return res.status(400).json({ error: "Email, password, displayName, and secret are required" });
      }

      // Verify initialization secret
      const INITIAL_ADMIN_SECRET = process.env.INITIAL_ADMIN_SECRET;
      if (!INITIAL_ADMIN_SECRET || secret !== INITIAL_ADMIN_SECRET) {
        return res.status(403).json({ error: "Invalid initialization secret" });
      }

      const { auth, firestore, admin } = await import('./firebase');

      // Check if any admin users already exist
      const adminSnapshot = await firestore
        .collection('users')
        .where('role', '==', 'admin')
        .limit(1)
        .get();

      if (!adminSnapshot.empty) {
        return res.status(400).json({ error: "Admin user already exists. This endpoint can only be used once." });
      }

      // Create admin user in Firebase Authentication
      const userRecord = await auth.createUser({
        email,
        password,
        displayName,
        emailVerified: true, // Auto-verify admin email
      });

      console.log('🔐 Admin user created in Firebase Auth:', userRecord.uid);

      // Create admin profile in Firestore with admin role
      await firestore.collection('users').doc(userRecord.uid).set({
        displayName,
        email,
        photoURL: null,
        role: 'admin', // Critical: Set admin role
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSeen: admin.firestore.FieldValue.serverTimestamp(),
        isOnline: false,
        isCreator: false,
      });

      console.log('✅ Admin user profile created in Firestore with role: admin');

      res.json({
        success: true,
        message: "Admin user initialized successfully",
        userId: userRecord.uid,
        email: userRecord.email,
      });
    } catch (error: any) {
      console.error('❌ Error initializing admin user:', error);
      res.status(500).json({ error: "Initialization error: " + error.message });
    }
  });

  // TEMPORARY: Admin endpoint to create user account
  // Protected by admin authentication
  app.post("/api/admin/create-user", verifyAdminToken, async (req, res) => {
    try {
      const { email, password, displayName } = req.body;
      
      if (!email || !password || !displayName) {
        return res.status(400).json({ error: "Email, password, and displayName are required" });
      }

      const { auth, firestore, admin } = await import('./firebase');

      // Create user in Firebase Authentication
      const userRecord = await auth.createUser({
        email,
        password,
        displayName,
        emailVerified: false,
      });

      console.log('User created in Firebase Auth:', userRecord.uid);

      // Create user profile in Firestore
      await firestore.collection('users').doc(userRecord.uid).set({
        displayName,
        email,
        photoURL: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSeen: admin.firestore.FieldValue.serverTimestamp(),
        isOnline: false,
        provider: 'email',
        stats: {
          posts: 0,
          likes: 0,
          followers: 0,
          following: 0
        },
        bio: '',
        coverImage: null,
        isVerified: false,
        subscriptionPlans: []
      });

      console.log('User profile created in Firestore');

      res.json({
        success: true,
        userId: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName
      });
    } catch (error: any) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Error creating user: " + error.message });
    }
  });

  // Image upload endpoint for slider images
  app.post("/api/upload-slider-image", express.raw({ type: 'application/octet-stream', limit: '10mb' }), async (req, res) => {
    try {
      const multer = await import('multer');
      const storage = multer.default.memoryStorage();
      const upload = multer.default({ storage }).single('file');

      upload(req as any, res as any, async (err: any) => {
        if (err) {
          return res.status(400).json({ error: 'File upload failed' });
        }

        const file = (req as any).file;
        if (!file) {
          return res.status(400).json({ error: 'No file provided' });
        }

        const { ObjectStorageService } = await import('./objectStorage');
        const { storage: firebaseStorage } = await import('./firebase');
        const objectStorageService = new ObjectStorageService();

        // Generate unique file name
        const { randomUUID } = await import('crypto');
        const fileId = randomUUID();
        const extension = file.mimetype.split('/')[1];
        const fileName = `slider-${fileId}.${extension}`;

        // Upload to Firebase Storage
        const bucket = firebaseStorage.bucket();
        const blob = bucket.file(`public/${fileName}`);

        const blobStream = blob.createWriteStream({
          resumable: false,
          metadata: {
            contentType: file.mimetype,
          },
        });

        blobStream.on('error', (error: Error) => {
          console.error('Upload error:', error);
          res.status(500).json({ error: 'Error uploading file' });
        });

        blobStream.on('finish', async () => {
          // Make file public
          await blob.makePublic();

          // Return public URL
          const imageUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
          res.json({ imageUrl });
        });

        blobStream.end(file.buffer);
      });
    } catch (error: any) {
      console.error('Error in upload endpoint:', error);
      res.status(500).json({ error: 'Error uploading image: ' + error.message });
    }
  });

  // Stripe Checkout Session for Tips (One-time Payment)
  app.post("/api/create-tip-checkout", async (req, res) => {
    try {
      const { amount, currency = "jpy", description, creatorId, creatorName, roomId, userId, userEmail } = req.body;

      if (!amount || !creatorId || !userId || !userEmail) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Validate amount
      if (amount <= 0 || amount > 100000) {
        return res.status(400).json({ error: 'Invalid amount' });
      }

      if (!stripe) {
        return res.status(500).json({ error: "Payment system not configured" });
      }

      // Get or create Stripe customer
      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
      let customerId: string;

      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: { userId: userId },
        });
        customerId = customer.id;
      }

      // Create Stripe Checkout Session for one-time payment
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        customer: customerId,
        line_items: [
          {
            price_data: {
              currency: currency,
              product_data: {
                name: `投げ銭 - ${creatorName}`,
                description: description || `${creatorName}さんへの投げ銭`,
              },
              unit_amount: Math.round(amount),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${req.headers.origin}/live?tip=success`,
        cancel_url: `${req.headers.origin}/live?tip=cancelled`,
        metadata: {
          type: 'tip',
          creatorId,
          creatorName: creatorName || '',
          roomId: roomId || '',
          userId,
          amount: amount.toString(),
        },
      });

      res.json({ sessionId: session.id, url: session.url });
    } catch (error: any) {
      console.error('Error creating tip checkout session:', error);
      res.status(500).json({ error: 'Error creating checkout session: ' + error.message });
    }
  });

  // Stripe Checkout Session for Subscription (Recurring Payment)
  // Reference: blueprint:javascript_stripe integration
  app.post("/api/create-subscription-checkout", async (req, res) => {
    try {
      const { planId, planTitle, planPrice, creatorId, creatorName, userId, userEmail } = req.body;

      if (!planId || !planTitle || !planPrice || !creatorId || !userId || !userEmail) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Extract creator's base price
      const priceMatch = planPrice.match(/\d+/);
      if (!priceMatch) {
        return res.status(400).json({ error: 'Invalid price format' });
      }
      const basePrice = parseInt(priceMatch[0]);
      
      // Calculate total: base price + 10% tax + 10% platform fee
      const tax = Math.floor(basePrice * 0.10); // 10% consumption tax
      const platformFee = Math.floor(basePrice * 0.10); // 10% platform fee
      const amount = basePrice + tax + platformFee; // Total amount in JPY

      if (!stripe) {
        return res.status(500).json({ error: "Payment system not configured" });
      }

      // Check if customer exists, or create new one
      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
      let customerId: string;

      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: {
            userId: userId,
          },
        });
        customerId = customer.id;
      }

      // Create Stripe Checkout Session with recurring subscription
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        customer: customerId,
        line_items: [
          {
            price_data: {
              currency: 'jpy',
              product_data: {
                name: `${creatorName} - ${planTitle}`,
                description: `月額サブスクリプションプラン`,
              },
              unit_amount: amount,
              recurring: {
                interval: 'month',
              },
            },
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${req.headers.origin}/profile/${creatorId}?subscription=success&plan=${planId}`,
        cancel_url: `${req.headers.origin}/profile/${creatorId}?subscription=cancelled`,
        metadata: {
          planId,
          planTitle,
          creatorId,
          creatorName,
          userId,
          basePrice: basePrice.toString(),
          tax: tax.toString(),
          platformFee: platformFee.toString(),
        },
      });

      res.json({ sessionId: session.id, url: session.url });
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({ error: 'Error creating checkout session: ' + error.message });
    }
  });

  // Create Subscription with Payment Intent for in-app modal payment
  // This creates a recurring subscription with the first payment
  // Reference: blueprint:javascript_stripe integration
  app.post("/api/create-subscription-payment-intent", async (req, res) => {
    try {
      const { planId, planTitle, planPrice, creatorId, creatorName, userId, userEmail } = req.body;

      if (!planId || !planTitle || !planPrice || !creatorId || !userId || !userEmail) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Extract base price (creator's net amount)
      const priceStr = String(planPrice || '0');
      const cleanPrice = priceStr.replace(/[^\d]/g, '');
      if (!cleanPrice) {
        return res.status(400).json({ error: 'Invalid price format' });
      }
      const basePrice = parseInt(cleanPrice);
      
      // Calculate total amount and fees
      const platformFee = Math.floor(basePrice * 0.10);
      const tax = Math.floor(basePrice * 0.10);
      const totalAmount = basePrice + platformFee + tax;

      if (!stripe) {
        return res.status(500).json({ error: "Payment system not configured" });
      }

      // Get or create Stripe customer
      const customers = await stripe.customers.list({
        email: userEmail,
        limit: 1
      });

      let customer;
      if (customers.data.length > 0) {
        customer = customers.data[0];
      } else {
        customer = await stripe.customers.create({
          email: userEmail,
          metadata: {
            userId,
            firebaseUid: userId
          }
        });
      }

      // Check for existing incomplete subscription for this customer and plan
      const existingSubscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'incomplete',
        limit: 10
      });

      const matchingSubscription = existingSubscriptions.data.find(sub => 
        sub.metadata.planId === planId && 
        sub.metadata.creatorId === creatorId &&
        sub.status === 'incomplete'
      );

      // Cancel existing incomplete subscription to avoid payment_intent issues
      if (matchingSubscription) {
        console.log(`🗑️ Canceling existing incomplete subscription: ${matchingSubscription.id}`);
        await stripe.subscriptions.cancel(matchingSubscription.id);
      }

      // Create Stripe Product and Price
      const product = await stripe.products.create({
        name: planTitle,
        description: `${creatorName}のサブスクリプション`,
        metadata: {
          planId,
          creatorId,
          creatorName
        }
      });

      const price = await stripe.prices.create({
        currency: 'jpy',
        unit_amount: totalAmount,
        recurring: {
          interval: 'month'
        },
        product: product.id,
      });

      // Create subscription first without payment
      console.log(`✨ Creating new subscription for ${userId} → ${creatorName}`);
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: price.id }],
        payment_behavior: 'default_incomplete',
        payment_settings: { 
          save_default_payment_method: 'on_subscription',
          payment_method_types: ['card']
        },
        expand: ['latest_invoice'],
        metadata: {
          planId,
          planTitle,
          creatorId,
          creatorName,
          userId,
          basePrice: basePrice.toString(),
          tax: tax.toString(),
          platformFee: platformFee.toString(),
        },
      });

      // Get invoice ID
      let invoiceId: string;
      if (typeof subscription.latest_invoice === 'string') {
        invoiceId = subscription.latest_invoice;
      } else if (subscription.latest_invoice?.id) {
        invoiceId = subscription.latest_invoice.id;
      } else {
        console.error('❌ No invoice found for subscription:', subscription.id);
        return res.status(500).json({ 
          error: 'Subscription created but invoice not found. Please try again.' 
        });
      }

      // Retrieve invoice
      let invoice = await stripe.invoices.retrieve(invoiceId);
      console.log(`📋 Invoice status: ${invoice.status}, amount: ${invoice.amount_due}`);

      // If invoice doesn't have payment_intent, create one manually
      if (!invoice.payment_intent) {
        console.log(`💳 Creating Payment Intent manually for invoice ${invoiceId}`);
        const paymentIntent = await stripe.paymentIntents.create({
          amount: invoice.amount_due,
          currency: 'jpy',
          customer: customer.id,
          metadata: {
            invoiceId: invoiceId,
            subscriptionId: subscription.id,
            planId,
            creatorId,
            userId
          },
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: 'never'
          },
          setup_future_usage: 'off_session'
        });

        console.log(`✅ Payment Intent created: ${paymentIntent.id}`);
        
        res.json({ 
          clientSecret: paymentIntent.client_secret,
          subscriptionId: subscription.id,
          paymentIntentId: paymentIntent.id
        });
      } else {
        // Payment Intent already exists
        const paymentIntent = await stripe.paymentIntents.retrieve(
          typeof invoice.payment_intent === 'string' 
            ? invoice.payment_intent 
            : invoice.payment_intent.id
        );

        if (!paymentIntent.client_secret) {
          console.error('❌ Client Secret not found for existing Payment Intent');
          return res.status(500).json({ 
            error: 'Payment configuration error. Please try again.' 
          });
        }

        console.log(`✅ Using existing Payment Intent: ${paymentIntent.id}`);
        res.json({ 
          clientSecret: paymentIntent.client_secret,
          subscriptionId: subscription.id,
          paymentIntentId: paymentIntent.id
        });
      }
    } catch (error: any) {
      console.error('Error creating subscription:', error);
      res.status(500).json({ error: 'Error creating subscription: ' + error.message });
    }
  });

  // Create Payment Intent for tip sending
  // Reference: blueprint:javascript_stripe integration
  app.post("/api/create-tip-payment-intent", async (req, res) => {
    try {
      const { amount, recipientId, recipientName, senderId, senderName } = req.body;

      if (!amount || !recipientId || !senderId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Validate amount (minimum 100 JPY)
      const tipAmount = parseInt(amount);
      if (isNaN(tipAmount) || tipAmount < 100) {
        return res.status(400).json({ error: 'チップは最低100円から送信できます' });
      }

      if (!stripe) {
        return res.status(500).json({ error: "Payment system not configured" });
      }

      // Calculate fees
      // platformFee = 10% of tip amount
      // tax = 10% of tip amount
      const platformFee = Math.floor(tipAmount * 0.10);
      const tax = Math.floor(tipAmount * 0.10);
      const totalAmount = tipAmount + platformFee + tax; // User pays total
      const creatorAmount = tipAmount; // Creator receives original tip amount

      console.log(`💰 Creating tip payment: ¥${tipAmount} (Total: ¥${totalAmount}, Creator: ¥${creatorAmount})`);

      // Create Payment Intent for one-time tip payment
      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmount,
        currency: 'jpy',
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          type: 'tip',
          recipientId,
          recipientName: recipientName || 'Unknown',
          senderId,
          senderName: senderName || 'Unknown',
          tipAmount: tipAmount.toString(),
          creatorAmount: creatorAmount.toString(),
          platformFee: platformFee.toString(),
          tax: tax.toString(),
        },
      });

      res.json({ 
        clientSecret: paymentIntent.client_secret,
        totalAmount,
        tipAmount,
        platformFee,
        tax
      });
    } catch (error: any) {
      console.error('❌ Error creating tip payment intent:', error);
      res.status(500).json({ error: 'Error creating payment intent: ' + error.message });
    }
  });

  // Confirm tip payment and save to database
  app.post("/api/confirm-tip-payment", async (req, res) => {
    try {
      const { paymentIntentId, message } = req.body;

      if (!paymentIntentId) {
        return res.status(400).json({ error: 'Missing payment intent ID' });
      }

      if (!stripe) {
        return res.status(500).json({ error: "Payment system not configured" });
      }

      // Retrieve payment intent to verify it succeeded
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ error: '決済が完了していません' });
      }

      const { firestore } = await import('./firebase');
      const metadata = paymentIntent.metadata;

      // Save tip transaction to Firestore
      await firestore.collection('tips').add({
        senderId: metadata.senderId,
        senderName: metadata.senderName,
        recipientId: metadata.recipientId,
        recipientName: metadata.recipientName,
        tipAmount: parseInt(metadata.tipAmount),
        creatorAmount: parseInt(metadata.creatorAmount),
        platformFee: parseInt(metadata.platformFee),
        tax: parseInt(metadata.tax),
        totalAmount: paymentIntent.amount,
        currency: 'JPY',
        paymentIntentId,
        message: message || '',
        status: 'completed',
        createdAt: new Date(),
      });

      // Update creator's balance
      const creatorRef = firestore.collection('users').doc(metadata.recipientId);
      const creatorDoc = await creatorRef.get();
      const creatorData = creatorDoc.data() || {};
      
      const currentBalance = creatorData.availableBalance || 0;
      const currentEarnings = creatorData.totalEarnings || 0;
      const creatorAmount = parseInt(metadata.creatorAmount);
      
      await creatorRef.update({
        availableBalance: currentBalance + creatorAmount,
        totalEarnings: currentEarnings + creatorAmount,
      });

      console.log(`✅ Tip payment confirmed: ¥${metadata.tipAmount} → ${metadata.recipientName}`);

      res.json({ success: true });
    } catch (error: any) {
      console.error('❌ Error confirming tip payment:', error);
      res.status(500).json({ error: 'Error confirming payment: ' + error.message });
    }
  });

  // Upload endpoint for document submission
  // Handles file uploads to Bunny Storage (via storageAdapter)
  // Uses the upload middleware defined earlier with 500MB limit
  app.post("/api/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Verify Firebase authentication
      const userId = await verifyFirebaseToken(req.headers.authorization);

      // Get folder from body (form data) or query parameter
      const folder = (req.body.folder || req.query.folder || 'public') as string;
      const visibility = folder === 'private' ? 'private' : 'public';
      console.log(`📁 Upload folder: ${folder}, visibility: ${visibility}, user: ${userId}`);
      
      // Sanitize filename (ASCII-safe, no special characters)
      const sanitizeFilename = (filename: string): string => {
        const timestamp = Date.now();
        const extension = filename.split('.').pop() || 'mp4';
        const baseName = filename.replace(/\.[^/.]+$/, '').substring(0, 50);
        // Convert to ASCII-safe characters
        const safeName = baseName
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .toLowerCase();
        return `${timestamp}-${safeName}.${extension}`;
      };
      
      const sanitizedFilename = sanitizeFilename(req.file.originalname);
      const storageKey = `${visibility}/${sanitizedFilename}`;
      
      console.log(`🚀 Uploading to Bunny Storage: ${storageKey}`);
      
      // Upload directly to Bunny Storage using storageAdapter
      const publicUrl = await storageAdapter.upload(
        storageKey,
        req.file.buffer,
        req.file.mimetype
      );

      console.log('✅ Uploaded to Bunny Storage:', publicUrl);

      res.json({ 
        url: publicUrl,  // Returns /api/proxy/public/filename.mp4
        fileName: sanitizedFilename,
        size: req.file.size,
        type: req.file.mimetype,
        storageKey: storageKey
      });
    } catch (error: any) {
      console.error('Error uploading file:', error);
      if (error instanceof AuthenticationError) {
        return res.status(401).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to upload file: ' + error.message });
    }
  });

  // Legacy /objects/ URL support (redirects to /api/proxy/public/)
  app.get("/objects/:filename(*)", async (req, res) => {
    const { filename } = req.params;
    console.log(`🔄 Legacy /objects/ URL redirect: ${filename} → /api/proxy/public/${filename}`);
    res.redirect(`/api/proxy/public/${filename}`);
  });

  // Proxy endpoint for Object Storage files
  // Serves files from Object Storage while respecting visibility and ACL policies
  // Supports Range requests for video streaming
  // Auto-migrates Firebase Storage files to Bunny CDN for faster delivery
  app.get("/api/proxy/:folder/:filename(*)", async (req, res) => {
    try {
      let { folder, filename } = req.params;
      
      // Handle duplicate 'public/public/' or 'private/private/' paths
      if (filename.startsWith('public/') || filename.startsWith('private/')) {
        const parts = filename.split('/');
        folder = parts[0];
        filename = parts.slice(1).join('/');
        console.log(`🔧 Fixed duplicate path: ${req.params.folder}/${req.params.filename} -> ${folder}/${filename}`);
      }
      
      const isBunnyConfigured = !!(process.env.BUNNY_STORAGE_API_KEY && process.env.BUNNY_STORAGE_ZONE_NAME);
      
      console.log('🔍 Proxy request for:', folder, filename, 'Range:', req.headers.range);
      
      // Determine content type from filename
      const ext = filename.toLowerCase().split('.').pop();
      let contentType = 'application/octet-stream';
      if (ext === 'mp4') contentType = 'video/mp4';
      else if (ext === 'mov') contentType = 'video/quicktime';
      else if (ext === 'webm') contentType = 'video/webm';
      else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
      else if (ext === 'png') contentType = 'image/png';
      else if (ext === 'gif') contentType = 'image/gif';
      else if (ext === 'webp') contentType = 'image/webp';
      
      let fileBuffer: Buffer;
      
      // Strategy 1: Try Bunny CDN first (if configured)
      if (isBunnyConfigured) {
        // Use Storage Zone Direct Access instead of Pull Zone CDN
        // This ensures reliable access with authentication
        const storageRegion = process.env.BUNNY_STORAGE_REGION || 'de';
        const regionEndpoints: Record<string, string> = {
          'de': 'storage.bunnycdn.com',
          'ny': 'ny.storage.bunnycdn.com',
          'la': 'la.storage.bunnycdn.com',
          'sg': 'sg.storage.bunnycdn.com',
          'sydney': 'syd.storage.bunnycdn.com',
          'uk': 'uk.storage.bunnycdn.com',
        };
        const storageEndpoint = regionEndpoints[storageRegion] || 'storage.bunnycdn.com';
        
        // Encode filename for URL (Express auto-decodes params, but Bunny CDN needs encoded URLs)
        const encodedFilename = encodeURIComponent(filename);
        const bunnyUrl = `https://${storageEndpoint}/${process.env.BUNNY_STORAGE_ZONE_NAME}/${folder}/${encodedFilename}`;
        
        console.log('🐰 Trying Bunny Storage API:', bunnyUrl);
        
        try {
          // Forward Range header to Bunny Storage for video streaming
          const fetchOptions: RequestInit = {
            headers: {
              'AccessKey': process.env.BUNNY_STORAGE_API_KEY || '',
            }
          };
          if (req.headers.range) {
            fetchOptions.headers = {
              ...fetchOptions.headers,
              'Range': req.headers.range
            };
          }
          
          const bunnyResponse = await fetch(bunnyUrl, fetchOptions);
          if (bunnyResponse.ok || bunnyResponse.status === 206) {
            console.log(`✅ Bunny Storage HIT - Status: ${bunnyResponse.status}`);
            
            // If Bunny Storage returns 206 Partial Content, stream it directly
            if (bunnyResponse.status === 206) {
              const contentRange = bunnyResponse.headers.get('content-range');
              const contentLength = bunnyResponse.headers.get('content-length');
              
              console.log(`📦 Streaming 206 Partial Content: ${contentRange}`);
              
              res.writeHead(206, {
                'Content-Range': contentRange || '',
                'Accept-Ranges': 'bytes',
                'Content-Length': contentLength || '',
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, stale-while-revalidate=86400',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                'Access-Control-Allow-Headers': 'Range',
                'Cross-Origin-Resource-Policy': 'cross-origin',
              });
              
              const arrayBuffer = await bunnyResponse.arrayBuffer();
              return res.end(Buffer.from(arrayBuffer));
            }
            
            // Otherwise, handle as full file download
            const arrayBuffer = await bunnyResponse.arrayBuffer();
            fileBuffer = Buffer.from(arrayBuffer);
          } else {
            console.log('⚠️ Bunny Storage MISS - Migrating from Firebase...');
            throw new Error('Not in Bunny Storage yet');
          }
        } catch (bunnyCdnError) {
          // File not in Bunny CDN, download from Firebase and migrate
          const { ObjectStorageService } = await import("./objectStorage");
          const { storage } = await import('./firebase');
          const objectStorageService = new ObjectStorageService();
          
          const objectPath = `/objects/${filename}`;
          const filePath = await objectStorageService.getObjectEntityFile(objectPath);
          
          console.log('📥 Downloading from Firebase:', filePath);
          
          const bucket = storage.bucket();
          const file = bucket.file(filePath);
          const [fbBuffer] = await file.download();
          
          if (!fbBuffer || fbBuffer.length === 0) {
            return res.status(404).json({ error: 'File not found' });
          }
          
          fileBuffer = fbBuffer;
          console.log('✅ Firebase download complete:', fileBuffer.length, 'bytes');
          
          // Auto-migrate to Bunny CDN in background (don't wait)
          (async () => {
            try {
              const { storageAdapter } = await import('./storage-adapter');
              const bunnyKey = `${folder}/${filename}`;
              await storageAdapter.upload(bunnyKey, fileBuffer, contentType);
              console.log('🚀 Auto-migrated to Bunny CDN:', bunnyKey);
            } catch (migrationError) {
              console.error('⚠️ Migration to Bunny CDN failed:', migrationError);
            }
          })();
        }
      } else {
        // No Bunny CDN, use Firebase Storage only
        const { ObjectStorageService } = await import("./objectStorage");
        const { storage } = await import('./firebase');
        const objectStorageService = new ObjectStorageService();
        
        const objectPath = `/objects/${filename}`;
        const filePath = await objectStorageService.getObjectEntityFile(objectPath);
        
        console.log('📥 Downloading from Firebase:', filePath);
        
        const bucket = storage.bucket();
        const file = bucket.file(filePath);
        const [fbBuffer] = await file.download();
        
        if (!fbBuffer || fbBuffer.length === 0) {
          return res.status(404).json({ error: 'File not found' });
        }
        
        fileBuffer = fbBuffer;
        console.log('✅ Downloaded from Firebase:', fileBuffer.length, 'bytes');
      }
      
      const fileSize = fileBuffer.length;
      
      // Handle Range requests for video streaming
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;
        
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, stale-while-revalidate=86400',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Range',
          'Cross-Origin-Resource-Policy': 'cross-origin',
        });
        
        res.end(fileBuffer.slice(start, end + 1));
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, stale-while-revalidate=86400',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Range',
          'Cross-Origin-Resource-Policy': 'cross-origin',
        });
        
        res.end(fileBuffer);
      }
    } catch (error: any) {
      console.error('Error proxying file:', error);
      
      // Don't try to send response if headers already sent
      if (res.headersSent) {
        return;
      }
      
      // Only redirect to default avatar for actual avatar images (containing 'avatar' in filename)
      const { filename } = req.params;
      if (filename.match(/\.(png|jpg|jpeg|gif)$/i) && filename.toLowerCase().includes('avatar')) {
        console.log(`⚠️ Avatar image not found, redirecting to default avatar`);
        // Redirect to a default avatar
        const defaultAvatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + filename;
        return res.redirect(defaultAvatar);
      }
      
      // For other images/videos (post thumbnails), return 404
      console.log(`⚠️ File not found: ${filename}`);
      res.status(404).json({ error: 'File not found' });
    }
  });

  // Proxy endpoint for Bunny Stream thumbnails
  // Fetches thumbnail using Bunny Stream API with authentication
  // Falls back to generated thumbnail if Bunny Stream thumbnail is not available
  app.get("/api/bunny-stream-thumbnail/:videoGuid", async (req, res) => {
    try {
      const { videoGuid } = req.params;
      
      const { bunnyStreamClient } = await import('./bunny-stream');
      
      if (!bunnyStreamClient.isConfigured()) {
        return res.status(503).json({ error: 'Bunny Stream not configured' });
      }
      
      console.log('🖼️ Fetching Bunny Stream thumbnail for:', videoGuid);
      
      // Get video info from Bunny Stream API (authenticated request)
      const videoInfo = await bunnyStreamClient.getVideo(videoGuid);
      
      if (!videoInfo) {
        console.error('⚠️ Video not found in Bunny Stream:', videoGuid);
        return res.status(404).json({ error: 'Video not found' });
      }
      
      // Check if video is still processing
      if (videoInfo.status !== 4) { // status 4 = finished processing
        console.log(`⏱️ Video still processing (status: ${videoInfo.status}), thumbnail may not be available yet`);
      }
      
      // Try multiple thumbnail sources in order of preference
      const thumbnailSources = [
        videoInfo.thumbnailUrl, // Official thumbnail from Bunny Stream metadata
        bunnyStreamClient.getThumbnailUrl(videoGuid, 1280, 720), // High quality
        bunnyStreamClient.getThumbnailUrl(videoGuid, 640, 360), // Medium quality
        bunnyStreamClient.getThumbnailUrl(videoGuid), // Default size
      ].filter(Boolean);
      
      let thumbnailBuffer: Buffer | null = null;
      let successfulUrl: string | null = null;
      
      // Try each thumbnail source
      for (const thumbnailUrl of thumbnailSources) {
        try {
          console.log('🖼️ Trying thumbnail source:', thumbnailUrl);
          const response = await fetch(thumbnailUrl);
          
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            thumbnailBuffer = Buffer.from(arrayBuffer);
            successfulUrl = thumbnailUrl;
            console.log('✅ Successfully fetched thumbnail from:', thumbnailUrl);
            break;
          } else {
            console.log(`⚠️ Thumbnail fetch failed (${response.status}):`, thumbnailUrl);
          }
        } catch (error) {
          console.log('⚠️ Error fetching thumbnail:', error);
          continue;
        }
      }
      
      // If no Bunny Stream thumbnail available, return 404 to trigger frontend fallback
      if (!thumbnailBuffer) {
        console.log('❌ No Bunny Stream thumbnail available, letting frontend use generated thumbnail');
        return res.status(404).json({ 
          error: 'Thumbnail not available',
          videoStatus: videoInfo.status,
          message: 'Video is still processing or thumbnail not yet generated'
        });
      }
      
      // Send thumbnail with proper CORS headers
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': thumbnailBuffer.length,
        'Cache-Control': videoInfo.status === 4 ? 'public, max-age=86400' : 'public, max-age=300', // 24h if processed, 5min if processing
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'X-Thumbnail-Source': successfulUrl || 'unknown',
      });
      
      res.end(thumbnailBuffer);
    } catch (error: any) {
      console.error('Error proxying Bunny Stream thumbnail:', error);
      
      // Return 404 to trigger frontend fallback instead of 500
      res.status(404).json({ 
        error: 'Failed to fetch thumbnail',
        message: 'Thumbnail temporarily unavailable, using fallback'
      });
    }
  });

  // Get video URL with quality restriction based on subscription level
  app.get("/api/video-url/:creatorId/:videoGuid", async (req, res) => {
    try {
      const { creatorId, videoGuid } = req.params;
      const userId = req.query.userId as string;

      if (!userId) {
        // No user ID provided - return basic quality (720p)
        const { bunnyStreamClient } = await import('./bunny-stream');
        const videoUrl = bunnyStreamClient.getQualityRestrictedUrl(videoGuid, 'free');
        return res.json({ videoUrl, quality: '720p', subscriptionLevel: 'free' });
      }

      // Check user's subscription level for this creator
      const { firestore } = await import('./firebase');
      const subscriptionDoc = await firestore
        .collection('users')
        .doc(userId)
        .collection('subscriptions')
        .doc(creatorId)
        .get();

      let subscriptionLevel = 'free';
      if (subscriptionDoc.exists) {
        const subData = subscriptionDoc.data();
        if (subData && subData.status === 'active') {
          // Determine subscription level from planId or planLevel
          if (subData.planLevel === 3 || subData.planId?.toLowerCase().includes('vip')) {
            subscriptionLevel = 'vip';
          } else if (subData.planLevel === 2 || subData.planId?.toLowerCase().includes('premium')) {
            subscriptionLevel = 'premium';
          } else {
            subscriptionLevel = 'basic';
          }
        }
      }

      // Get quality-restricted video URL
      const { bunnyStreamClient } = await import('./bunny-stream');
      const videoUrl = bunnyStreamClient.getQualityRestrictedUrl(videoGuid, subscriptionLevel);

      const qualityMap: Record<string, string> = {
        'free': '720p',
        'basic': '720p',
        'premium': '1080p',
        'vip': '4K',
        'high': '4K'
      };

      res.json({ 
        videoUrl, 
        quality: qualityMap[subscriptionLevel] || '720p',
        subscriptionLevel 
      });

    } catch (error: any) {
      console.error('Error getting video URL:', error);
      res.status(500).json({ error: 'Failed to get video URL' });
    }
  });

  // Cancel Subscription API
  // Reference: blueprint:javascript_stripe integration
  app.post("/api/cancel-subscription", async (req, res) => {
    try {
      const { subscriptionId, userId, creatorId } = req.body;

      if (!subscriptionId || !userId || !creatorId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      if (!stripe) {
        return res.status(500).json({ error: "Payment system not configured" });
      }

      // Cancel subscription in Stripe
      const canceledSubscription = await stripe.subscriptions.cancel(subscriptionId);

      console.log(`🚫 Subscription ${subscriptionId} cancelled by user ${userId}`);

      // Update subscription status in Firestore
      const { firestore, admin } = await import('./firebase');
      await firestore
        .collection('users')
        .doc(userId)
        .collection('subscriptions')
        .doc(creatorId)
        .update({
          status: 'cancelled',
          cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      res.json({
        success: true,
        subscription: canceledSubscription,
        message: 'サブスクリプションが解約されました',
      });
    } catch (error: any) {
      console.error('Error cancelling subscription:', error);
      res.status(500).json({ error: 'サブスクリプションの解約に失敗しました: ' + error.message });
    }
  });

  // Stripe Webhook endpoint (MUST be before express.json() middleware)
  // Reference: blueprint:javascript_stripe integration
  app.post("/api/webhook/stripe",
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      const sig = req.headers['stripe-signature'];
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!webhookSecret) {
        console.error('STRIPE_WEBHOOK_SECRET is not set');
        return res.status(500).send('Webhook secret not configured');
      }

      if (!stripe) {
        console.error('Stripe is not configured');
        return res.status(500).send('Stripe not configured');
      }

      let event;

      try {
        // Verify webhook signature
        event = stripe.webhooks.constructEvent(req.body, sig as string, webhookSecret);
      } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      console.log(`🔔 Webhook received: ${event.type}`);

      // Handle the event
      try {
        const { firestore, admin } = await import('./firebase');

        switch (event.type) {
          case 'invoice.payment_succeeded': {
            const invoice = event.data.object as any;
            const customerId = invoice.customer as string;
            const subscriptionId = invoice.subscription as string;

            if (subscriptionId) {
              // Retrieve subscription to get metadata
              const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
              const metadata = subscription.metadata;

              if (subscription.status === 'active') {
                const userId = metadata.userId;
                const creatorId = metadata.creatorId;
                const planId = metadata.planId;
                const planTitle = metadata.planTitle;
                const basePrice = parseInt(metadata.basePrice || '0');
                const tax = parseInt(metadata.tax || '0');
                const platformFee = parseInt(metadata.platformFee || '0');
                const totalAmount = basePrice + tax + platformFee;

                // Check billing reason
                const billingReason = invoice.billing_reason;
                const isInitialPayment = billingReason === 'subscription_create';
                const isRecurring = billingReason === 'subscription_cycle';

                console.log(`💰 Payment succeeded for subscription ${subscriptionId}`);
                console.log(`   User: ${userId}, Creator: ${creatorId}`);
                console.log(`   Type: ${isInitialPayment ? 'Initial' : isRecurring ? 'Recurring' : 'Other'}`);

                // 1. Save purchase record
                await firestore.collection('purchases').add({
                  userId,
                  creatorId,
                  creatorName: metadata.creatorName,
                  planId,
                  planTitle,
                  amount: totalAmount,
                  creatorAmount: basePrice,
                  platformFee,
                  tax,
                  currency: 'JPY',
                  status: 'completed',
                  paymentMethod: 'stripe_subscription',
                  type: 'subscription',
                  subscriptionId,
                  customerId,
                  billingReason,
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                // 2. Update creator balance
                const creatorRef = firestore.collection('users').doc(creatorId);
                await creatorRef.update({
                  availableBalance: admin.firestore.FieldValue.increment(basePrice),
                  totalEarnings: admin.firestore.FieldValue.increment(basePrice),
                });

                // 3. Save/update subscription info (only on initial payment)
                if (isInitialPayment) {
                  // Determine plan level
                  let planLevel = 1;
                  if (planId.toLowerCase().includes('vip')) {
                    planLevel = 3;
                  } else if (planId.toLowerCase().includes('premium')) {
                    planLevel = 2;
                  }

                  await firestore
                    .collection('users')
                    .doc(userId)
                    .collection('subscriptions')
                    .doc(creatorId)
                    .set({
                      creatorId,
                      creatorName: metadata.creatorName,
                      planId,
                      planTitle,
                      planLevel,
                      price: basePrice,
                      status: 'active',
                      subscriptionId,
                      customerId,
                      startDate: admin.firestore.FieldValue.serverTimestamp(),
                      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                      nextBillingDate: new Date(subscription.current_period_end * 1000),
                    });

                  console.log(`✅ Initial subscription activated for user ${userId}`);
                } else {
                  // Update next billing date for recurring payments
                  await firestore
                    .collection('users')
                    .doc(userId)
                    .collection('subscriptions')
                    .doc(creatorId)
                    .update({
                      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                      nextBillingDate: new Date(subscription.current_period_end * 1000),
                    });

                  console.log(`✅ Recurring payment processed for user ${userId}`);
                }
              }
            }
            break;
          }

          case 'customer.subscription.deleted': {
            const subscription = event.data.object;
            const metadata = subscription.metadata;
            const userId = metadata.userId;
            const creatorId = metadata.creatorId;

            console.log(`🚫 Subscription cancelled: User ${userId}, Creator ${creatorId}`);

            // Update subscription status to cancelled
            await firestore
              .collection('users')
              .doc(userId)
              .collection('subscriptions')
              .doc(creatorId)
              .update({
                status: 'cancelled',
                cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
              });

            console.log(`✅ Subscription marked as cancelled`);
            break;
          }

          case 'customer.subscription.updated': {
            const subscription = event.data.object as any;
            const metadata = subscription.metadata;
            const userId = metadata.userId;
            const creatorId = metadata.creatorId;

            console.log(`📝 Subscription updated: User ${userId}, Creator ${creatorId}`);

            // Update subscription status
            await firestore
              .collection('users')
              .doc(userId)
              .collection('subscriptions')
              .doc(creatorId)
              .update({
                status: subscription.status,
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                nextBillingDate: new Date(subscription.current_period_end * 1000),
              });

            console.log(`✅ Subscription status updated to ${subscription.status}`);
            break;
          }

          default:
            console.log(`Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
      } catch (error: any) {
        console.error(`Error processing webhook ${event.type}:`, error);
        res.status(500).json({ error: 'Webhook processing failed' });
      }
    }
  );

  const httpServer = createServer(app);

  return httpServer;
}
