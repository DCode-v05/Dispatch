import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['log', 'warn', 'error']
        : ['log', 'warn', 'error', 'debug', 'verbose'],
  });

  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.enableShutdownHooks();

  if (process.env.SWAGGER_ENABLED !== 'false') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('user-service')
      .setDescription('Authentication, profiles, and user lookup')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const swaggerDoc = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, swaggerDoc, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL as string],
      queue: 'user_queue',
      queueOptions: { durable: true },
      noAck: false,
      socketOptions: { heartbeatIntervalInSeconds: 30 },
    },
  });

  await app.startAllMicroservices();
  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port, '0.0.0.0');
  logger.log(`user-service listening on 0.0.0.0:${port}`);
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
