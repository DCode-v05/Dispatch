import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClientProxy } from '@nestjs/microservices';
import { ChatRoom } from './schemas/chat-room.schema';
import { Invitation } from './schemas/invitation.schema';
import { CreateRoomDto } from './dto/create-room.dto';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatRoom.name) private readonly chatRoomModel: Model<ChatRoom>,
    @InjectModel(Invitation.name)
    private readonly invitationModel: Model<Invitation>,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
    @Inject('CHAT_SERVICE') private readonly chatClient: ClientProxy,
  ) {}

  async createRoom(dto: CreateRoomDto, userId: string): Promise<ChatRoom> {
    const participants = dto.participants || [];
    if (!participants.includes(userId)) {
      participants.push(userId);
    }

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
      .exec();
  }

  async getRoomById(roomId: string): Promise<ChatRoom> {
    const room = await this.chatRoomModel.findById(roomId).exec();
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  async joinRoom(roomId: string, userId: string): Promise<ChatRoom> {
    const room = await this.getRoomById(roomId);
    if (!room.participants.includes(userId)) {
      room.participants.push(userId);
      await room.save();

      this.notificationClient.emit('user.joined_room', {
        userId,
        roomId: room._id,
        roomName: room.name,
      });
    }
    return room;
  }

  async addParticipants(roomId: string, userIds: string[]): Promise<ChatRoom> {
    const room = await this.getRoomById(roomId);
    let added = false;
    for (const userId of userIds) {
      if (!room.participants.includes(userId)) {
        room.participants.push(userId);
        added = true;
      }
    }
    if (added) {
      await room.save();
      // Notify new participants or room about update
    }
    return room;
  }

  async leaveRoom(roomId: string, userId: string): Promise<ChatRoom> {
    const room = await this.getRoomById(roomId);
    room.participants = room.participants.filter((p) => p !== userId);
    await room.save();

    this.notificationClient.emit('user.left_room', {
      userId,
      roomId: room._id,
      roomName: room.name,
    });

    return room;
  }

  async deleteRoom(roomId: string): Promise<void> {
    const room = await this.getRoomById(roomId);
    await this.chatRoomModel.deleteOne({ _id: roomId }).exec();

    this.notificationClient.emit('room.deleted', {
      roomId,
      participants: room.participants,
    });
  }

  async updateLastMessage(roomId: string): Promise<void> {
    await this.chatRoomModel.findByIdAndUpdate(roomId, {
      lastMessageAt: new Date(),
    });
  }

  // Invitation methods
  async sendInvitation(
    senderId: string,
    senderEmail: string,
    senderUsername: string,
    receiverEmail: string,
  ): Promise<Invitation> {
    // Check if a direct room already exists
    /*
    const existingRoom = await this.chatRoomModel
      .findOne({
        type: 'direct',
        participants: { $all: [senderId] }, // We don't have receiverId yet, so we can only check by sender and invitation status
      })
      .exec();
    */

    // Check if invitation already exists
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

    this.notificationClient.emit('invitation.sent', {
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
      .exec();
  }

  async acceptInvitation(
    invitationId: string,
    userId: string,
    receiverUsername: string,
  ): Promise<ChatRoom> {
    const invitation = await this.invitationModel.findById(invitationId);
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status !== 'pending')
      throw new Error('Invitation already processed');

    // Check if a room already exists
    let room = await this.chatRoomModel
      .findOne({
        type: 'direct',
        participants: { $all: [invitation.senderId, userId] },
      })
      .exec();

    if (!room) {
      room = await this.chatRoomModel.create({
        name: `Direct Chat`, // Generic name, we'll use participantNames in frontend
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

    // Notify both users to join the room via chat-service (Socket.IO)
    this.chatClient.emit('invitation.accepted', {
      roomId: room._id,
      participants: [invitation.senderId, userId],
    });

    return room;
  }

  async rejectInvitation(invitationId: string): Promise<void> {
    await this.invitationModel.findByIdAndUpdate(invitationId, {
      status: 'rejected',
    });
  }
}
