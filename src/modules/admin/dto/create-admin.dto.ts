import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsStrongPassword } from 'class-validator';

export class CreateAdminDto {
  @ApiProperty({
    example: 'admin@example.com',
    description: 'Admin email',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    example: 'Admin123!',
    description: 'Admin password',
  })
  @IsStrongPassword()
  @IsNotEmpty()
  password!: string;
}
