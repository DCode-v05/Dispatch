import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { Inject, Logger } from '@nestjs/common';
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

const MAX_MESSAGE_LENGTH = 4000;

function corsOrigin(): string | string[] | boolean {
  const v = process.env.FRONTEND_URL;
  if (!v) return process.env.NODE_ENV === 'production' ? false : true;
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: corsOrigin(), credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

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
        client.emit('unauthorized', { reason: 'missing token' });
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify<JwtPayload>(rawToken);
      const socketData = client.data as SocketData;
      socketData.userId = payload.sub;
      socketData.email = payload.email;

      const rooms = await this.chatService.getUserRooms(payload.sub);
      for (const room of rooms) {
        const roomDoc = room as unknown as RoomDocument;
        await client.join(roomDoc._id.toString());
      }
    } catch (err) {
      this.logger.warn(
        `WS auth failed for ${client.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
      client.emit('unauthorized', { reason: 'invalid token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: Socket) {
    // Socket.IO cleans up room memberships automatically.
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string; content: string },
  ) {
    const socketData = client.data as SocketData;
    if (!socketData?.userId) {
      client.emit('error', { message: 'not authenticated' });
      return;
    }
    if (!payload?.roomId || typeof payload.roomId !== 'string') {
      client.emit('error', { message: 'roomId is required' });
      return;
    }
    if (
      !payload.content ||
      typeof payload.content !== 'string' ||
      payload.content.trim().length === 0
    ) {
      client.emit('error', { message: 'content is required' });
      return;
    }
    const content = payload.content.slice(0, MAX_MESSAGE_LENGTH);

    const isMember = await this.chatService.isParticipant(
      payload.roomId,
      socketData.userId,
    );
    if (!isMember) {
      client.emit('error', { message: 'not a participant of this room' });
      return;
    }

    const message = {
      roomId: payload.roomId,
      senderId: socketData.userId,
      content,
      timestamp: new Date().toISOString(),
    };

    this.server.to(payload.roomId).emit('new_message', message);

    this.safeEmit('message.create', {
      roomId: payload.roomId,
      senderId: socketData.userId,
      content,
    });

    return message;
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string },
  ) {
    const socketData = client.data as SocketData;
    if (!socketData?.userId || !payload?.roomId) return;
    client.to(payload.roomId).emit('user_typing', {
      userId: socketData.userId,
      roomId: payload.roomId,
    });
  }

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

  private safeEmit(pattern: string, payload: Record<string, unknown>): void {
    try {
      this.messageClient.emit(pattern, payload).subscribe({
        error: (err: Error) =>
          this.logger.warn(`Failed to emit ${pattern}: ${err.message}`),
      });
    } catch (err) {
      this.logger.warn(
        `Failed to emit ${pattern}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
