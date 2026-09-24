import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { SeatingType } from '../../../../generated/prisma/enums';

export class CreateTicketCategoryDto {
  @ApiProperty({ example: 'VIP' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 250000, description: "Narx, so'mda" })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @ApiPropertyOptional({
    example: '3f1c2a9e-6b7d-4c2e-9f1a-1b2c3d4e5f60',
    description: 'Faqat SEATED: shu kategoriya narxi amal qiladigan sektor',
  })
  @IsOptional()
  @IsUUID()
  sectorId?: string;

  @ApiPropertyOptional({
    example: 500,
    description: 'Faqat GENERAL: sotiladigan chiptalar soni',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class CreateSessionDto {
  @ApiProperty({ example: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d' })
  @IsUUID()
  venueId!: string;

  @ApiProperty({ example: '2026-12-31T19:00:00.000Z' })
  @IsDateString()
  startTime!: string;

  @ApiProperty({ enum: SeatingType, example: SeatingType.SEATED })
  @IsEnum(SeatingType)
  seatingType!: SeatingType;

  @ApiProperty({ type: [CreateTicketCategoryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateTicketCategoryDto)
  categories!: CreateTicketCategoryDto[];
}
