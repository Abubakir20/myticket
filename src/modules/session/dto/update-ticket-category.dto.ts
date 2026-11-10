import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateTicketCategoryDto {
  @ApiPropertyOptional({ example: 300000, description: "Yangi narx, so'mda" })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @ApiPropertyOptional({
    example: 600,
    description: 'Faqat GENERAL: yangi chiptalar soni',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}
