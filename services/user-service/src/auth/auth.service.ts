import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Inject,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UserService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ClientProxy } from '@nestjs/microservices';

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.userService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.userService.create({
      email: dto.email,
      username: dto.username,
      password: hashedPassword,
    });

    this.safeEmit('user.created', {
      userId: user.id,
      email: user.email,
      username: user.username,
    });

    const { password: _password, ...result } = user;
    return result;
  }

  async login(dto: LoginDto) {
    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const remainingMinutes = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60_000,
      );
      throw new UnauthorizedException(
        `Account locked. Try again in ${remainingMinutes} minute(s).`,
      );
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      await this.userService.recordFailedLogin(
        user.id,
        MAX_FAILED_LOGINS,
        LOCKOUT_MINUTES,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.userService.resetFailedLogins(user.id);
    }

    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  async validateUser(userId: string) {
    return this.userService.findById(userId);
  }

  private safeEmit(pattern: string, payload: Record<string, unknown>): void {
    try {
      this.notificationClient.emit(pattern, payload).subscribe({
        error: (err: Error) =>
          this.logger.warn(
            `Failed to emit ${pattern} (will be retried by broker if persistent): ${err.message}`,
          ),
      });
    } catch (err) {
      this.logger.warn(
        `Failed to emit ${pattern}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
