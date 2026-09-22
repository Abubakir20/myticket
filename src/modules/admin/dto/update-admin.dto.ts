import { PartialType } from '@nestjs/swagger';
import { CreateAdminDto } from './create-admin.dto';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { UserStatus } from '../../../../generated/prisma/enums';

export class UpdateAdminDto extends PartialType(CreateAdminDto) {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;
}
