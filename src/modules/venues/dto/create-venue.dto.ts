import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateVenueDto {
  @ApiProperty({example: 'SaidCinema'})
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiProperty({example: 'Yer sayyorasi'})
  @IsString()
  @MinLength(5)
  address!: string;

  @ApiProperty({example: 'SaidCinema bittalani bittasi'})
  @IsString()
  @MinLength(5)
  description!: string;
}
