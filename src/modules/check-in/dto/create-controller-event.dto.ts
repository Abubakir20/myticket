import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateControllerEventDto {
  @ApiProperty({
    example: '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d',
    description: 'Organizer yaratgan controller ID',
  })
  @IsUUID()
  @IsNotEmpty()
  controllerId!: string;

  @ApiProperty({
    example: '6d7e8f90-1a2b-4c3d-9e4f-5a6b7c8d9e0f',
    description: 'Organizerning tadbiri ID',
  })
  @IsUUID()
  @IsNotEmpty()
  eventId!: string;
}
