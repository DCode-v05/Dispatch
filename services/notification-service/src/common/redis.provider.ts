import { Logger, Provider } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export const RedisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (): Redis => {
    const logger = new Logger('Redis');
    const client = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectTimeout: 5000,
      lazyConnect: false,
      retryStrategy: (times: number) => Math.min(times * 200, 5000),
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        return err.message.includes(targetError);
      },
    });
    client.on('error', (err) =>
      logger.error(`Redis client error: ${err.message}`),
    );
    client.on('end', () => logger.warn('Redis connection ended'));
    client.on('reconnecting', () => logger.warn('Redis reconnecting'));
    return client;
  },
};
