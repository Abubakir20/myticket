import { Module } from '@nestjs/common';
import { EmailOtpController } from './mail-otp.controller';
import { EmailOtpService } from './mail-otp.service';
import { MailerModule } from '@nestjs-modules/mailer';
import { env } from '../../config';
import { RedisModule } from '../../config/redis/redis.module';

@Module({
  imports: [
    RedisModule, 
    
    MailerModule.forRoot({
      transport: {
        host: env.SMTP.HOST,
        port: env.SMTP.PORT,
        auth: {
          user: env.SMTP.FROM,
          pass: env.SMTP.PASSWORD,
        },
      },
      defaults: {
        from: env.SMTP.FROM,
      },
    }),
  ],
  controllers: [EmailOtpController],
  providers: [EmailOtpService],
  exports: [EmailOtpService],
})
export class EmailOtpModule {}
