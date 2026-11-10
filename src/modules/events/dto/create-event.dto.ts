import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// multipart/form-data da hamma maydon string bo'lib keladi — sonlar @Type bilan o'giriladi
export class CreateEventDto {
  @ApiProperty({ example: 'Yulduzlar konserti' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiProperty({ example: "Yil davomidagi eng katta jonli konsert" })
  @IsString()
  @MinLength(10)
  description!: string;

  @ApiPropertyOptional({ example: 12, description: 'Yosh chegarasi (12+)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(21)
  ageLimit?: number;

  @ApiProperty({ example: 120, description: 'Davomiyligi, daqiqada' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24 * 60)
  duration!: number;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Afisha (jpg, jpeg, png, webp; ≤ 5 MB)',
  })
  poster?: unknown;
}
