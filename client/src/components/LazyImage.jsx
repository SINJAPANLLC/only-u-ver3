import { useState, useEffect } from 'react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { getCachedMedia, cacheMedia } from '@/utils/mediaCache';

const LazyImage = ({ 
    src, 
    alt, 
    className = '', 
    style = {},
    placeholder = null,
    onLoad = () => {},
    ...props 
}) => {
    const { targetRef, hasIntersected } = useIntersectionObserver({
        rootMargin: '100px',
        threshold: 0.01
    });
    
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [cachedSrc, setCachedSrc] = useState(null);

    useEffect(() => {
        if (!src) return;
        
        const cached = getCachedMedia(src);
        if (cached) {
            setCachedSrc(cached);
        }
    }, [src]);

    const handleLoad = (e) => {
        if (src && !getCachedMedia(src)) {
            cacheMedia(src, src);
        }
        setIsLoaded(true);
        onLoad(e);
    };

    const handleError = () => {
        setHasError(true);
    };

    return (
        <div ref={targetRef} className={`relative ${className}`} style={style}>
            {!hasIntersected && placeholder && (
                <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse" />
            )}
            
            {hasIntersected && (
                <>
                    {!isLoaded && !hasError && (
                        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    )}
                    
                    <img
                        src={cachedSrc || src}
                        alt={alt}
                        className={`${className} transition-opacity duration-300 ${
                            isLoaded ? 'opacity-100' : 'opacity-0'
                        }`}
                        style={style}
                        onLoad={handleLoad}
                        onError={handleError}
                        loading="lazy"
                        {...props}
                    />
                    
                    {hasError && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-700">
                            <span className="text-gray-400 text-sm">画像を読み込めません</span>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default LazyImage;
