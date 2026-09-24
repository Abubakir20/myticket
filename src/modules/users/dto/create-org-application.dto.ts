import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsPhoneNumber, IsString } from 'class-validator';

export class CreateORgApplicationDto {
  @ApiProperty({
    type: String,
    example: 'TopCinema',
    description: 'company name',
  })
  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @ApiProperty({
    type: String,
    example: '+998881333231',
    description: 'phone',
  })
  @IsPhoneNumber('UZ')
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({
    type: String,
    example:
      ' TopCinema bu yirik kino kompaniyasi, 2020-tildan beri faoliyat yuritadi',
    description: 'description of the company',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;
}
