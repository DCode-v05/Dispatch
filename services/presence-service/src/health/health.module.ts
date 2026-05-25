import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { RedisHealthIndicator } from '../common/redis-health.indicator';
import { RedisProvider } from '../common/redis.provider';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [RedisProvider, RedisHealthIndicator],
  exports: [RedisProvider],
})
export class HealthModule {}
