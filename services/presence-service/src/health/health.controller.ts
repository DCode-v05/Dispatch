import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { RedisHealthIndicator } from '../common/redis-health.indicator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.redis.isHealthy('redis')]);
  }

  @Get('live')
  liveness() {
    return {
      status: 'ok',
      service: 'presence-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
