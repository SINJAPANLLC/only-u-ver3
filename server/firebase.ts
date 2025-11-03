// Firebase Admin SDK initialization singleton
// This ensures firebase-admin is initialized only once and can be safely imported
import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  try {
    const serviceAccountPath = join(process.cwd(), 'firebase-admin-key.json');
    
    if (existsSync(serviceAccountPath)) {
      console.log('🔑 Initializing Firebase with service account key file...');
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: 'onlyu1020-c6696.firebasestorage.app',
      });
      console.log('✅ Firebase initialized with service account key');
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.log('🔑 Initializing Firebase with service account from environment...');
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: 'onlyu1020-c6696.firebasestorage.app',
      });
      console.log('✅ Firebase initialized from environment');
    } else {
      console.warn('⚠️  No Firebase credentials found - running without Storage access');
      console.warn('⚠️  Set FIREBASE_SERVICE_ACCOUNT environment variable or provide firebase-admin-key.json');
      
      admin.initializeApp({
        projectId: 'onlyu1020-c6696',
        storageBucket: 'onlyu1020-c6696.firebasestorage.app',
      });
      console.log('✅ Firebase initialized (Auth/Firestore only - Storage will fail)');
    }
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    throw error;
  }
}

export { admin };
export const firestore = admin.firestore();
export const auth = admin.auth();
export const storage = admin.storage();
