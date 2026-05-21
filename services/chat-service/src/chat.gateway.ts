import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { Inject } from '@nestjs/common';
import { ClientProxy, EventPattern, Payload } from '@nestjs/microservices';

interface JwtPayload {
  sub: string;
  email: string;
}

interface SocketData {
  userId: string;
  email: string;
}

interface RoomDocument {
  _id: { toString(): string };
}

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: '*' },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService,
    @Inject('MESSAGE_SERVICE') private readonly messageClient: ClientProxy,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const handshakeAuth = client.handshake.auth as Record<string, unknown>;
      const authHeader = client.handshake.headers?.authorization;
      const rawToken: unknown =
        handshakeAuth?.token ??
        (typeof authHeader === 'string' ? authHeader.split(' ')[1] : undefined);

      if (!rawToken || typeof rawToken !== 'string') {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify<JwtPayload>(rawToken);
      const socketData = client.data as SocketData;
      socketData.userId = payload.sub;
      socketData.email = payload.email;

      // Auto-join all rooms the user belongs to
      const rooms = await this.chatService.getUserRooms(payload.sub);
      for (const room of rooms) {
        const roomDoc = room as unknown as RoomDocument;
        await client.join(roomDoc._id.toString());
      }

      console.log(`Client connected: ${payload.sub}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const socketData = client.data as Partial<SocketData>;
    console.log(`Client disconnected: ${socketData?.userId ?? 'unknown'}`);
  }

  @SubscribeMessage('send_message')
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string; content: string },
  ) {
    const socketData = client.data as SocketData;
    const message = {
      roomId: payload.roomId,
      senderId: socketData.userId,
      content: payload.content,
      timestamp: new Date().toISOString(),
    };

    // Broadcast to all clients in the room
    this.server.to(payload.roomId).emit('new_message', message);

    // Save to message-service via RabbitMQ
    this.messageClient.emit('message.create', {
      roomId: payload.roomId,
      senderId: socketData.userId,
      content: payload.content,
    });

    return message;
  }

  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string },
  ) {
    await client.join(payload.roomId);
    const socketData = client.data as SocketData;
    this.server.to(payload.roomId).emit('user_joined', {
      userId: socketData.userId,
      roomId: payload.roomId,
    });
  }

  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string },
  ) {
    await client.leave(payload.roomId);
    const socketData = client.data as SocketData;
    this.server.to(payload.roomId).emit('user_left', {
      userId: socketData.userId,
      roomId: payload.roomId,
    });
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string },
  ) {
    const socketData = client.data as SocketData;
    client.to(payload.roomId).emit('user_typing', {
      userId: socketData.userId,
      roomId: payload.roomId,
    });
  }

  // Handle invitation acceptance to join users to the new room immediately
  @EventPattern('invitation.accepted')
  async handleInvitationAccepted(
    @Payload() data: { roomId: string; participants: string[] },
  ) {
    const sockets = await this.server.fetchSockets();
    for (const socket of sockets) {
      const socketData = socket.data as Partial<SocketData>;
      if (socketData.userId && data.participants.includes(socketData.userId)) {
        socket.join(data.roomId);
        socket.emit('room_created', { roomId: data.roomId });
      }
    }
  }

  @EventPattern('messages.read')
  handleMessagesRead(@Payload() data: { roomId: string; userId: string }) {
    this.server.to(data.roomId).emit('messages_read', data);
  }
}
