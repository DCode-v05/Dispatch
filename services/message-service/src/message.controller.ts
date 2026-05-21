import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { MessageService } from './message.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Request as ExpressRequest } from 'express';

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    userId: string;
    email: string;
    username?: string;
  };
}
import { EventPattern, Payload } from '@nestjs/microservices';

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
  ) {
    return this.messageService.sendMessage(
      {
        roomId: data.roomId,
        content: data.content,
        type: 'text',
      },
      data.senderId,
    );
  }

  @Get(':roomId')
  @UseGuards(JwtAuthGuard)
  async getMessages(
    @Param('roomId') roomId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.messageService.getMessages(
      roomId,
      limit ? parseInt(limit, 10) : 50,
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
