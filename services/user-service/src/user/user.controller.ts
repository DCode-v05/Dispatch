import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
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

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req: AuthenticatedRequest) {
    const user = await this.userService.findById(req.user.userId);
    const { password: _password, ...result } = user;
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    const user = await this.userService.update(req.user.userId, dto);
    const { password: _password, ...result } = user;
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getUser(@Param('id') id: string) {
    const user = await this.userService.findById(id);
    const { password: _password, ...result } = user;
    return result;
  }

  @Get()
  async getUsers(@Query('ids') ids: string, @Query('q') query: string) {
    if (query) {
      const users = await this.userService.search(query);
      return users.map(({ password: _password, ...rest }) => rest);
    }
    if (!ids) return [];
    const idArray = ids.split(',');
    const users = await this.userService.findByIds(idArray);
    return users.map(({ password: _password, ...rest }) => rest);
  }
}
