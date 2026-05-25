import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { validateEnv } from './common/env.validation';
import { MetricsModule } from './common/metrics.module';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { HealthModule } from './health/health.module';
import { ChatRoom, ChatRoomSchema } from './schemas/chat-room.schema';
import { Invitation, InvitationSchema } from './schemas/invitation.schema';

function rmqClient(name: string, queue: string, durable: boolean) {
  return {
    name,
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL as string],
      queue,
      queueOptions: { durable },
      socketOptions: { heartbeatIntervalInSeconds: 30 },
    },
  };
}

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
      { name: ChatRoom.name, schema: ChatRoomSchema },
      { name: Invitation.name, schema: InvitationSchema },
    ]),
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          throw new Error(
            '[chat-service] JWT_SECRET env var is required for JwtModule',
          );
        }
        return { secret };
      },
    }),
    ClientsModule.register([
      // @ts-expect-error -- helper returns valid RMQ client options
      rmqClient('NOTIFICATION_SERVICE', 'notification_queue', true),
      // @ts-expect-error -- helper returns valid RMQ client options
      rmqClient('MESSAGE_SERVICE', 'message_queue', true),
      // @ts-expect-error -- helper returns valid RMQ client options
      rmqClient('CHAT_SERVICE', 'chat_queue', true),
    ]),
    HealthModule,
    MetricsModule,
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatGateway,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
