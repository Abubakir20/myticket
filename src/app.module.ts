import { Module } from '@nestjs/common';
import { PrismaModule } from './config/database/prisma.module';
import { AdminModule } from './modules/admin/admin.module';
import { EmailOtpModule } from './modules/mail/mail-otp.module';
import { AuthModule } from './modules/auth/auth.module';
import { VenuesModule } from './modules/venues/venues.module';
import { EventsModule } from './modules/events/events.module';
import { UsersController } from './modules/users/users.controller';
import { OrganizerModule } from './modules/organizer/organizer.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    PrismaModule,
    AdminModule,
    AuthModule,
    EmailOtpModule,
    VenuesModule,
    EventsModule,
    UsersModule,
    OrganizerModule
  ],
})
export class AppModule {}
