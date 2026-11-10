import { Module } from '@nestjs/common';
import { OrganizerService } from './organizer.service';
import { OrganizerController } from './organizer.controller';

@Module({
  controllers: [OrganizerController],
  providers: [OrganizerService],
})
export class OrganizerModule {}
