import { ApiProperty, PartialType } from "@nestjs/swagger";
import { SignUpDto } from "../../auth/dto/sign-up.dto";
import { IsNotEmpty, IsString, IsStrongPassword } from "class-validator";

export class UpdateUsersDto extends PartialType(SignUpDto){
    @ApiProperty({
        example: 'Second name FirsName',
        description: 'User fullName',
      })
      @IsString()
      @IsNotEmpty()
      fullName!: string;
}