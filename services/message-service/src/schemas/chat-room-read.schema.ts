import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Read-only mirror of the chatrooms collection (owned by chat-service).
 * Used by message-service to verify room membership without making an HTTP call.
 */
@Schema({ collection: 'chatrooms', timestamps: true })
export class ChatRoomRead extends Document {
  @Prop({ type: [String] })
  participants: string[];
}

export const ChatRoomReadSchema = SchemaFactory.createForClass(ChatRoomRead);
