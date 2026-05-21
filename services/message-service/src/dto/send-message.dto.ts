import { IsString, IsOptional, IsEnum } from 'class-validator';

export class SendMessageDto {
  @IsString()
  roomId: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsEnum(['text', 'image', 'file'])
  type?: string;
}
