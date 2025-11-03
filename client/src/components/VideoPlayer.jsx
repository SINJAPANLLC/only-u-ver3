import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { Play, Pause, Volume2, VolumeX, Settings, Maximize } from 'lucide-react';

const VideoPlayer = memo(({ 
  videoUrl, 
  posterUrl, 
  title, 
  isSubscribed = false,
  onQualityChange 
}) => {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const progressRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState('720p');
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekTime, setSeekTime] = useState(0);

  const qualityOptions = [
    { id: '720p', label: '720p', available: true },
    { id: '1080p', label: '1080p', available: true },
    { id: '4k', label: '4K', available: isSubscribed }
  ];

  // Intersection Observer for lazy loading
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          } else {
            setIsVisible(false);
            // 画面外に出たら動画を一時停止してパフォーマンスを改善
            if (videoRef.current && !videoRef.current.paused) {
              videoRef.current.pause();
            }
          }
        });
      },
      {
        threshold: 0.1, // 10%表示されたらロード
        rootMargin: '50px' // 50px手前からロード開始
      }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVisible) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [isVisible]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (video.paused) {
      video.play().catch((error) => {
        console.error('Auto-play failed:', error);
      });
    } else {
      video.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const handleQualityChange = useCallback((quality) => {
    setSelectedQuality(quality);
    setShowQualityMenu(false);
    if (onQualityChange) {
      onQualityChange(quality);
    }
  }, [onQualityChange]);

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e) => {
    const video = videoRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const newTime = (clickX / width) * duration;
    video.currentTime = newTime;
  };

  const handleSeekStart = useCallback((e) => {
    e.preventDefault();
    setIsSeeking(true);
    const video = videoRef.current;
    if (video && !video.paused) {
      video.pause();
    }
  }, []);

  const handleSeekMove = useCallback((e) => {
    if (!isSeeking) return;
    
    const progress = progressRef.current;
    if (!progress) return;

    const rect = progress.getBoundingClientRect();
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const width = rect.width;
    const newTime = (clickX / width) * duration;
    
    setSeekTime(newTime);
  }, [isSeeking, duration]);

  const handleSeekEnd = useCallback(() => {
    if (!isSeeking) return;
    
    const video = videoRef.current;
    if (video) {
      video.currentTime = seekTime;
      if (isPlaying) {
        video.play().catch(console.error);
      }
    }
    
    setIsSeeking(false);
  }, [isSeeking, seekTime, isPlaying]);

  useEffect(() => {
    if (isSeeking) {
      const handleMove = (e) => handleSeekMove(e);
      const handleEnd = () => handleSeekEnd();

      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleMove);
      document.addEventListener('touchend', handleEnd);

      return () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('touchend', handleEnd);
      };
    }
  }, [isSeeking, handleSeekMove, handleSeekEnd]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-black rounded-lg overflow-hidden group"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        poster={posterUrl}
        muted={isMuted}
        loop
        preload={isVisible ? "metadata" : "none"}
        playsInline
        data-testid="video-player"
      >
        {isVisible && <source src={videoUrl} type="video/mp4" />}
      </video>

      {/* Overlay Controls */}
      {showControls && (
        <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
          <button
            onClick={togglePlay}
            className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center hover:bg-opacity-30 transition-all"
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 text-white" />
            ) : (
              <Play className="w-8 h-8 text-white ml-1" />
            )}
          </button>
        </div>
      )}

      {/* Bottom Controls - Glass Morphism */}
      <div className={`absolute bottom-0 left-0 right-0 p-4 transition-all duration-300 ${
        showControls ? 'opacity-100' : 'opacity-0'
      }`}>
        <div className="glass-dark rounded-2xl p-4 shadow-elevated">
        {/* Progress Bar - 3D with Draggable Thumb */}
        <div 
          ref={progressRef}
          className="relative w-full h-2 bg-white/20 rounded-full mb-4 cursor-pointer shadow-inner group/progress"
          onClick={handleProgressClick}
        >
          {/* Progress Fill */}
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-pink-500 to-purple-600 rounded-full transition-all shadow-glow"
            style={{ width: `${((isSeeking ? seekTime : currentTime) / duration) * 100}%` }}
          />
          
          {/* Draggable Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg cursor-grab active:cursor-grabbing transform transition-all group-hover/progress:scale-125 hover:scale-150"
            style={{ 
              left: `${((isSeeking ? seekTime : currentTime) / duration) * 100}%`,
              marginLeft: '-8px'
            }}
            onMouseDown={handleSeekStart}
            onTouchStart={handleSeekStart}
          >
            {/* Inner gradient */}
            <div className="absolute inset-0.5 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full" />
            
            {/* Glow effect on hover */}
            <div className="absolute -inset-2 bg-gradient-to-r from-pink-500/50 to-purple-600/50 rounded-full blur-md opacity-0 group-hover/progress:opacity-100 transition-opacity" />
          </div>

          {/* Time tooltip on hover */}
          {isSeeking && (
            <div 
              className="absolute -top-10 bg-black/80 text-white text-xs px-2 py-1 rounded backdrop-blur-sm"
              style={{ 
                left: `${(seekTime / duration) * 100}%`,
                transform: 'translateX(-50%)'
              }}
            >
              {formatTime(seekTime)}
            </div>
          )}
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={togglePlay}
              className="text-white hover:text-pink-400 transition-all hover:scale-110 active:scale-95 p-2 rounded-full hover:bg-white/10"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5" />
              )}
            </button>

            <button
              onClick={toggleMute}
              className="text-white hover:text-pink-400 transition-all hover:scale-110 active:scale-95 p-2 rounded-full hover:bg-white/10"
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>

            <span className="text-white text-sm font-medium bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {/* Quality Selector */}
            <div className="relative">
              <button
                onClick={() => setShowQualityMenu(!showQualityMenu)}
                className="text-white hover:text-pink-400 transition-all flex items-center space-x-1 p-2 rounded-lg hover:bg-white/10"
              >
                <Settings className="w-5 h-5" />
                <span className="text-sm font-medium">{selectedQuality}</span>
              </button>

              {showQualityMenu && (
                <div className="absolute bottom-12 right-0 glass-dark rounded-xl p-2 min-w-32 shadow-elevated">
                  {qualityOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => handleQualityChange(option.id)}
                      disabled={!option.available}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                        option.available
                          ? selectedQuality === option.id
                            ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-glow'
                            : 'text-white hover:bg-white/20'
                          : 'text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {option.label}
                      {!option.available && ' (プラン限定)'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button className="text-white hover:text-pink-400 transition-all hover:scale-110 active:scale-95 p-2 rounded-full hover:bg-white/10">
              <Maximize className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* Title Overlay */}
      {title && (
        <div className="absolute top-4 left-4 right-4">
          <h3 className="text-white text-lg font-semibold drop-shadow-lg">
            {title}
          </h3>
        </div>
      )}
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
