import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { EventStatus } from '../../../../generated/prisma/enums';

export class PaginationQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;
}

export class AdminEventQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: EventStatus, example: EventStatus.PENDING })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}

export class RejectEventDto {
  @ApiProperty({ example: "Afisha sifati past, qayta yuklang" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  rejectReason!: string;
}
