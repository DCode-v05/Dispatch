import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ChatRoom extends Document {
  @Prop({ required: true, maxlength: 200 })
  name: string;

  @Prop({ enum: ['direct', 'group'], default: 'group' })
  type: string;

  @Prop({ type: [String], index: true })
  participants: string[];

  @Prop({ type: Object })
  participantNames: Record<string, string>;

  @Prop({ required: true, index: true })
  createdBy: string;

  @Prop({ index: true })
  lastMessageAt: Date;
}

export const ChatRoomSchema = SchemaFactory.createForClass(ChatRoom);
ChatRoomSchema.index({ participants: 1, lastMessageAt: -1 });
ChatRoomSchema.index({ type: 1, participants: 1 });
