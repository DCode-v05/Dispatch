import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
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

const MAX_PARTICIPANTS_PER_ADD = 50;

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
  async getRoom(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.chatService.getRoomForUser(id, req.user.userId);
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
    @Request() req: AuthenticatedRequest,
  ) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new BadRequestException('userIds must be a non-empty array');
    }
    if (userIds.length > MAX_PARTICIPANTS_PER_ADD) {
      throw new BadRequestException(
        `cannot add more than ${MAX_PARTICIPANTS_PER_ADD} participants at once`,
      );
    }
    return this.chatService.addParticipants(id, userIds, req.user.userId);
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
  async deleteRoom(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.chatService.deleteRoom(id, req.user.userId);
  }

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
    if (!dto.email || typeof dto.email !== 'string') {
      throw new BadRequestException('email is required');
    }
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
    return this.chatService.acceptInvitation(
      id,
      req.user.userId,
      username,
      req.user.email,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('invitations/:id/reject')
  async rejectInvitation(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.chatService.rejectInvitation(id, req.user.email);
  }
}
