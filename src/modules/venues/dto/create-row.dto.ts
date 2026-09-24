import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class CreateRowDto {
  @ApiProperty({ example: 1, description: 'Qator raqami (sektor ichida unique)' })
  @IsInt()
  @Min(1)
  number!: number;

  @ApiProperty({
    example: 20,
    description: "Qatordagi o'rindiqlar soni — 1 dan N gacha avtomatik yaratiladi",
  })
  @IsInt()
  @Min(1)
  @Max(200)
  seatsCount!: number;
}
