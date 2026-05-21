import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsEnum(['direct', 'group'])
  type?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  participants?: string[];
}
