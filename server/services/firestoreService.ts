import { firestore } from '../firebase';
import { NotFoundError, ConflictError, ValidationError, InternalServerError, AuthorizationError, AuthenticationError, AppError } from '../middleware/errorHandler';

function handleFirestoreError(error: unknown, defaultMessage: string): never {
  if (error instanceof AppError) {
    throw error;
  }

  if (error && typeof error === 'object' && 'code' in error) {
    const firestoreError = error as { code: string; message?: string };
    
    switch (firestoreError.code) {
      case 'not-found':
      case 'NOT_FOUND':
        throw new NotFoundError('Resource not found');
      
      case 'already-exists':
      case 'ALREADY_EXISTS':
        throw new ConflictError('Resource already exists');
      
      case 'permission-denied':
      case 'PERMISSION_DENIED':
        throw new AuthorizationError('Permission denied');
      
      case 'invalid-argument':
      case 'INVALID_ARGUMENT':
        throw new ValidationError('Invalid input data');
      
      case 'failed-precondition':
      case 'FAILED_PRECONDITION':
        throw new ValidationError('Operation precondition failed');
      
      case 'unauthenticated':
      case 'UNAUTHENTICATED':
        throw new AuthenticationError('Authentication required');
      
      default:
        console.error('Unhandled Firestore error:', firestoreError);
        throw new InternalServerError(defaultMessage);
    }
  }

  console.error('Unknown error:', error);
  throw new InternalServerError(defaultMessage);
}

export interface UserData {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  bio?: string;
  isCreator: boolean;
  creatorStatus?: 'pending' | 'approved' | 'rejected';
  role?: 'user' | 'admin';
  subscriptions?: string[];
  followers?: number;
  following?: number;
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
}

export interface PostData {
  id?: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  mediaUrl?: string;
  mediaType: 'image' | 'video';
  visibility: 'public' | 'subscribers' | 'purchasers';
  price?: number;
  creatorId: string;
  tags?: string[];
  likes?: number;
  views?: number;
  duration?: number;
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
}

export interface NotificationData {
  id?: string;
  userId: string;
  type: 'like' | 'comment' | 'subscription' | 'purchase' | 'system';
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt?: FirebaseFirestore.Timestamp;
}

export class FirestoreService {
  async getUser(userId: string): Promise<UserData | null> {
    try {
      const userDoc = await firestore.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        return null;
      }
      return { uid: userId, ...userDoc.data() } as UserData;
    } catch (error) {
      handleFirestoreError(error, 'Failed to fetch user data');
    }
  }

  async createUser(userId: string, userData: Partial<UserData>): Promise<void> {
    try {
      const existing = await this.getUser(userId);
      if (existing) {
        throw new ConflictError('User already exists');
      }

      await firestore.collection('users').doc(userId).set({
        ...userData,
        uid: userId,
        createdAt: FirebaseFirestore.FieldValue.serverTimestamp(),
        updatedAt: FirebaseFirestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, 'Failed to create user');
    }
  }

  async updateUser(userId: string, updates: Partial<UserData>): Promise<void> {
    try {
      await firestore.collection('users').doc(userId).update({
        ...updates,
        updatedAt: FirebaseFirestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, 'Failed to update user');
    }
  }

  async getPost(postId: string): Promise<PostData | null> {
    try {
      const postDoc = await firestore.collection('posts').doc(postId).get();
      if (!postDoc.exists) {
        return null;
      }
      return { id: postId, ...postDoc.data() } as PostData;
    } catch (error) {
      handleFirestoreError(error, 'Failed to fetch post data');
    }
  }

  async createPost(postData: PostData): Promise<string> {
    try {
      const postRef = await firestore.collection('posts').add({
        ...postData,
        createdAt: FirebaseFirestore.FieldValue.serverTimestamp(),
        updatedAt: FirebaseFirestore.FieldValue.serverTimestamp(),
      });
      return postRef.id;
    } catch (error) {
      handleFirestoreError(error, 'Failed to create post');
    }
  }

  async updatePost(postId: string, updates: Partial<PostData>): Promise<void> {
    try {
      await firestore.collection('posts').doc(postId).update({
        ...updates,
        updatedAt: FirebaseFirestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, 'Failed to update post');
    }
  }

  async deletePost(postId: string): Promise<void> {
    try {
      await firestore.collection('posts').doc(postId).delete();
    } catch (error) {
      handleFirestoreError(error, 'Failed to delete post');
    }
  }

  async getPostsByCreator(
    creatorId: string,
    limit = 20,
    orderBy: 'createdAt' | 'likes' | 'views' = 'createdAt'
  ): Promise<PostData[]> {
    try {
      const snapshot = await firestore
        .collection('posts')
        .where('creatorId', '==', creatorId)
        .orderBy(orderBy, 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as PostData[];
    } catch (error) {
      handleFirestoreError(error, 'Failed to fetch posts');
    }
  }

  async createNotification(notificationData: NotificationData): Promise<string> {
    try {
      const notifRef = await firestore.collection('notifications').add({
        ...notificationData,
        read: false,
        createdAt: FirebaseFirestore.FieldValue.serverTimestamp(),
      });
      return notifRef.id;
    } catch (error) {
      handleFirestoreError(error, 'Failed to create notification');
    }
  }

  async getUserNotifications(
    userId: string,
    limit = 20,
    unreadOnly = false
  ): Promise<NotificationData[]> {
    try {
      let query = firestore
        .collection('notifications')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit);

      if (unreadOnly) {
        query = query.where('read', '==', false);
      }

      const snapshot = await query.get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as NotificationData[];
    } catch (error) {
      handleFirestoreError(error, 'Failed to fetch notifications');
    }
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    try {
      await firestore.collection('notifications').doc(notificationId).update({
        read: true,
      });
    } catch (error) {
      handleFirestoreError(error, 'Failed to mark notification as read');
    }
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    try {
      const snapshot = await firestore
        .collection('notifications')
        .where('userId', '==', userId)
        .where('read', '==', false)
        .get();

      const batch = firestore.batch();
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { read: true });
      });

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, 'Failed to mark all notifications as read');
    }
  }

  async incrementPostViews(postId: string): Promise<void> {
    try {
      await firestore.collection('posts').doc(postId).update({
        views: FirebaseFirestore.FieldValue.increment(1),
      });
    } catch (error) {
      handleFirestoreError(error, 'Failed to increment post views');
    }
  }

  async incrementPostLikes(postId: string): Promise<void> {
    try {
      await firestore.collection('posts').doc(postId).update({
        likes: FirebaseFirestore.FieldValue.increment(1),
      });
    } catch (error) {
      handleFirestoreError(error, 'Failed to increment post likes');
    }
  }

  async decrementPostLikes(postId: string): Promise<void> {
    try {
      await firestore.collection('posts').doc(postId).update({
        likes: FirebaseFirestore.FieldValue.increment(-1),
      });
    } catch (error) {
      handleFirestoreError(error, 'Failed to decrement post likes');
    }
  }
}

export const firestoreService = new FirestoreService();
