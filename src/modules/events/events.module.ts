import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { AdminEventsController, EventsController } from './events.controller';
import { EventCacheService } from '../../config/redis/event-cache.service';
import { OrderModule } from '../order/order.module';

@Module({
  imports: [OrderModule],
  controllers: [EventsController, AdminEventsController],
  providers: [EventsService, EventCacheService],
})
export class EventsModule {}
