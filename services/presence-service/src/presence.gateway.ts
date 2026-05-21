import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PresenceService } from './presence.service';

@WebSocketGateway({ namespace: '/presence', cors: { origin: '*' } })
export class PresenceGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly presenceService: PresenceService,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = this.jwtService.verify(token);
      client.data.userId = payload.sub;

      await this.presenceService.setOnline(payload.sub, client.id);
      this.notificationClient.emit('user.online', {
        userId: payload.sub,
        timestamp: new Date(),
      });
      this.server.emit('presence_update', {
        userId: payload.sub,
        isOnline: true,
      });
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    if (client.data?.userId) {
      await this.presenceService.setOffline(client.data.userId);
      this.notificationClient.emit('user.offline', {
        userId: client.data.userId,
        timestamp: new Date(),
      });
      this.server.emit('presence_update', {
        userId: client.data.userId,
        isOnline: false,
      });
    }
  }

  @SubscribeMessage('heartbeat')
  async handleHeartbeat(@ConnectedSocket() client: Socket) {
    if (client.data?.userId) {
      await this.presenceService.refreshHeartbeat(client.data.userId);
    }
  }
}
