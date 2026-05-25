import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HealthModule } from './health/health.module';
import { NotificationController } from './notification.controller';
import { NotificationGateway } from './notification.gateway';
import { NotificationService } from './notification.service';
import { validateEnv } from './common/env.validation';
import { MetricsModule } from './common/metrics.module';
import { RequestIdMiddleware } from './common/request-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 200 }]),
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          throw new Error(
            '[notification-service] JWT_SECRET env var is required for JwtModule',
          );
        }
        return { secret };
      },
    }),
    HealthModule,
    MetricsModule,
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationGateway,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
