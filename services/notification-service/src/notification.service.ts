import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './common/redis.provider';

export interface NotificationRecord {
  id: string;
  type: string;
  message?: string;
  timestamp: string;
  [k: string]: unknown;
}

const MAX_NOTIFICATIONS_PER_USER = 100;
const MAX_RETURNED = 50;
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async addNotification(
    userId: string,
    notification: NotificationRecord,
  ): Promise<void> {
    try {
      const key = `notifications:${userId}`;
      await this.redis
        .multi()
        .lpush(key, JSON.stringify(notification))
        .ltrim(key, 0, MAX_NOTIFICATIONS_PER_USER - 1)
        .expire(key, TTL_SECONDS)
        .exec();
    } catch (err) {
      this.logger.warn(
        `addNotification failed for user ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async getNotifications(userId: string): Promise<NotificationRecord[]> {
    try {
      const key = `notifications:${userId}`;
      const raw = await this.redis.lrange(key, 0, MAX_RETURNED - 1);
      const out: NotificationRecord[] = [];
      for (const item of raw) {
        try {
          out.push(JSON.parse(item));
        } catch {
          // skip corrupted entries
        }
      }
      return out;
    } catch (err) {
      this.logger.warn(
        `getNotifications failed for user ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const key = `notifications:${userId}`;
    try {
      const notifications = await this.redis.lrange(key, 0, -1);
      for (const item of notifications) {
        try {
          const parsed = JSON.parse(item) as { id?: string };
          if (parsed.id === notificationId) {
            await this.redis.lrem(key, 1, item);
            return;
          }
        } catch {
          // skip
        }
      }
    } catch (err) {
      this.logger.warn(
        `markAsRead failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async clearNotifications(userId: string): Promise<void> {
    try {
      await this.redis.del(`notifications:${userId}`);
    } catch (err) {
      this.logger.warn(
        `clearNotifications failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
