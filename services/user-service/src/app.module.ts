import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      username: process.env.POSTGRES_USER || 'chatadmin',
      password: process.env.POSTGRES_PASSWORD || 'chatpass123',
      database: process.env.POSTGRES_DB || 'chatplatform',
      autoLoadEntities: true,
      synchronize: true, // Disable in production
    }),
    UserModule,
    AuthModule,
    HealthModule,
  ],
})
export class AppModule {}
