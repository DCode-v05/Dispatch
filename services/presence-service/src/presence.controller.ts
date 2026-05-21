import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PresenceService } from './presence.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('presence')
export class PresenceController {
  constructor(private readonly presenceService: PresenceService) {}

  @Get(':userId')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Param('userId') userId: string) {
    return this.presenceService.getStatus(userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getBatchStatus(@Query('ids') ids: string) {
    const userIds = ids.split(',');
    return this.presenceService.getBatchStatus(userIds);
  }
}
