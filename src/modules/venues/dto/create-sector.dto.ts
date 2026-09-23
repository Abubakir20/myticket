import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateSectorDto {
  @ApiProperty({ example: 'Sektor A', description: 'Sektor nomi' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  name!: string;
}
