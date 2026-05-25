import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('postgres', { timeout: 3000 }),
    ]);
  }

  @Get('live')
  liveness() {
    return {
      status: 'ok',
      service: 'user-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
