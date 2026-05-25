import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { Request as ExpressRequest } from 'express';
import { MessageService } from './message.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    userId: string;
    email: string;
    username?: string;
  };
}

const MAX_LIMIT = 200;

@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async sendMessage(
    @Body() dto: SendMessageDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.messageService.sendMessage(dto, req.user.userId);
  }

  @EventPattern('message.create')
  async handleMessageCreate(
    @Payload() data: { roomId: string; content: string; senderId: string },
  ): Promise<void> {
    await this.messageService.handleEventMessageCreate(data);
  }

  @Get(':roomId')
  @UseGuards(JwtAuthGuard)
  async getMessages(
    @Param('roomId') roomId: string,
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
      throw new BadRequestException('limit must be a positive integer');
    }
    return this.messageService.getMessages(
      roomId,
      req.user.userId,
      Math.min(parsedLimit, MAX_LIMIT),
      before,
    );
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  async markAsRead(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.messageService.markAsRead(id, req.user.userId);
  }

  @Patch('room/:roomId/read')
  @UseGuards(JwtAuthGuard)
  async markRoomAsRead(
    @Param('roomId') roomId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.messageService.markRoomAsRead(roomId, req.user.userId);
  }
}
