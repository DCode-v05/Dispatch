import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HealthModule } from './health/health.module';
import { PresenceController } from './presence.controller';
import { PresenceGateway } from './presence.gateway';
import { PresenceService } from './presence.service';
import { validateEnv } from './common/env.validation';
import { MetricsModule } from './common/metrics.module';
import { RequestIdMiddleware } from './common/request-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          throw new Error(
            '[presence-service] JWT_SECRET env var is required for JwtModule',
          );
        }
        return { secret };
      },
    }),
    ClientsModule.register([
      {
        name: 'NOTIFICATION_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL as string],
          queue: 'notification_queue',
          queueOptions: { durable: true },
          socketOptions: { heartbeatIntervalInSeconds: 30 },
        },
      },
    ]),
    HealthModule,
    MetricsModule,
  ],
  controllers: [PresenceController],
  providers: [
    PresenceService,
    PresenceGateway,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
