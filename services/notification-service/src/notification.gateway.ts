import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { NotificationRecord } from './notification.service';

interface JwtPayload {
  sub: string;
}

function corsOrigin(): string | string[] | boolean {
  const v = process.env.FRONTEND_URL;
  if (!v) return process.env.NODE_ENV === 'production' ? false : true;
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: corsOrigin(), credentials: true },
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationGateway.name);

  @WebSocketServer() server: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const auth = client.handshake.auth as Record<string, unknown>;
      const headerAuth = client.handshake.headers?.authorization;
      const rawToken =
        (typeof auth?.token === 'string' && auth.token) ||
        (typeof headerAuth === 'string' ? headerAuth.split(' ')[1] : undefined);

      if (!rawToken) {
        client.emit('unauthorized', { reason: 'missing token' });
        client.disconnect(true);
        return;
      }
      const payload = this.jwtService.verify<JwtPayload>(rawToken);
      (client.data as { userId: string }).userId = payload.sub;
      await client.join(`user:${payload.sub}`);
    } catch (err) {
      this.logger.warn(
        `WS auth failed for ${client.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
      client.emit('unauthorized', { reason: 'invalid token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: Socket): void {
    // Socket.IO handles room cleanup automatically.
  }

  sendToUser(userId: string, notification: NotificationRecord): void {
    this.server.to(`user:${userId}`).emit('notification', notification);
  }
}
