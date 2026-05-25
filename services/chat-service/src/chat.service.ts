import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ClientProxy } from '@nestjs/microservices';
import { ChatRoom } from './schemas/chat-room.schema';
import { Invitation } from './schemas/invitation.schema';
import { CreateRoomDto } from './dto/create-room.dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectModel(ChatRoom.name) private readonly chatRoomModel: Model<ChatRoom>,
    @InjectModel(Invitation.name)
    private readonly invitationModel: Model<Invitation>,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
    @Inject('CHAT_SERVICE') private readonly chatClient: ClientProxy,
  ) {}

  private assertValidObjectId(id: string, label: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`${label} is not a valid id`);
    }
  }

  async createRoom(dto: CreateRoomDto, userId: string): Promise<ChatRoom> {
    const participants = Array.from(
      new Set([...(dto.participants || []), userId]),
    );

    const room = await this.chatRoomModel.create({
      name: dto.name,
      type: dto.type || 'group',
      participants,
      createdBy: userId,
    });

    return room;
  }

  async getUserRooms(userId: string): Promise<ChatRoom[]> {
    return this.chatRoomModel
      .find({ participants: userId })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .limit(200)
      .exec();
  }

  async getRoomById(roomId: string): Promise<ChatRoom> {
    this.assertValidObjectId(roomId, 'roomId');
    const room = await this.chatRoomModel.findById(roomId).exec();
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  async getRoomForUser(roomId: string, userId: string): Promise<ChatRoom> {
    const room = await this.getRoomById(roomId);
    if (!room.participants.includes(userId)) {
      throw new ForbiddenException('You are not a participant of this room');
    }
    return room;
  }

  async isParticipant(roomId: string, userId: string): Promise<boolean> {
    this.assertValidObjectId(roomId, 'roomId');
    const room = await this.chatRoomModel
      .findOne({ _id: roomId, participants: userId })
      .select({ _id: 1 })
      .exec();
    return !!room;
  }

  async joinRoom(roomId: string, userId: string): Promise<ChatRoom> {
    const room = await this.getRoomById(roomId);
    if (room.type === 'direct') {
      throw new ForbiddenException('Cannot join a direct chat');
    }
    if (!room.participants.includes(userId)) {
      room.participants.push(userId);
      await room.save();

      this.safeEmit(this.notificationClient, 'user.joined_room', {
        userId,
        roomId: room._id,
        roomName: room.name,
        participants: room.participants,
      });
    }
    return room;
  }

  async addParticipants(
    roomId: string,
    userIds: string[],
    requesterId: string,
  ): Promise<ChatRoom> {
    const room = await this.getRoomById(roomId);
    if (room.type === 'direct') {
      throw new ForbiddenException('Cannot add participants to a direct chat');
    }
    if (!room.participants.includes(requesterId)) {
      throw new ForbiddenException(
        'Only existing participants can add new members',
      );
    }
    let added = false;
    for (const userId of userIds) {
      if (!room.participants.includes(userId)) {
        room.participants.push(userId);
        added = true;
      }
    }
    if (added) {
      await room.save();
    }
    return room;
  }

  async leaveRoom(roomId: string, userId: string): Promise<ChatRoom> {
    const room = await this.getRoomById(roomId);
    if (!room.participants.includes(userId)) {
      throw new ForbiddenException('You are not a participant of this room');
    }
    room.participants = room.participants.filter((p) => p !== userId);
    await room.save();

    this.safeEmit(this.notificationClient, 'user.left_room', {
      userId,
      roomId: room._id,
      roomName: room.name,
    });

    return room;
  }

  async deleteRoom(roomId: string, requesterId: string): Promise<void> {
    const room = await this.getRoomById(roomId);
    if (room.createdBy !== requesterId) {
      throw new ForbiddenException('Only the room creator can delete the room');
    }
    await this.chatRoomModel.deleteOne({ _id: roomId }).exec();

    this.safeEmit(this.notificationClient, 'room.deleted', {
      roomId,
      participants: room.participants,
    });
  }

  async updateLastMessage(roomId: string): Promise<void> {
    if (!Types.ObjectId.isValid(roomId)) return;
    await this.chatRoomModel.findByIdAndUpdate(roomId, {
      lastMessageAt: new Date(),
    });
  }

  async sendInvitation(
    senderId: string,
    senderEmail: string,
    senderUsername: string,
    receiverEmail: string,
  ): Promise<Invitation> {
    if (receiverEmail.toLowerCase() === senderEmail.toLowerCase()) {
      throw new BadRequestException('Cannot invite yourself');
    }

    const existing = await this.invitationModel.findOne({
      senderId,
      receiverEmail,
      status: 'pending',
    });
    if (existing) return existing;

    const invitation = await this.invitationModel.create({
      senderId,
      senderEmail,
      senderUsername,
      receiverEmail,
      status: 'pending',
    });

    this.safeEmit(this.notificationClient, 'invitation.sent', {
      senderId,
      senderEmail,
      senderUsername,
      receiverEmail,
      invitationId: invitation._id,
    });

    return invitation;
  }

  async getPendingInvitations(email: string): Promise<Invitation[]> {
    return this.invitationModel
      .find({ receiverEmail: email, status: 'pending' })
      .limit(100)
      .exec();
  }

  async acceptInvitation(
    invitationId: string,
    userId: string,
    receiverUsername: string,
    receiverEmail: string,
  ): Promise<ChatRoom> {
    this.assertValidObjectId(invitationId, 'invitationId');
    const invitation = await this.invitationModel.findById(invitationId);
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status !== 'pending') {
      throw new ConflictException('Invitation already processed');
    }
    if (
      invitation.receiverEmail.toLowerCase() !== receiverEmail.toLowerCase()
    ) {
      throw new ForbiddenException('This invitation was not sent to you');
    }

    let room = await this.chatRoomModel
      .findOne({
        type: 'direct',
        participants: { $all: [invitation.senderId, userId], $size: 2 },
      })
      .exec();

    if (!room) {
      room = await this.chatRoomModel.create({
        name: `Direct Chat`,
        type: 'direct',
        participants: [invitation.senderId, userId],
        participantNames: {
          [invitation.senderId]: invitation.senderUsername,
          [userId]: receiverUsername,
        },
        createdBy: invitation.senderId,
      });
    }

    invitation.status = 'accepted';
    invitation.acceptedAt = new Date();
    await invitation.save();

    this.safeEmit(this.chatClient, 'invitation.accepted', {
      roomId: room._id,
      participants: [invitation.senderId, userId],
    });

    return room;
  }

  async rejectInvitation(
    invitationId: string,
    receiverEmail: string,
  ): Promise<void> {
    this.assertValidObjectId(invitationId, 'invitationId');
    const invitation = await this.invitationModel.findById(invitationId);
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (
      invitation.receiverEmail.toLowerCase() !== receiverEmail.toLowerCase()
    ) {
      throw new ForbiddenException('This invitation was not sent to you');
    }
    await this.invitationModel.findByIdAndUpdate(invitationId, {
      status: 'rejected',
    });
  }

  private safeEmit(
    client: ClientProxy,
    pattern: string,
    payload: Record<string, unknown>,
  ): void {
    try {
      client.emit(pattern, payload).subscribe({
        error: (err: Error) =>
          this.logger.warn(`Failed to emit ${pattern}: ${err.message}`),
      });
    } catch (err) {
      this.logger.warn(
        `Failed to emit ${pattern}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
