import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Message extends Document {
  @Prop({ required: true })
  roomId: string;

  @Prop({ required: true })
  senderId: string;

  @Prop({ required: true })
  content: string;

  @Prop({ enum: ['text', 'image', 'file'], default: 'text' })
  type: string;

  @Prop({ type: [String], default: [] })
  readBy: string[];
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ roomId: 1, createdAt: -1 });
