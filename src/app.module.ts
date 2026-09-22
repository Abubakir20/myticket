import { Module } from '@nestjs/common';
import { PrismaModule } from './config/database/prisma.module';
import { AdminModule } from './modules/admin/admin.module';
import { EmailOtpModule } from './modules/mail/mail-otp.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    AdminModule,
    AuthModule,
    EmailOtpModule,
  ]
})
export class AppModule {}
