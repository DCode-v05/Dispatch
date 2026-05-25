import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './common/redis.provider';

const PRESENCE_TTL_SECONDS = 90;

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async setOnline(userId: string, socketId: string): Promise<void> {
    try {
      const key = `presence:${userId}`;
      await this.redis
        .multi()
        .hset(
          key,
          'status',
          'online',
          'lastSeen',
          Date.now().toString(),
          'socketId',
          socketId,
        )
        .expire(key, PRESENCE_TTL_SECONDS)
        .sadd('online_users', userId)
        .exec();
    } catch (err) {
      this.logger.warn(
        `setOnline(${userId}) failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async refreshHeartbeat(userId: string): Promise<void> {
    try {
      await this.redis.expire(`presence:${userId}`, PRESENCE_TTL_SECONDS);
    } catch (err) {
      this.logger.warn(
        `refreshHeartbeat(${userId}) failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async setOffline(userId: string, socketId?: string): Promise<boolean> {
    try {
      const key = `presence:${userId}`;
      // Only clear if the socketId matches (avoids race when user has multiple connections)
      if (socketId) {
        const current = await this.redis.hget(key, 'socketId');
        if (current && current !== socketId) {
          // A newer connection took over; don't tear down presence
          return false;
        }
      }
      await this.redis.multi().del(key).srem('online_users', userId).exec();
      return true;
    } catch (err) {
      this.logger.warn(
        `setOffline(${userId}) failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  async getStatus(
    userId: string,
  ): Promise<{ isOnline: boolean; lastSeen: string | null }> {
    try {
      const result = await this.redis.hgetall(`presence:${userId}`);
      return {
        isOnline: result?.status === 'online',
        lastSeen: result?.lastSeen || null,
      };
    } catch (err) {
      this.logger.warn(
        `getStatus(${userId}) failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { isOnline: false, lastSeen: null };
    }
  }

  async getOnlineUsers(): Promise<string[]> {
    try {
      return await this.redis.smembers('online_users');
    } catch {
      return [];
    }
  }

  async getBatchStatus(
    ids: string[],
  ): Promise<Record<string, { isOnline: boolean; lastSeen: string | null }>> {
    const result: Record<
      string,
      { isOnline: boolean; lastSeen: string | null }
    > = {};
    if (ids.length === 0) return result;
    const pipeline = this.redis.pipeline();
    for (const id of ids) pipeline.hgetall(`presence:${id}`);
    try {
      const replies = await pipeline.exec();
      ids.forEach((id, i) => {
        const reply = replies?.[i];
        const data = (reply?.[1] as Record<string, string> | null) ?? null;
        result[id] = {
          isOnline: data?.status === 'online',
          lastSeen: data?.lastSeen ?? null,
        };
      });
    } catch (err) {
      this.logger.warn(
        `getBatchStatus failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      for (const id of ids) result[id] = { isOnline: false, lastSeen: null };
    }
    return result;
  }
}
