import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ChatRoom extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ enum: ['direct', 'group'], default: 'group' })
  type: string;

  @Prop({ type: [String] })
  participants: string[];

  @Prop({ type: Object })
  participantNames: Record<string, string>;

  @Prop({ required: true })
  createdBy: string;

  @Prop()
  lastMessageAt: Date;
}

export const ChatRoomSchema = SchemaFactory.createForClass(ChatRoom);
