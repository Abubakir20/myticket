import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsStrongPassword,
} from 'class-validator';

export class CreateControllerDto {
  @ApiProperty({
    type: String,
    example: 'fullName',
    description: "Controller's fullName",
  })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({
    type: String,
    example: 'constroller@example.com',
    description: "Constroller's email",
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    type: String,
    example: 'Controller1!',
    description: "Constroller's password",
  })
  @IsStrongPassword()
  @IsNotEmpty()
  password!: string;
}
