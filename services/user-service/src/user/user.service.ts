import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    return this.userRepo.find({ where: { id: In(ids) } });
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepo.create(data);
    return this.userRepo.save(user);
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    await this.userRepo.update(id, data);
    return this.findById(id);
  }

  async search(query: string): Promise<User[]> {
    const sanitized = query.replace(/[%_]/g, '\\$&');
    return this.userRepo
      .createQueryBuilder('user')
      .where('user.username ILIKE :query', { query: `%${sanitized}%` })
      .orWhere('user.email ILIKE :query', { query: `%${sanitized}%` })
      .limit(10)
      .getMany();
  }

  async recordFailedLogin(
    userId: string,
    maxAttempts: number,
    lockoutMinutes: number,
  ): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return;
    const next = (user.failedLoginAttempts ?? 0) + 1;
    const update: Partial<User> = { failedLoginAttempts: next };
    if (next >= maxAttempts) {
      update.lockedUntil = new Date(Date.now() + lockoutMinutes * 60_000);
    }
    await this.userRepo.update(userId, update);
  }

  async resetFailedLogins(userId: string): Promise<void> {
    await this.userRepo.update(userId, {
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
  }
}
