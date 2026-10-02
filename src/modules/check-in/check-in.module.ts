import { Module } from '@nestjs/common';
import { CheckInController } from './check-in.controller';
import { ControllerEventController } from './controller-event.controller';
import { CheckInService } from './check-in.service';
import { ControllerEventService } from './controller-event.service';

@Module({
  controllers: [ControllerEventController, CheckInController],
  providers: [ControllerEventService, CheckInService],
})
export class CheckInModule {}
