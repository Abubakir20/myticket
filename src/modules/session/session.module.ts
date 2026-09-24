import { Module } from '@nestjs/common';
import { SessionsController } from './session.controller';
import { SessionService } from './session.service';
import { EventCacheService } from '../../config/redis/event-cache.service';
import { OrderModule } from '../order/order.module';

@Module({
  imports: [OrderModule],
  controllers: [SessionsController],
  providers: [SessionService, EventCacheService],
  exports: [SessionService],
})
export class SessionModule {}
