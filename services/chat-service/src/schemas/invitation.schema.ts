import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Invitation extends Document {
  @Prop({ required: true, index: true })
  senderId: string;

  @Prop({ required: true })
  senderEmail: string;

  @Prop({ required: true })
  senderUsername: string;

  @Prop({ required: true, index: true })
  receiverEmail: string;

  @Prop({
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
    index: true,
  })
  status: string;

  @Prop()
  acceptedAt: Date;
}

export const InvitationSchema = SchemaFactory.createForClass(Invitation);
InvitationSchema.index({ receiverEmail: 1, status: 1 });
InvitationSchema.index({ senderId: 1, receiverEmail: 1, status: 1 });
