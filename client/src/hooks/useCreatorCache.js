import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, documentId, query, collection, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const globalCreatorCache = new Map();
const pendingRequests = new Map();

export const useCreatorCache = () => {
  const [loading, setLoading] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const getCreator = useCallback(async (userId) => {
    if (!userId) return null;

    if (globalCreatorCache.has(userId)) {
      return globalCreatorCache.get(userId);
    }

    if (pendingRequests.has(userId)) {
      return pendingRequests.get(userId);
    }

    const promise = (async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const creatorData = {
            id: userDoc.id,
            displayName: userDoc.data().displayName,
            avatar: userDoc.data().avatar,
            photoURL: userDoc.data().photoURL,
            username: userDoc.data().username,
            isCreator: userDoc.data().isCreator,
            subscriptionPrice: userDoc.data().subscriptionPrice
          };
          globalCreatorCache.set(userId, creatorData);
          return creatorData;
        }
        return null;
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error(`Failed to fetch creator ${userId}:`, error);
        }
        return null;
      } finally {
        pendingRequests.delete(userId);
      }
    })();

    pendingRequests.set(userId, promise);
    return promise;
  }, []);

  const getCreatorsBatch = useCallback(async (userIds) => {
    if (!userIds || userIds.length === 0) return {};

    const uniqueIds = [...new Set(userIds)];
    const uncachedIds = uniqueIds.filter(id => !globalCreatorCache.has(id) && !pendingRequests.has(id));

    if (uncachedIds.length === 0) {
      const pendingPromises = uniqueIds
        .filter(id => pendingRequests.has(id))
        .map(id => pendingRequests.get(id));
      
      if (pendingPromises.length > 0) {
        await Promise.allSettled(pendingPromises);
      }

      return Object.fromEntries(
        uniqueIds.map(id => [id, globalCreatorCache.get(id) || null])
      );
    }

    if (isMounted.current) {
      setLoading(true);
    }

    try {
      const batchSize = 10;
      const batches = [];

      for (let i = 0; i < uncachedIds.length; i += batchSize) {
        const batch = uncachedIds.slice(i, i + batchSize);
        batches.push(batch);
      }

      const batchKey = `batch_${uncachedIds.join('_')}`;
      const batchPromise = (async () => {
        try {
          await Promise.all(
            batches.map(async (batch) => {
              const q = query(
                collection(db, 'users'),
                where(documentId(), 'in', batch)
              );
              const snapshot = await getDocs(q);
              
              snapshot.docs.forEach(doc => {
                const creatorData = {
                  id: doc.id,
                  displayName: doc.data().displayName,
                  avatar: doc.data().avatar,
                  photoURL: doc.data().photoURL,
                  username: doc.data().username,
                  isCreator: doc.data().isCreator,
                  subscriptionPrice: doc.data().subscriptionPrice
                };
                globalCreatorCache.set(doc.id, creatorData);
              });
            })
          );
        } finally {
          pendingRequests.delete(batchKey);
        }
      })();

      pendingRequests.set(batchKey, batchPromise);
      await batchPromise;

      return Object.fromEntries(
        uniqueIds.map(id => [id, globalCreatorCache.get(id) || null])
      );
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching creators batch:', error);
      }
      return {};
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  const clearCache = useCallback(() => {
    globalCreatorCache.clear();
  }, []);

  const preloadCreators = useCallback(async (userIds) => {
    if (!userIds || userIds.length === 0) return;
    await getCreatorsBatch(userIds);
  }, [getCreatorsBatch]);

  return {
    getCreator,
    getCreatorsBatch,
    clearCache,
    preloadCreators,
    loading
  };
};

export const getCreatorFromCache = (userId) => {
  return globalCreatorCache.get(userId) || null;
};

export const clearGlobalCache = () => {
  globalCreatorCache.clear();
  pendingRequests.clear();
};
