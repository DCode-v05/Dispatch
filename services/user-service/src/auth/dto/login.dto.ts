import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'alice@example.com', maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'Aliceabc123', maxLength: 128 })
  @IsString()
  @MaxLength(128)
  password: string;
}
