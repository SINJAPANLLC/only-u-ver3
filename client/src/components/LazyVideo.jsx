import { useState, useRef } from 'react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';

const LazyVideo = ({ 
    src, 
    poster,
    className = '', 
    style = {},
    autoPlay = false,
    muted = true,
    loop = false,
    playsInline = true,
    controls = false,
    onLoadStart = () => {},
    ...props 
}) => {
    const { targetRef, hasIntersected } = useIntersectionObserver({
        rootMargin: '150px',
        threshold: 0.01
    });
    
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const videoRef = useRef(null);

    const handleLoadStart = () => {
        setIsLoaded(true);
        onLoadStart();
    };

    const handleError = () => {
        setHasError(true);
    };

    return (
        <div ref={targetRef} className={`relative ${className}`} style={style}>
            {!hasIntersected && poster && (
                <div 
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${poster})` }}
                />
            )}
            
            {!hasIntersected && !poster && (
                <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse" />
            )}
            
            {hasIntersected && (
                <>
                    {!isLoaded && !hasError && (
                        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    )}
                    
                    <video
                        ref={videoRef}
                        src={src}
                        poster={poster}
                        className={`${className} transition-opacity duration-300 ${
                            isLoaded ? 'opacity-100' : 'opacity-0'
                        }`}
                        style={style}
                        autoPlay={autoPlay}
                        muted={muted}
                        loop={loop}
                        playsInline={playsInline}
                        controls={controls}
                        onLoadStart={handleLoadStart}
                        onError={handleError}
                        preload="metadata"
                        {...props}
                    />
                    
                    {hasError && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-700">
                            <span className="text-gray-400 text-sm">動画を読み込めません</span>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default LazyVideo;
