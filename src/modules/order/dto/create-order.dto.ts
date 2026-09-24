import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class GeneralOrderItemDto {
  @ApiProperty({
    example: '3f1c2a9e-6b7d-4c2e-9f1a-1b2c3d4e5f60',
    description: 'GENERAL seans kategoriyasi',
  })
  @IsUUID()
  @IsNotEmpty()
  ticketCategoryId!: string;

  @ApiProperty({ example: 2, description: 'Chiptalar soni' })
  @IsInt()
  @Min(1)
  @Max(5)
  quantity!: number;
}

export class CreateOrderDto {
  @ApiProperty({
    example: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
    description: 'Seans ID',
  })
  @IsUUID()
  @IsNotEmpty()
  sessionId!: string;

  @ApiPropertyOptional({
    type: [String],
    description: "SEATED seans uchun: o'rindiqlar ID lari (ko'pi bilan 5 ta)",
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  seatIds?: string[];

  @ApiPropertyOptional({
    type: [GeneralOrderItemDto],
    description: 'GENERAL seans uchun: kategoriya va soni',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => GeneralOrderItemDto)
  items?: GeneralOrderItemDto[];
}
