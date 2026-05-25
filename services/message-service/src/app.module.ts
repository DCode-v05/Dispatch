import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import {
  ChatRoomRead,
  ChatRoomReadSchema,
} from './schemas/chat-room-read.schema';
import { Message, MessageSchema } from './schemas/message.schema';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { HealthModule } from './health/health.module';
import { validateEnv } from './common/env.validation';
import { MetricsModule } from './common/metrics.module';
import { RequestIdMiddleware } from './common/request-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 200 }]),
    MongooseModule.forRoot(process.env.MONGODB_URI as string, {
      maxPoolSize: parseInt(process.env.MONGODB_POOL_MAX ?? '10', 10),
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }),
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: ChatRoomRead.name, schema: ChatRoomReadSchema },
    ]),
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          throw new Error(
            '[message-service] JWT_SECRET env var is required for JwtModule',
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
      {
        name: 'CHAT_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL as string],
          queue: 'chat_queue',
          queueOptions: { durable: true },
          socketOptions: { heartbeatIntervalInSeconds: 30 },
        },
      },
    ]),
    HealthModule,
    MetricsModule,
  ],
  controllers: [MessageController],
  providers: [MessageService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
