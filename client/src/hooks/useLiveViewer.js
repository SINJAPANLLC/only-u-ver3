import { useState, useEffect, useRef } from 'react';
import { auth } from '../firebase';

export const useLiveViewer = (roomId, enabled = true) => {
    const [remoteStream, setRemoteStream] = useState(null);
    const [viewers, setViewers] = useState(0);
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('接続中...');
    const wsRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const anonymousIdRef = useRef(`anonymous-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    const videoRef = useRef(null);
    const user = auth.currentUser;

    const getUserId = () => {
        return user?.uid || anonymousIdRef.current;
    };

    const handleOffer = async (offer) => {
        try {
            console.log('📥 Received offer from broadcaster');
            setConnectionStatus('ピア接続を確立中...');

            const peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:3478' },
                    { urls: 'stun:stun3.l.google.com:19302' }
                ]
            });

            peerConnectionRef.current = peerConnection;

            peerConnection.ontrack = (event) => {
                console.log('📺 Received remote stream');
                setRemoteStream(event.streams[0]);
                setIsConnecting(false);
                setConnectionStatus('配信中');
            };

            peerConnection.onicecandidate = (event) => {
                if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: 'ice-candidate',
                        roomId,
                        userId: getUserId(),
                        data: event.candidate
                    }));
                }
            };

            peerConnection.onconnectionstatechange = () => {
                console.log('🔗 Connection state:', peerConnection.connectionState);
                
                if (peerConnection.connectionState === 'connected') {
                    setIsConnecting(false);
                    setConnectionStatus('配信中');
                } else if (peerConnection.connectionState === 'disconnected') {
                    setConnectionStatus('切断されました');
                } else if (peerConnection.connectionState === 'failed') {
                    setConnectionStatus('接続に失敗しました');
                }
            };

            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'answer',
                    roomId,
                    userId: getUserId(),
                    data: answer
                }));
            }
        } catch (error) {
            console.error('❌ Error handling offer:', error);
            setConnectionStatus('接続エラー');
            setIsConnecting(false);
        }
    };

    const handleIceCandidate = async (candidate) => {
        try {
            if (peerConnectionRef.current && candidate) {
                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                console.log('✅ ICE candidate added');
            }
        } catch (error) {
            console.error('❌ Error adding ICE candidate:', error);
        }
    };

    const setupWebRTC = async () => {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/signaling`;
        
        console.log('🔌 Viewer connecting to signaling server:', wsUrl);
        setIsConnecting(true);
        
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('✅ WebSocket connected');
            setConnectionStatus('接続完了');
            
            ws.send(JSON.stringify({
                type: 'viewer-join',
                roomId,
                userId: getUserId(),
                userName: user?.displayName || 'ゲスト',
                userAvatar: user?.photoURL || ''
            }));
        };

        ws.onmessage = async (event) => {
            const message = JSON.parse(event.data);
            console.log('📨 Viewer received:', message.type);

            switch (message.type) {
                case 'joined':
                    console.log('✅ Joined as viewer, waiting for broadcaster offer...');
                    setConnectionStatus('配信者の準備を待っています...');
                    break;

                case 'offer':
                    await handleOffer(message.offer);
                    break;

                case 'ice-candidate':
                    await handleIceCandidate(message.candidate);
                    break;

                case 'viewer-count':
                    setViewers(message.count);
                    break;

                case 'broadcaster-left':
                    setConnectionStatus('配信終了');
                    disconnect();
                    break;

                case 'error':
                    console.error('❌ Signaling error:', message.message);
                    setConnectionStatus('接続エラー');
                    setIsConnecting(false);
                    break;
            }
        };

        ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
            setConnectionStatus('接続エラー');
            setIsConnecting(false);
        };

        ws.onclose = () => {
            console.log('🔌 WebSocket disconnected');
        };
    };

    const disconnect = () => {
        console.log('🔌 Disconnecting WebRTC...');
        
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'viewer-leave',
                roomId,
                userId: getUserId()
            }));
            wsRef.current.close();
        }
        
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        
        setRemoteStream(null);
        setIsConnecting(false);
    };

    // WebRTC接続の初期化とクリーンアップ
    useEffect(() => {
        if (!roomId || !enabled) {
            disconnect();
            return;
        }

        setupWebRTC();

        return () => {
            disconnect();
        };
    }, [roomId, enabled]);

    // ビデオ要素にストリームを設定
    useEffect(() => {
        if (remoteStream && videoRef.current) {
            videoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    return {
        videoRef,
        remoteStream,
        viewers,
        isConnecting,
        connectionStatus,
        disconnect
    };
};
