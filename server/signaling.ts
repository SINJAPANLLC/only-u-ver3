import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { parse } from 'url';

interface SignalingMessage {
  type: 'join' | 'offer' | 'answer' | 'ice-candidate' | 'leave' | 'viewer-join' | 'viewer-leave' | 'new-viewer';
  roomId: string;
  userId?: string;
  viewerId?: string;
  userName?: string;
  userAvatar?: string;
  data?: any;
}

interface RoomConnection {
  ws: WebSocket;
  userId: string;
  userName: string;
  userAvatar: string;
  role: 'broadcaster' | 'viewer';
}

interface Room {
  roomId: string;
  broadcaster: RoomConnection | null;
  viewers: Map<string, RoomConnection>;
}

export class SignalingServer {
  private wss: WebSocketServer;
  private rooms: Map<string, Room> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/signaling'
    });

    this.wss.on('connection', (ws: WebSocket, req) => {
      console.log('📡 New WebSocket connection established');
      
      ws.on('message', (message: string) => {
        try {
          const data: SignalingMessage = JSON.parse(message.toString());
          this.handleMessage(ws, data);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        console.log('🔌 WebSocket connection closed');
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
      });
    });

    console.log('✅ WebSocket signaling server initialized');
  }

  private handleMessage(ws: WebSocket, message: SignalingMessage) {
    const { type, roomId, userId, userName, userAvatar, data } = message;

    switch (type) {
      case 'join':
        this.handleBroadcasterJoin(ws, roomId, userId!, userName!, userAvatar!);
        break;

      case 'viewer-join':
        this.handleViewerJoin(ws, roomId, userId!, userName!, userAvatar!);
        break;

      case 'offer':
        this.handleOffer(roomId, userId!, data);
        break;

      case 'answer':
        this.handleAnswer(roomId, userId!, data);
        break;

      case 'ice-candidate':
        this.handleIceCandidate(roomId, userId!, data);
        break;

      case 'leave':
      case 'viewer-leave':
        this.handleLeave(ws, roomId, userId!);
        break;

      default:
        console.warn('⚠️ Unknown message type:', type);
    }
  }

  private handleBroadcasterJoin(ws: WebSocket, roomId: string, userId: string, userName: string, userAvatar: string) {
    console.log(`🎥 Broadcaster joining room: ${roomId}`);

    let room = this.rooms.get(roomId);
    if (!room) {
      room = {
        roomId,
        broadcaster: null,
        viewers: new Map()
      };
      this.rooms.set(roomId, room);
    }

    if (room.broadcaster) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Room already has a broadcaster' 
      }));
      return;
    }

    room.broadcaster = {
      ws,
      userId,
      userName,
      userAvatar,
      role: 'broadcaster'
    };

    ws.send(JSON.stringify({ 
      type: 'joined', 
      role: 'broadcaster',
      roomId,
      viewerCount: room.viewers.size
    }));

    console.log(`✅ Broadcaster joined room ${roomId}, ${room.viewers.size} viewers`);
  }

  private handleViewerJoin(ws: WebSocket, roomId: string, userId: string, userName: string, userAvatar: string) {
    console.log(`👀 Viewer ${userId} joining room: ${roomId}`);

    const room = this.rooms.get(roomId);
    if (!room || !room.broadcaster) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Room not found or broadcaster offline' 
      }));
      return;
    }

    room.viewers.set(userId, {
      ws,
      userId,
      userName,
      userAvatar,
      role: 'viewer'
    });

    ws.send(JSON.stringify({ 
      type: 'joined', 
      role: 'viewer',
      roomId
    }));

    // 配信者に新しい視聴者を通知（配信者がofferを作成するため）
    if (room.broadcaster) {
      room.broadcaster.ws.send(JSON.stringify({
        type: 'new-viewer',
        viewerId: userId,
        userName,
        userAvatar
      }));
    }

    this.broadcastViewerCount(room);

    console.log(`✅ Viewer ${userId} joined room ${roomId}, total viewers: ${room.viewers.size}`);
  }

  private handleOffer(roomId: string, senderId: string, offer: any) {
    const room = this.rooms.get(roomId);
    if (!room) {
      console.warn(`⚠️ Room ${roomId} not found for offer`);
      return;
    }

    // 配信者からのofferを視聴者に転送
    if (room.broadcaster && room.broadcaster.userId === senderId) {
      // offerのtargetViewerIdを取得（データに含まれているはず）
      const targetViewerId = offer.targetViewerId;
      const viewer = room.viewers.get(targetViewerId);
      
      if (viewer) {
        viewer.ws.send(JSON.stringify({
          type: 'offer',
          offer: offer.sdp
        }));
        console.log(`📤 Forwarded offer from broadcaster to viewer ${targetViewerId}`);
      }
    }
  }

  private handleAnswer(roomId: string, senderId: string, answer: any) {
    const room = this.rooms.get(roomId);
    if (!room) {
      console.warn(`⚠️ Room ${roomId} not found for answer`);
      return;
    }

    // 視聴者からのanswerを配信者に転送
    const viewer = room.viewers.get(senderId);
    if (viewer && room.broadcaster) {
      room.broadcaster.ws.send(JSON.stringify({
        type: 'answer',
        viewerId: senderId,
        answer
      }));
      console.log(`📤 Forwarded answer from viewer ${senderId} to broadcaster`);
    }
  }

  private handleIceCandidate(roomId: string, userId: string, candidate: any) {
    const room = this.rooms.get(roomId);
    if (!room) {
      console.warn(`⚠️ Room ${roomId} not found for ICE candidate`);
      return;
    }

    // 配信者からのICE候補を特定の視聴者に転送
    if (room.broadcaster && room.broadcaster.userId === userId) {
      const targetViewerId = candidate.targetViewerId;
      const viewer = room.viewers.get(targetViewerId);
      
      if (viewer) {
        viewer.ws.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: candidate.candidate
        }));
        console.log(`📤 Forwarded ICE candidate from broadcaster to viewer ${targetViewerId}`);
      }
    } else {
      // 視聴者からのICE候補を配信者に転送
      const viewer = room.viewers.get(userId);
      if (viewer && room.broadcaster) {
        room.broadcaster.ws.send(JSON.stringify({
          type: 'ice-candidate',
          viewerId: userId,
          candidate
        }));
        console.log(`📤 Forwarded ICE candidate from viewer ${userId} to broadcaster`);
      }
    }
  }

  private handleLeave(ws: WebSocket, roomId: string, userId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (room.broadcaster && room.broadcaster.userId === userId) {
      console.log(`🎥 Broadcaster leaving room ${roomId}`);
      
      room.viewers.forEach((viewer) => {
        viewer.ws.send(JSON.stringify({
          type: 'broadcaster-left'
        }));
      });

      this.rooms.delete(roomId);
      console.log(`🗑️ Room ${roomId} deleted`);
    } else {
      const viewer = room.viewers.get(userId);
      if (viewer) {
        room.viewers.delete(userId);
        this.broadcastViewerCount(room);
        console.log(`👋 Viewer ${userId} left room ${roomId}, remaining: ${room.viewers.size}`);
      }
    }
  }

  private handleDisconnect(ws: WebSocket) {
    this.rooms.forEach((room, roomId) => {
      if (room.broadcaster && room.broadcaster.ws === ws) {
        console.log(`🔌 Broadcaster disconnected from room ${roomId}`);
        
        room.viewers.forEach((viewer) => {
          viewer.ws.send(JSON.stringify({
            type: 'broadcaster-left'
          }));
        });

        this.rooms.delete(roomId);
      } else {
        const viewerToRemove = Array.from(room.viewers.values()).find(v => v.ws === ws);
        if (viewerToRemove) {
          room.viewers.delete(viewerToRemove.userId);
          this.broadcastViewerCount(room);
          console.log(`🔌 Viewer ${viewerToRemove.userId} disconnected from room ${roomId}`);
        }
      }
    });
  }

  private broadcastViewerCount(room: Room) {
    const viewerCount = room.viewers.size;
    
    if (room.broadcaster) {
      room.broadcaster.ws.send(JSON.stringify({
        type: 'viewer-count',
        count: viewerCount
      }));
    }

    room.viewers.forEach((viewer) => {
      viewer.ws.send(JSON.stringify({
        type: 'viewer-count',
        count: viewerCount
      }));
    });
  }

  public getRoomInfo(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    return {
      roomId,
      hasBroadcaster: !!room.broadcaster,
      viewerCount: room.viewers.size
    };
  }
}
