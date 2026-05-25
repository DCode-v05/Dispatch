import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'alice@example.com', maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({
    example: 'alice',
    minLength: 3,
    maxLength: 32,
    description: 'Letters, numbers, underscores, dots, and hyphens only',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message:
      'username may only contain letters, numbers, underscores, dots, and hyphens',
  })
  username: string;

  @ApiProperty({
    example: 'Aliceabc123',
    minLength: 8,
    maxLength: 128,
    description:
      'At least 8 characters, with an uppercase letter, a lowercase letter, and a digit',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/[A-Z]/, { message: 'password must contain an uppercase letter' })
  @Matches(/[a-z]/, { message: 'password must contain a lowercase letter' })
  @Matches(/[0-9]/, { message: 'password must contain a digit' })
  password: string;
}
