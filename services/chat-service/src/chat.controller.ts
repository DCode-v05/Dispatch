import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ChatService } from './chat.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Request as ExpressRequest } from 'express';

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    userId: string;
    email: string;
    username?: string;
  };
}

@Controller()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @UseGuards(JwtAuthGuard)
  @Post('rooms')
  async createRoom(
    @Body() dto: CreateRoomDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.chatService.createRoom(dto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('rooms')
  async getUserRooms(@Request() req: AuthenticatedRequest) {
    return this.chatService.getUserRooms(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('rooms/:id')
  async getRoom(@Param('id') id: string) {
    return this.chatService.getRoomById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('rooms/:id/join')
  async joinRoom(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.chatService.joinRoom(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('rooms/:id/participants')
  async addParticipants(
    @Param('id') id: string,
    @Body('userIds') userIds: string[],
  ) {
    return this.chatService.addParticipants(id, userIds);
  }

  @UseGuards(JwtAuthGuard)
  @Post('rooms/:id/leave')
  async leaveRoom(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.chatService.leaveRoom(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('rooms/:id')
  async deleteRoom(@Param('id') id: string) {
    return this.chatService.deleteRoom(id);
  }

  // RabbitMQ consumer: update lastMessageAt when a message is sent
  @EventPattern('message.sent')
  async handleMessageSent(@Payload() data: { roomId: string }) {
    await this.chatService.updateLastMessage(data.roomId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('invitations')
  async sendInvitation(
    @Body() dto: { email: string },
    @Request() req: AuthenticatedRequest,
  ) {
    const username = req.user.username || req.user.email.split('@')[0];
    return this.chatService.sendInvitation(
      req.user.userId,
      req.user.email,
      username,
      dto.email,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('invitations')
  async getInvitations(@Request() req: AuthenticatedRequest) {
    return this.chatService.getPendingInvitations(req.user.email);
  }

  @UseGuards(JwtAuthGuard)
  @Post('invitations/:id/accept')
  async acceptInvitation(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const username = req.user.username || req.user.email.split('@')[0];
    return this.chatService.acceptInvitation(id, req.user.userId, username);
  }

  @UseGuards(JwtAuthGuard)
  @Post('invitations/:id/reject')
  async rejectInvitation(@Param('id') id: string) {
    return this.chatService.rejectInvitation(id);
  }
}
