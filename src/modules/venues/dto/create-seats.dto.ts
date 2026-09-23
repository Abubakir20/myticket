import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Length, MinLength } from 'class-validator';

export class CreatESeatsDto {
  @ApiProperty({ example: 6, description: 'Row' })
  @IsNumber()
  @IsNotEmpty()
  number!: number;
}
