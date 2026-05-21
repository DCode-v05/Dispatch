import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Invitation extends Document {
  @Prop({ required: true })
  senderId: string;

  @Prop({ required: true })
  senderEmail: string;

  @Prop({ required: true })
  senderUsername: string;

  @Prop({ required: true })
  receiverEmail: string;

  @Prop({ enum: ['pending', 'accepted', 'rejected'], default: 'pending' })
  status: string;

  @Prop()
  acceptedAt: Date;
}

export const InvitationSchema = SchemaFactory.createForClass(Invitation);
