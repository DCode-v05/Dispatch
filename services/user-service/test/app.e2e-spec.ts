/* eslint-disable @typescript-eslint/require-await */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { UserController } from '../src/user/user.controller';
import { UserService } from '../src/user/user.service';
import { User } from '../src/user/user.entity';

process.env.JWT_SECRET = 'e2e-test-secret-must-be-at-least-32-chars-long';
process.env.NODE_ENV = 'test';

/**
 * In-memory Repository<User> just barely TypeORM-shaped to exercise the auth flow
 * through real controllers + DTOs + ValidationPipe + bcrypt + JWT.
 */
function makeFakeUserRepo() {
  const rows = new Map<string, User>();
  const byEmail = new Map<string, string>();

  return {
    findOne: jest.fn(
      async ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.id) return rows.get(where.id) ?? null;
        if (where.email) {
          const id = byEmail.get(where.email);
          return id ? (rows.get(id) ?? null) : null;
        }
        return null;
      },
    ),
    find: jest.fn(async () => Array.from(rows.values())),
    create: jest.fn((data: Partial<User>) => ({ ...data })),
    save: jest.fn(async (entity: Partial<User>) => {
      const now = new Date();
      const stored: User = {
        id: entity.id ?? randomUUID(),
        email: entity.email!,
        username: entity.username!,
        password: entity.password!,
        avatarUrl: entity.avatarUrl ?? '',
        isActive: entity.isActive ?? true,
        failedLoginAttempts: entity.failedLoginAttempts ?? 0,
        lockedUntil: entity.lockedUntil ?? null,
        createdAt: now,
        updatedAt: now,
      };
      rows.set(stored.id, stored);
      byEmail.set(stored.email, stored.id);
      return stored;
    }),
    update: jest.fn(async (id: string, patch: Partial<User>) => {
      const current = rows.get(id);
      if (!current) return;
      rows.set(id, { ...current, ...patch, updatedAt: new Date() });
    }),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    })),
  };
}

describe('Auth flow (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PassportModule,
        JwtModule.register({
          secret: process.env.JWT_SECRET!,
          signOptions: { expiresIn: 86400 },
        }),
        ThrottlerModule.forRoot([
          { name: 'default', ttl: 60_000, limit: 1000 },
        ]),
      ],
      controllers: [AuthController, UserController],
      providers: [
        AuthService,
        UserService,
        JwtStrategy,
        { provide: getRepositoryToken(User), useValue: makeFakeUserRepo() },
        {
          provide: 'NOTIFICATION_SERVICE',
          useValue: {
            emit: () => ({ subscribe: () => undefined }),
          },
        },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/register rejects a weak password', async () => {
    const res = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'alice@example.com',
      username: 'alice',
      password: 'short',
    });
    expect(res.status).toBe(400);
  });

  it('POST /auth/register rejects bad username characters', async () => {
    const res = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'alice@example.com',
      username: 'al ice!',
      password: 'Aliceabc1',
    });
    expect(res.status).toBe(400);
  });

  it('POST /auth/register + /auth/login round-trip works', async () => {
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'bob@example.com',
        username: 'bob',
        password: 'Bobpass123',
      });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.email).toBe('bob@example.com');
    expect(registerRes.body.password).toBeUndefined();

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'bob@example.com', password: 'Bobpass123' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.accessToken).toEqual(expect.any(String));
    expect(loginRes.body.user.email).toBe('bob@example.com');
    expect(loginRes.body.user.password).toBeUndefined();

    const meRes = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.email).toBe('bob@example.com');
    expect(meRes.body.password).toBeUndefined();
  });

  it('POST /auth/login fails with wrong password', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'bob@example.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('POST /auth/register rejects duplicate email', async () => {
    const res = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'bob@example.com',
      username: 'bob2',
      password: 'Bobpass123',
    });
    expect(res.status).toBe(409);
  });

  it('GET /users/me without token returns 401', async () => {
    const res = await request(app.getHttpServer()).get('/users/me');
    expect(res.status).toBe(401);
  });

  it('account locks after 5 failed logins', async () => {
    await request(app.getHttpServer()).post('/auth/register').send({
      email: 'lockme@example.com',
      username: 'lockme',
      password: 'Lockme1234',
    });

    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'lockme@example.com', password: 'wrong' });
    }

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'lockme@example.com', password: 'Lockme1234' });

    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).toMatch(/locked/i);
  });
});
