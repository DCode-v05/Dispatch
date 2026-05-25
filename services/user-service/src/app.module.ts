import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { validateEnv } from './common/env.validation';
import { MetricsModule } from './common/metrics.module';
import { RequestIdMiddleware } from './common/request-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST,
      port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
      ssl:
        process.env.POSTGRES_SSL === 'true'
          ? { rejectUnauthorized: false }
          : false,
      extra: {
        max: parseInt(process.env.POSTGRES_POOL_MAX ?? '5', 10),
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
      },
    }),
    UserModule,
    AuthModule,
    HealthModule,
    MetricsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
