import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CheckInDto {
  @ApiProperty({
    example: 'c0ffee00-1234-4abc-9def-001122334455',
    description: 'Chiptadagi QR kod qiymati',
  })
  @IsUUID()
  @IsNotEmpty()
  qrCode!: string;
}
