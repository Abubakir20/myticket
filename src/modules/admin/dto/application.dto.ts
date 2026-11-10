import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApplicationStatus, Role } from '../../../common/enum';

export class ApplicationQueryDto {
  @ApiPropertyOptional({
    enum: ApplicationStatus,
    example: ApplicationStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;
}

export class RejectApplicationDto {
  @ApiPropertyOptional({ example: "Kompaniya ma'lumotlari to'liq emas" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectReason?: string;
}

export class AdminUserQueryDto {
  @ApiPropertyOptional({
    example: 'ali',
    description: 'Ism, email yoki telefon',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ enum: ['new', 'tickets', 'spent'], default: 'new' })
  @IsOptional()
  @IsIn(['new', 'tickets', 'spent'])
  sort?: 'new' | 'tickets' | 'spent';

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}
