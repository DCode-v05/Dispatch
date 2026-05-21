import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class PresenceService {
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });
  }

  async setOnline(userId: string, socketId: string): Promise<void> {
    const key = `presence:${userId}`;
    await this.redis.hset(
      key,
      'status',
      'online',
      'lastSeen',
      Date.now().toString(),
      'socketId',
      socketId,
    );
    await this.redis.expire(key, 60);
    await this.redis.sadd('online_users', userId);
  }

  async refreshHeartbeat(userId: string): Promise<void> {
    await this.redis.expire(`presence:${userId}`, 60);
  }

  async setOffline(userId: string): Promise<void> {
    await this.redis.del(`presence:${userId}`);
    await this.redis.srem('online_users', userId);
  }

  async getStatus(
    userId: string,
  ): Promise<{ isOnline: boolean; lastSeen: string | null }> {
    const result = await this.redis.hgetall(`presence:${userId}`);
    return {
      isOnline: !!result.status,
      lastSeen: result.lastSeen || null,
    };
  }

  async getOnlineUsers(): Promise<string[]> {
    return this.redis.smembers('online_users');
  }

  async getBatchStatus(
    ids: string[],
  ): Promise<Record<string, { isOnline: boolean; lastSeen: string | null }>> {
    const result: Record<
      string,
      { isOnline: boolean; lastSeen: string | null }
    > = {};
    for (const id of ids) {
      result[id] = await this.getStatus(id);
    }
    return result;
  }
}
