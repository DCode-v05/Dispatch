import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';

const fixtureUser = (
  overrides: Partial<User> = {},
): User => ({
  id: 'user-1',
  email: 'alice@example.com',
  username: 'alice',
  password: 'will-be-replaced',
  avatarUrl: '',
  isActive: true,
  failedLoginAttempts: 0,
  lockedUntil: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('AuthService', () => {
  let authService: AuthService;
  let userService: jest.Mocked<UserService>;
  let jwtService: jest.Mocked<JwtService>;
  let notificationClient: { emit: jest.Mock };

  beforeEach(async () => {
    userService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      recordFailedLogin: jest.fn(),
      resetFailedLogins: jest.fn(),
    } as unknown as jest.Mocked<UserService>;

    jwtService = {
      sign: jest.fn().mockReturnValue('signed.jwt.token'),
    } as unknown as jest.Mocked<JwtService>;

    notificationClient = {
      emit: jest.fn().mockReturnValue({
        subscribe: ({ error }: { error?: (e: Error) => void }) => {
          // immediately invoke success — no error
          void error;
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: userService },
        { provide: JwtService, useValue: jwtService },
        { provide: 'NOTIFICATION_SERVICE', useValue: notificationClient },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('creates a new user with hashed password and emits user.created', async () => {
      userService.findByEmail.mockResolvedValue(null);
      userService.create.mockImplementation(async (data) =>
        fixtureUser({ ...data, id: 'new-id' }),
      );

      const result = await authService.register({
        email: 'bob@example.com',
        username: 'bob',
        password: 'Bobpass1',
      });

      expect(userService.create).toHaveBeenCalledTimes(1);
      const createArg = userService.create.mock.calls[0][0];
      expect(createArg.email).toBe('bob@example.com');
      expect(createArg.username).toBe('bob');
      // Password must be hashed, not stored plain
      expect(createArg.password).not.toBe('Bobpass1');
      expect(await bcrypt.compare('Bobpass1', createArg.password!)).toBe(true);

      expect(notificationClient.emit).toHaveBeenCalledWith(
        'user.created',
        expect.objectContaining({
          userId: 'new-id',
          email: 'bob@example.com',
        }),
      );

      // result must not leak the hashed password
      expect((result as { password?: string }).password).toBeUndefined();
    });

    it('throws ConflictException if email already exists', async () => {
      userService.findByEmail.mockResolvedValue(fixtureUser());
      await expect(
        authService.register({
          email: 'alice@example.com',
          username: 'alice2',
          password: 'Alicepass1',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(userService.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns access token + user on correct credentials', async () => {
      const hashed = await bcrypt.hash('Aliceabc1', 12);
      userService.findByEmail.mockResolvedValue(
        fixtureUser({ password: hashed }),
      );

      const result = await authService.login({
        email: 'alice@example.com',
        password: 'Aliceabc1',
      });

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user.id).toBe('user-1');
      expect((result.user as { password?: string }).password).toBeUndefined();
    });

    it('throws UnauthorizedException on wrong password and records failed attempt', async () => {
      const hashed = await bcrypt.hash('Aliceabc1', 12);
      userService.findByEmail.mockResolvedValue(
        fixtureUser({ password: hashed }),
      );

      await expect(
        authService.login({
          email: 'alice@example.com',
          password: 'WRONG',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(userService.recordFailedLogin).toHaveBeenCalledWith(
        'user-1',
        5,
        15,
      );
    });

    it('throws UnauthorizedException if user not found (and does NOT leak that)', async () => {
      userService.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'nobody@example.com',
          password: 'whatever',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(userService.recordFailedLogin).not.toHaveBeenCalled();
    });

    it('throws if account is locked', async () => {
      const hashed = await bcrypt.hash('Aliceabc1', 12);
      const futureLock = new Date(Date.now() + 10 * 60_000);
      userService.findByEmail.mockResolvedValue(
        fixtureUser({ password: hashed, lockedUntil: futureLock }),
      );

      await expect(
        authService.login({
          email: 'alice@example.com',
          password: 'Aliceabc1',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      // Should not even check password / count this as a failed attempt
      expect(userService.recordFailedLogin).not.toHaveBeenCalled();
    });

    it('resets failed attempts after successful login', async () => {
      const hashed = await bcrypt.hash('Aliceabc1', 12);
      userService.findByEmail.mockResolvedValue(
        fixtureUser({ password: hashed, failedLoginAttempts: 3 }),
      );

      await authService.login({
        email: 'alice@example.com',
        password: 'Aliceabc1',
      });

      expect(userService.resetFailedLogins).toHaveBeenCalledWith('user-1');
    });

    it('treats an expired lock as unlocked', async () => {
      const hashed = await bcrypt.hash('Aliceabc1', 12);
      const pastLock = new Date(Date.now() - 60_000);
      userService.findByEmail.mockResolvedValue(
        fixtureUser({
          password: hashed,
          lockedUntil: pastLock,
          failedLoginAttempts: 5,
        }),
      );

      const result = await authService.login({
        email: 'alice@example.com',
        password: 'Aliceabc1',
      });

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(userService.resetFailedLogins).toHaveBeenCalledWith('user-1');
    });
  });
});
