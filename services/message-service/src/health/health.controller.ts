import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MongooseHealthIndicator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongo: MongooseHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.mongo.pingCheck('mongodb', { timeout: 3000 }),
    ]);
  }

  @Get('live')
  liveness() {
    return {
      status: 'ok',
      service: 'message-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
