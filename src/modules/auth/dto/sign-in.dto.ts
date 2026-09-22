import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsStrongPassword } from "class-validator";

export class SignInDto {
    @ApiProperty({
        type: String,
        example: "superadmin@example",
        description: "Superadmin email"
    })
    @IsEmail()
    @IsNotEmpty()
    email!: string;

    @ApiProperty({
        type: String,
        example: "Superadmin1",
        description: "Superadmin password"
    })
    @IsStrongPassword()
    @IsNotEmpty()
    password!: string;
}