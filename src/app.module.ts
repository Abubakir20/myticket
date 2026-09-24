import { Module } from '@nestjs/common';
import { PrismaModule } from './config/database/prisma.module';
import { RedisModule } from './config/redis/redis.module';
import { AdminModule } from './modules/admin/admin.module';
import { EmailOtpModule } from './modules/mail/mail-otp.module';
import { AuthModule } from './modules/auth/auth.module';
import { VenuesModule } from './modules/venues/venues.module';
import { EventsModule } from './modules/events/events.module';
import { SessionModule } from './modules/session/session.module';
import { OrganizerModule } from './modules/organizer/organizer.module';
import { UsersModule } from './modules/users/users.module';
import { OrderModule } from './modules/order/order.module';
import { PaymentModule } from './modules/payment/payment.module';
import { TicketModule } from './modules/ticket/ticket.module';
import { CheckInModule } from './modules/check-in/check-in.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    // EventsModule AdminModule dan oldin turishi kerak: aks holda GET /admin/events
    // so'rovini AdminController'dagi GET /admin/:id ushlab oladi
    VenuesModule,
    EventsModule,
    SessionModule,
    AdminModule,
    AuthModule,
    EmailOtpModule,
    UsersModule,
    OrganizerModule,
    OrderModule,
    PaymentModule,
    TicketModule,
    CheckInModule,
  ],
})
export class AppModule {}
