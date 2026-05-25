import { Inject, Injectable } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.provider';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const pong = await Promise.race([
        this.redis.ping(),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Redis ping timeout')), 3000),
        ),
      ]);
      const healthy = pong === 'PONG';
      const result = this.getStatus(key, healthy);
      if (!healthy) {
        throw new HealthCheckError('Redis check failed', result);
      }
      return result;
    } catch (err) {
      throw new HealthCheckError(
        'Redis check failed',
        this.getStatus(key, false, {
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
