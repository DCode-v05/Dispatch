import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class NotificationService {
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    });
  }

  async addNotification(userId: string, notification: any): Promise<void> {
    const key = `notifications:${userId}`;
    await this.redis.lpush(key, JSON.stringify(notification));
    await this.redis.ltrim(key, 0, 99);
  }

  async getNotifications(userId: string): Promise<any[]> {
    const key = `notifications:${userId}`;
    const raw = await this.redis.lrange(key, 0, 49);
    return raw.map((item) => JSON.parse(item));
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const key = `notifications:${userId}`;
    const notifications = await this.redis.lrange(key, 0, -1);

    for (const item of notifications) {
      const parsed = JSON.parse(item);
      if (parsed.id === notificationId) {
        await this.redis.lrem(key, 1, item);
        break;
      }
    }
  }

  async clearNotifications(userId: string): Promise<void> {
    const key = `notifications:${userId}`;
    await this.redis.del(key);
  }
}
