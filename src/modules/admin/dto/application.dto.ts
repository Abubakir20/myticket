import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApplicationStatus } from '../../../common/enum';

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
