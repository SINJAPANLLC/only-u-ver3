import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Video, Mic, MicOff, VideoOff, Radio, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../hooks/use-toast';

const CreateLivePage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [title, setTitle] = useState('');
    const [isStarting, setIsStarting] = useState(false);
    const [stream, setStream] = useState(null);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const videoRef = useRef(null);
    const user = auth.currentUser;

    // カメラとマイクへのアクセス
    useEffect(() => {
        const getMediaStream = async () => {
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1080 },
                        height: { ideal: 1920 },
                        facingMode: 'user',
                        aspectRatio: 9/16
                    },
                    audio: true
                });
                
                setStream(mediaStream);
                
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                }
            } catch (error) {
                console.error('Error accessing media devices:', error);
                toast({
                    title: 'エラー',
                    description: 'カメラまたはマイクへのアクセスが拒否されました',
                    variant: 'destructive'
                });
            }
        };

        getMediaStream();

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // ビデオのオン/オフ
    const toggleVideo = () => {
        if (stream) {
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoEnabled(videoTrack.enabled);
            }
        }
    };

    // オーディオのオン/オフ
    const toggleAudio = () => {
        if (stream) {
            const audioTrack = stream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsAudioEnabled(audioTrack.enabled);
            }
        }
    };

    // ライブ配信開始
    const handleStartLive = async () => {
        if (!title.trim()) {
            toast({
                title: 'エラー',
                description: '配信タイトルを入力してください',
                variant: 'destructive'
            });
            return;
        }

        if (!user) {
            toast({
                title: 'エラー',
                description: 'ログインが必要です',
                variant: 'destructive'
            });
            return;
        }

        setIsStarting(true);

        try {
            // Firestoreにライブルームを作成
            const liveRoomRef = await addDoc(collection(db, 'liveRooms'), {
                title: title.trim(),
                creatorId: user.uid,
                creatorName: user.displayName || 'Anonymous',
                creatorAvatar: user.photoURL || '',
                status: 'live',
                viewers: 0,
                createdAt: serverTimestamp(),
                isActive: true
            });

            console.log('Live room created:', liveRoomRef.id);

            // ライブ配信ページに遷移
            navigate(`/live-broadcast/${liveRoomRef.id}`);
        } catch (error) {
            console.error('Error starting live:', error);
            toast({
                title: 'エラー',
                description: 'ライブ配信の開始に失敗しました',
                variant: 'destructive'
            });
            setIsStarting(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex flex-col">
            {/* ヘッダー */}
            <div className="bg-black/50 backdrop-blur-sm border-b border-gray-800 p-4 safe-top z-50">
                <div className="flex items-center justify-between max-w-6xl mx-auto">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
                        data-testid="button-back"
                    >
                        <X className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl font-bold text-white">ライブ配信を開始</h1>
                    <div className="w-10" />
                </div>
            </div>

            {/* プレビュー */}
            <div className="flex-1 relative overflow-hidden">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-contain"
                    data-testid="video-preview"
                />

                {!isVideoEnabled && (
                    <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                        <VideoOff className="w-20 h-20 text-gray-600" />
                    </div>
                )}

                {/* グラデーションオーバーレイ */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />

                {/* コントロール */}
                <div className="absolute bottom-0 left-0 right-0 p-6 space-y-4 safe-bottom">
                    {/* タイトル入力 */}
                    <div>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="配信タイトルを入力..."
                            maxLength={100}
                            className="w-full px-4 py-3 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-pink-500"
                            data-testid="input-live-title"
                        />
                    </div>

                    {/* ビデオ/オーディオコントロール */}
                    <div className="flex items-center justify-center space-x-4">
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={toggleVideo}
                            className={`p-4 rounded-full ${
                                isVideoEnabled 
                                    ? 'bg-white/20 text-white' 
                                    : 'bg-red-500 text-white'
                            }`}
                            data-testid="button-toggle-video"
                        >
                            {isVideoEnabled ? (
                                <Video className="w-6 h-6" />
                            ) : (
                                <VideoOff className="w-6 h-6" />
                            )}
                        </motion.button>

                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={toggleAudio}
                            className={`p-4 rounded-full ${
                                isAudioEnabled 
                                    ? 'bg-white/20 text-white' 
                                    : 'bg-red-500 text-white'
                            }`}
                            data-testid="button-toggle-audio"
                        >
                            {isAudioEnabled ? (
                                <Mic className="w-6 h-6" />
                            ) : (
                                <MicOff className="w-6 h-6" />
                            )}
                        </motion.button>
                    </div>

                    {/* 配信開始ボタン */}
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={handleStartLive}
                        disabled={isStarting || !stream}
                        className="w-full py-4 rounded-full bg-gradient-to-r from-pink-500 to-pink-600 text-white font-bold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                        data-testid="button-start-live"
                    >
                        <Radio className="w-6 h-6" />
                        <span>{isStarting ? '開始中...' : 'ライブ配信を開始'}</span>
                    </motion.button>
                </div>
            </div>
        </div>
    );
};

export default CreateLivePage;
