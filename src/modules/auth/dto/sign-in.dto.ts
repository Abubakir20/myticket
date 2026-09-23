import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsStrongPassword } from 'class-validator';

export class SignInDto {
  @ApiProperty({
    type: String,
    example: 'abubakirbotirov55@gmail.com',
    description: 'Superadmin email',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    type: String,
    example: 'Say_1kon',
    description: 'Superadmin password',
  })
  @IsStrongPassword()
  @IsNotEmpty()
  password!: string;
}
