import {
  Controller,
  Get,
  Header,
  Logger,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Request, Response, NextFunction } from 'express';
import * as client from 'prom-client';

const SERVICE_NAME = 'chat-service';

const register = new client.Registry();
register.setDefaultLabels({ service: SERVICE_NAME });
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const wsConnectionsActive = new client.Gauge({
  name: 'ws_connections_active',
  help: 'Number of active Socket.IO connections',
  labelNames: ['namespace'],
  registers: [register],
});

export const messagesSentTotal = new client.Counter({
  name: 'messages_sent_total',
  help: 'Total messages sent via WebSocket',
  registers: [register],
});

function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    try {
      const route =
        (req.route && typeof req.route === 'object' && 'path' in req.route
          ? (req.route as { path: string }).path
          : undefined) ??
        req.path ??
        'unknown';
      if (route === '/metrics') return;
      const labels = {
        method: req.method,
        route,
        status_code: String(res.statusCode),
      };
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      httpRequestDuration.observe(labels, seconds);
      httpRequestsTotal.inc(labels);
    } catch {
      // never break the response on metrics failure
    }
  });
  next();
}

@SkipThrottle()
@Controller('metrics')
class MetricsController {
  private readonly logger = new Logger(MetricsController.name);

  @Get()
  @Header('Content-Type', client.register.contentType)
  async scrape(): Promise<string> {
    try {
      return await register.metrics();
    } catch (err) {
      this.logger.error(
        `metrics scrape failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return '';
    }
  }
}

@Module({
  controllers: [MetricsController],
})
export class MetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(metricsMiddleware).forRoutes('*');
  }
}

export { register as metricsRegistry };
