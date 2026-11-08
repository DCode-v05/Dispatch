import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'chatrooms', timestamps: true })
export class ChatRoomRead extends Document {
  @Prop({ type: [String] })
  participants: string[];
}

export const ChatRoomReadSchema = SchemaFactory.createForClass(ChatRoomRead);
