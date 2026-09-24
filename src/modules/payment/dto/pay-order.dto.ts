import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class PayOrderDto {
  @ApiProperty({
    example: true,
    description:
      "Mock to'lov natijasi: false bo'lsa to'lov muvaffaqiyatsiz bo'ladi",
  })
  @IsBoolean()
  success!: boolean;
}
