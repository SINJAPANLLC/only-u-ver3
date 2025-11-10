import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import logger from '../utils/logger';

// Create the AuthContext
const AuthContext = createContext();

// Custom hook to use the AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Helper function to ensure user document exists
const ensureUserDocument = async (user) => {
  if (!user) return;
  
  try {
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      await setDoc(userDocRef, {
        displayName: user.displayName || 'ユーザー',
        email: user.email,
        photoURL: user.photoURL || null,
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        isOnline: true,
        bio: '',
        username: `@user${user.uid.slice(0, 6)}`,
        postsCount: 0,
        likesCount: 0,
        followersCount: 0,
        followingCount: 0
      });
      logger.log('Created Firestore document for user:', user.uid);
    } else {
      await setDoc(userDocRef, {
        lastSeen: new Date().toISOString(),
        isOnline: true
      }, { merge: true });
    }
  } catch (error) {
    logger.error('Error creating/updating user document:', error);
  }
};

// AuthProvider component
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      logger.log('Auth state changed:', user);
      
      if (user) {
        await ensureUserDocument(user);
      }
      
      setCurrentUser(user);
      setIsAuthenticated(!!user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    isAuthenticated,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
