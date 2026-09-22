import { Body, Controller, Post } from '@nestjs/common';
import { EmailOtpService } from './mail-otp.service';
import { SendOTPDto } from './dto/send-mail-otp.dto';
import { VerifyOTPDto } from './dto/verify-mail-otp.dto';


@Controller('otp')
export class EmailOtpController {
  constructor(private readonly otpService: EmailOtpService) {}

  @Post('send')
  send(@Body() dto: SendOTPDto) {
    return this.otpService.sendOtp(dto.email);
  }

  @Post('verify')
  verify(@Body() dto: VerifyOTPDto) {
    return this.otpService.verifyOtp(dto.email, dto.code);
  }
}