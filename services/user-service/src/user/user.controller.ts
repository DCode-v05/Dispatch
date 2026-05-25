import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Request as ExpressRequest } from 'express';

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    userId: string;
    email: string;
    username?: string;
  };
}

const MAX_BATCH_IDS = 100;

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async getMe(@Request() req: AuthenticatedRequest) {
    const user = await this.userService.findById(req.user.userId);
    const { password: _password, ...result } = user;
    return result;
  }

  @Patch('me')
  async updateMe(
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    const user = await this.userService.update(req.user.userId, dto);
    const { password: _password, ...result } = user;
    return result;
  }

  @Get(':id')
  async getUser(@Param('id', new ParseUUIDPipe()) id: string) {
    const user = await this.userService.findById(id);
    const { password: _password, ...result } = user;
    return result;
  }

  @Get()
  async getUsers(@Query('ids') ids?: string, @Query('q') query?: string) {
    if (query) {
      if (query.length < 2) {
        throw new BadRequestException(
          'search query must be at least 2 characters',
        );
      }
      const users = await this.userService.search(query);
      return users.map(({ password: _password, ...rest }) => rest);
    }
    if (!ids) return [];
    const idArray = ids
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (idArray.length > MAX_BATCH_IDS) {
      throw new BadRequestException(
        `cannot request more than ${MAX_BATCH_IDS} users in one batch`,
      );
    }
    const users = await this.userService.findByIds(idArray);
    return users.map(({ password: _password, ...rest }) => rest);
  }
}
