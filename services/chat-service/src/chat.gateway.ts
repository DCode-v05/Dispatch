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
  // Strip any trailing slashes — browsers send Origin without one, so a
  // mismatched FRONTEND_URL like "https://app.x/" would silently reject WS.
  return v
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

function emailRoom(email: string): string {
  return `email:${email.toLowerCase()}`;
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

      // Per-user channel (used for invitations addressed to this user)
      await client.join(`user:${payload.sub}`);
      if (payload.email) await client.join(emailRoom(payload.email));

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

  @EventPattern('invitation.received')
  handleInvitationReceived(
    @Payload()
    data: {
      invitationId: string;
      senderId: string;
      senderEmail: string;
      senderUsername: string;
      receiverEmail: string;
      createdAt?: string;
    },
  ) {
    this.server.to(emailRoom(data.receiverEmail)).emit('invitation_received', {
      _id: data.invitationId,
      senderId: data.senderId,
      senderEmail: data.senderEmail,
      senderUsername: data.senderUsername,
      receiverEmail: data.receiverEmail,
      status: 'pending',
      createdAt: data.createdAt ?? new Date().toISOString(),
    });
  }

  @EventPattern('invitation.rejected')
  handleInvitationRejected(
    @Payload()
    data: { invitationId: string; senderId: string; receiverEmail: string },
  ) {
    this.server.to(`user:${data.senderId}`).emit('invitation_rejected', {
      invitationId: data.invitationId,
      receiverEmail: data.receiverEmail,
    });
  }

  @EventPattern('room.created')
  async handleRoomCreated(
    @Payload()
    data: { roomId: string; participants: string[]; createdBy: string },
  ) {
    // Subscribe every connected participant to the new room and emit room_created
    const sockets = await this.server.fetchSockets();
    for (const socket of sockets) {
      const socketData = socket.data as Partial<SocketData>;
      if (
        socketData.userId &&
        data.participants.includes(socketData.userId)
      ) {
        await socket.join(data.roomId);
        socket.emit('room_created', { roomId: data.roomId });
      }
    }
  }

  @EventPattern('messages.read')
  handleMessagesRead(@Payload() data: { roomId: string; userId: string }) {
    this.server.to(data.roomId).emit('messages_read', data);
  }

  @EventPattern('message.deleted')
  handleMessageDeleted(
    @Payload()
    data: { messageId: string; roomId: string; senderId: string },
  ) {
    this.server.to(data.roomId).emit('message_deleted', data);
  }

  @EventPattern('participants.changed')
  async handleParticipantsChanged(
    @Payload()
    data: {
      roomId: string;
      participants: string[];
      addedUserIds?: string[];
      removedUserIds?: string[];
    },
  ) {
    // Broadcast to everyone currently in the room socket-room
    this.server.to(data.roomId).emit('participants_changed', data);

    // Pull in any newly-added users to the room channel
    if (data.addedUserIds && data.addedUserIds.length > 0) {
      const sockets = await this.server.fetchSockets();
      for (const socket of sockets) {
        const socketData = socket.data as Partial<SocketData>;
        if (
          socketData.userId &&
          data.addedUserIds.includes(socketData.userId)
        ) {
          await socket.join(data.roomId);
          socket.emit('room_created', { roomId: data.roomId });
        }
      }
    }
  }

  @EventPattern('room.deleted')
  async handleRoomDeleted(
    @Payload() data: { roomId: string; participants?: string[] },
  ) {
    this.server.to(data.roomId).emit('room_deleted', { roomId: data.roomId });
    // Detach all sockets from the now-defunct room
    const sockets = await this.server.in(data.roomId).fetchSockets();
    for (const socket of sockets) {
      await socket.leave(data.roomId);
    }
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
