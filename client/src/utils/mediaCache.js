const mediaCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5分

export const cacheMedia = (url, data) => {
    if (!url) return;
    
    mediaCache.set(url, {
        data,
        timestamp: Date.now()
    });
};

export const getCachedMedia = (url) => {
    if (!url) return null;
    
    const cached = mediaCache.get(url);
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    if (age > CACHE_DURATION) {
        mediaCache.delete(url);
        return null;
    }
    
    return cached.data;
};

export const clearMediaCache = () => {
    mediaCache.clear();
};

export const getCacheSize = () => {
    return mediaCache.size;
};
