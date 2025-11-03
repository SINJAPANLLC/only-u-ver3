import { Request, Response, NextFunction } from 'express';
import { auth } from '../firebase';
import { AuthenticationError, AuthorizationError } from './errorHandler';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export async function verifyFirebaseToken(
  authHeader: string | undefined
): Promise<{ uid: string; email?: string }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthenticationError('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7);
  
  if (!token || token.trim() === '') {
    throw new AuthenticationError('Empty authentication token');
  }

  try {
    const decodedToken = await auth.verifyIdToken(token);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    throw new AuthenticationError('Invalid or expired authentication token');
  }
}

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { uid, email } = await verifyFirebaseToken(req.headers.authorization);
    req.userId = uid;
    req.userEmail = email;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireCreator = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { uid } = await verifyFirebaseToken(req.headers.authorization);
    req.userId = uid;

    const { firestore } = await import('../firebase');
    const userDoc = await firestore.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      throw new AuthorizationError('User not found');
    }

    const userData = userDoc.data();
    if (!userData?.isCreator) {
      throw new AuthorizationError('Creator account required');
    }

    if (userData.creatorStatus !== 'approved') {
      throw new AuthorizationError('Creator account not approved');
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const requireAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { uid } = await verifyFirebaseToken(req.headers.authorization);
    req.userId = uid;

    const { firestore } = await import('../firebase');
    const userDoc = await firestore.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      throw new AuthorizationError('User not found');
    }

    const userData = userDoc.data();
    if (userData?.role !== 'admin') {
      throw new AuthorizationError('Admin access required');
    }

    next();
  } catch (error) {
    next(error);
  }
};
