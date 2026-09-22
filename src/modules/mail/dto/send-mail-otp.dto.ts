import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsPhoneNumber } from 'class-validator';

export class SendOTPDto {
  @ApiProperty({
    type: String,
    example: 'test@gmail.com',
    description: 'User email'
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}
