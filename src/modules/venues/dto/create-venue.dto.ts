import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateVenueDto {
  @ApiProperty({ example: 'Humo Arena' })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiProperty({ example: "Toshkent, Olmazor tumani, Beruniy ko'chasi" })
  @IsString()
  @MinLength(5)
  address!: string;

  @ApiPropertyOptional({ example: '12 000 o‘rinli yopiq arena' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
