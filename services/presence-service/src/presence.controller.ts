import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PresenceService } from './presence.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

const MAX_BATCH = 200;

@UseGuards(JwtAuthGuard)
@Controller('presence')
export class PresenceController {
  constructor(private readonly presenceService: PresenceService) {}

  @Get(':userId')
  async getStatus(@Param('userId') userId: string) {
    return this.presenceService.getStatus(userId);
  }

  @Get()
  async getBatchStatus(@Query('ids') ids?: string) {
    if (!ids) return {};
    const userIds = ids
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (userIds.length > MAX_BATCH) {
      throw new BadRequestException(
        `cannot request more than ${MAX_BATCH} users in one batch`,
      );
    }
    return this.presenceService.getBatchStatus(userIds);
  }
}
