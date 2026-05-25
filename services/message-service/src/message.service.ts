import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ClientProxy } from '@nestjs/microservices';
import { Message } from './schemas/message.schema';
import { ChatRoomRead } from './schemas/chat-room-read.schema';
import { SendMessageDto } from './dto/send-message.dto';

interface MessageDocument extends Message {
  _id: Types.ObjectId;
  createdAt: Date;
}

const MAX_CONTENT_LENGTH = 4000;
const MAX_LIMIT = 200;

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(ChatRoomRead.name)
    private readonly chatRoomModel: Model<ChatRoomRead>,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
    @Inject('CHAT_SERVICE') private readonly chatClient: ClientProxy,
  ) {}

  async assertParticipant(roomId: string, userId: string): Promise<string[]> {
    if (!Types.ObjectId.isValid(roomId)) {
      throw new BadRequestException('roomId is not a valid id');
    }
    const room = await this.chatRoomModel
      .findById(roomId)
      .select({ participants: 1 })
      .lean()
      .exec();
    if (!room) {
      throw new BadRequestException('Room not found');
    }
    if (!room.participants?.includes(userId)) {
      throw new ForbiddenException('You are not a participant of this room');
    }
    return room.participants;
  }

  async sendMessage(dto: SendMessageDto, userId: string): Promise<Message> {
    if (!dto.content || dto.content.trim().length === 0) {
      throw new BadRequestException('content is required');
    }
    const content = dto.content.slice(0, MAX_CONTENT_LENGTH);
    const participants = await this.assertParticipant(dto.roomId, userId);

    const message = await this.messageModel.create({
      roomId: dto.roomId,
      senderId: userId,
      content,
      type: dto.type || 'text',
      readBy: [userId],
    });

    const eventPayload = {
      messageId: message._id,
      roomId: message.roomId,
      senderId: message.senderId,
      content: message.content,
      timestamp: message.createdAt,
      participants,
    };

    this.safeEmit(this.notificationClient, 'message.sent', eventPayload);
    this.safeEmit(this.chatClient, 'message.sent', eventPayload);

    return message;
  }

  async handleEventMessageCreate(data: {
    roomId: string;
    content: string;
    senderId: string;
  }): Promise<void> {
    try {
      await this.sendMessage(
        { roomId: data.roomId, content: data.content, type: 'text' },
        data.senderId,
      );
    } catch (err) {
      this.logger.warn(
        `message.create event failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async getMessages(
    roomId: string,
    userId: string,
    limit: number = 50,
    before?: string,
  ): Promise<Message[]> {
    await this.assertParticipant(roomId, userId);
    const safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);

    if (before && !Types.ObjectId.isValid(before)) {
      throw new BadRequestException('before must be a valid ObjectId');
    }

    const messages = await this.messageModel
      .find(
        before
          ? { roomId, _id: { $lt: new Types.ObjectId(before) } }
          : { roomId },
      )
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .exec();

    return messages.reverse();
  }

  async markAsRead(messageId: string, userId: string): Promise<Message | null> {
    if (!Types.ObjectId.isValid(messageId)) {
      throw new BadRequestException('messageId is not a valid id');
    }
    const msg = await this.messageModel.findById(messageId).exec();
    if (!msg) return null;
    await this.assertParticipant(msg.roomId, userId);
    return this.messageModel
      .findByIdAndUpdate(
        messageId,
        { $addToSet: { readBy: userId } },
        { new: true },
      )
      .exec();
  }

  async markRoomAsRead(roomId: string, userId: string): Promise<void> {
    await this.assertParticipant(roomId, userId);
    await this.messageModel
      .updateMany(
        { roomId, readBy: { $ne: userId } },
        { $addToSet: { readBy: userId } },
      )
      .exec();

    this.safeEmit(this.chatClient, 'messages.read', { roomId, userId });
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    if (!Types.ObjectId.isValid(messageId)) {
      throw new BadRequestException('messageId is not a valid id');
    }
    const msg = await this.messageModel.findById(messageId).exec();
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    const roomId = msg.roomId;
    await this.messageModel.deleteOne({ _id: messageId }).exec();

    this.safeEmit(this.chatClient, 'message.deleted', {
      messageId,
      roomId,
      senderId: userId,
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
