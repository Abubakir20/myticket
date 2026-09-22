import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { DeviceController } from "./device.controller";
import { EmailOtpModule } from "../mail/mail-otp.module";
import { AuthService } from "./auth.service";
import { DeviceService } from "./device.service";

@Module({
    imports: [EmailOtpModule],
    controllers: [AuthController, DeviceController],
    providers: [AuthService, DeviceService]
})

export class AuthModule {}