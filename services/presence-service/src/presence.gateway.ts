import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PresenceService } from './presence.service';

interface JwtPayload {
  sub: string;
}

interface SocketData {
  userId: string;
}

function corsOrigin(): string | string[] | boolean {
  const v = process.env.FRONTEND_URL;
  if (!v) return process.env.NODE_ENV === 'production' ? false : true;
  return v
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

@WebSocketGateway({
  namespace: '/presence',
  cors: { origin: corsOrigin(), credentials: true },
})
export class PresenceGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(PresenceGateway.name);

  @WebSocketServer() server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly presenceService: PresenceService,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const auth = client.handshake.auth as Record<string, unknown>;
      const headerAuth = client.handshake.headers?.authorization;
      const token =
        (typeof auth?.token === 'string' && auth.token) ||
        (typeof headerAuth === 'string' ? headerAuth.split(' ')[1] : undefined);

      if (!token) {
        client.emit('unauthorized', { reason: 'missing token' });
        client.disconnect(true);
        return;
      }
      const payload = this.jwtService.verify<JwtPayload>(token);
      (client.data as SocketData).userId = payload.sub;

      await this.presenceService.setOnline(payload.sub, client.id);
      this.safeEmit('user.online', {
        userId: payload.sub,
        timestamp: new Date(),
      });
      this.server.emit('presence_update', {
        userId: payload.sub,
        isOnline: true,
      });
    } catch (err) {
      this.logger.warn(
        `WS auth failed for ${client.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
      client.emit('unauthorized', { reason: 'invalid token' });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const data = client.data as Partial<SocketData>;
    if (!data?.userId) return;
    const torndown = await this.presenceService.setOffline(
      data.userId,
      client.id,
    );
    if (torndown) {
      this.safeEmit('user.offline', {
        userId: data.userId,
        timestamp: new Date(),
      });
      this.server.emit('presence_update', {
        userId: data.userId,
        isOnline: false,
      });
    }
  }

  @SubscribeMessage('heartbeat')
  async handleHeartbeat(@ConnectedSocket() client: Socket) {
    const data = client.data as Partial<SocketData>;
    if (!data?.userId) {
      client.emit('unauthorized', { reason: 'no session' });
      client.disconnect(true);
      return;
    }
    await this.presenceService.refreshHeartbeat(data.userId);
  }

  private safeEmit(pattern: string, payload: Record<string, unknown>): void {
    try {
      this.notificationClient.emit(pattern, payload).subscribe({
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
