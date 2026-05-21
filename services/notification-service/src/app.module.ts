import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { HealthModule } from './health/health.module';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-jwt-secret',
    }),
    HealthModule,
  ],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationGateway],
})
export class AppModule {}
