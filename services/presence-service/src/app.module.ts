import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { HealthModule } from './health/health.module';
import { PresenceController } from './presence.controller';
import { PresenceService } from './presence.service';
import { PresenceGateway } from './presence.gateway';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-jwt-secret',
    }),
    ClientsModule.register([
      {
        name: 'NOTIFICATION_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
          queue: 'notification_queue',
          queueOptions: {
            durable: false,
          },
        },
      },
    ]),
    HealthModule,
  ],
  controllers: [PresenceController],
  providers: [PresenceService, PresenceGateway],
})
export class AppModule {}
