import {
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { Request as ExpressRequest } from 'express';
import { randomUUID } from 'crypto';
import {
  NotificationService,
  NotificationRecord,
} from './notification.service';
import { NotificationGateway } from './notification.gateway';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    userId: string;
    email: string;
    username?: string;
  };
}

function ackOrNack(context: RmqContext, success: boolean): void {
  const channel = context.getChannelRef();
  const originalMsg = context.getMessage();
  if (success) {
    channel.ack(originalMsg);
  } else {
    // requeue=false so we don't loop on poison messages
    channel.nack(originalMsg, false, false);
  }
}

function notif(extra: Partial<NotificationRecord>): NotificationRecord {
  return {
    id: `notif_${Date.now()}_${randomUUID().slice(0, 8)}`,
    type: 'info',
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

@Controller('notifications')
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  @Get('/')
  @UseGuards(JwtAuthGuard)
  async getNotifications(@Req() req: AuthenticatedRequest) {
    return this.notificationService.getNotifications(req.user.userId);
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  async markAsRead(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    await this.notificationService.markAsRead(req.user.userId, id);
    return { success: true };
  }

  @EventPattern('message.sent')
  async handleMessageSent(
    @Payload()
    data: {
      roomId: string;
      senderId: string;
      content: string;
      participants?: string[];
    },
    @Ctx() context: RmqContext,
  ) {
    try {
      const notification = notif({
        type: 'new_message',
        roomId: data.roomId,
        senderId: data.senderId,
        content: data.content?.substring(0, 50) || '',
      });

      if (data.participants && Array.isArray(data.participants)) {
        for (const participantId of data.participants) {
          if (participantId !== data.senderId) {
            await this.notificationService.addNotification(
              participantId,
              notification,
            );
            this.notificationGateway.sendToUser(participantId, notification);
          }
        }
      }
      ackOrNack(context, true);
    } catch (err) {
      this.logger.error(
        `handleMessageSent failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      ackOrNack(context, false);
    }
  }

  @EventPattern('user.created')
  async handleUserCreated(
    @Payload() data: { userId: string; username: string; email: string },
    @Ctx() context: RmqContext,
  ) {
    try {
      if (!data?.userId) {
        ackOrNack(context, true);
        return;
      }
      const notification = notif({
        type: 'welcome',
        message: `Welcome to the platform, ${data.username || data.email || 'new user'}!`,
      });
      await this.notificationService.addNotification(data.userId, notification);
      this.notificationGateway.sendToUser(data.userId, notification);
      ackOrNack(context, true);
    } catch (err) {
      this.logger.error(
        `handleUserCreated failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      ackOrNack(context, false);
    }
  }

  @EventPattern('user.joined_room')
  async handleUserJoinedRoom(
    @Payload()
    data: {
      roomId: string;
      userId: string;
      username?: string;
      participants?: string[];
    },
    @Ctx() context: RmqContext,
  ) {
    try {
      const notification = notif({
        type: 'user_joined_room',
        roomId: data.roomId,
        userId: data.userId,
        username: data.username,
        message: `${data.username || 'A user'} joined the room.`,
      });

      if (data.participants && Array.isArray(data.participants)) {
        for (const participantId of data.participants) {
          if (participantId !== data.userId) {
            await this.notificationService.addNotification(
              participantId,
              notification,
            );
            this.notificationGateway.sendToUser(participantId, notification);
          }
        }
      }
      ackOrNack(context, true);
    } catch (err) {
      this.logger.error(
        `handleUserJoinedRoom failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      ackOrNack(context, false);
    }
  }

  @EventPattern('user.online')
  handleUserOnline(@Ctx() context: RmqContext) {
    ackOrNack(context, true);
  }

  @EventPattern('user.offline')
  handleUserOffline(@Ctx() context: RmqContext) {
    ackOrNack(context, true);
  }

  @EventPattern('invitation.sent')
  async handleInvitationSent(
    @Payload()
    data: {
      senderEmail: string;
      senderUsername: string;
      receiverEmail: string;
      invitationId: string;
    },
    @Ctx() context: RmqContext,
  ) {
    try {
      const notification = notif({
        type: 'invitation',
        message: `${data.senderUsername || data.senderEmail} invited you to chat.`,
        senderEmail: data.senderEmail,
        invitationId: data.invitationId,
      });
      // Receiver is identified by email — we don't have userId, so this is broadcast-only via gateway.
      // Store by email-based key fallback.
      await this.notificationService.addNotification(
        `email:${data.receiverEmail}`,
        notification,
      );
      ackOrNack(context, true);
    } catch (err) {
      this.logger.error(
        `handleInvitationSent failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      ackOrNack(context, false);
    }
  }
}
