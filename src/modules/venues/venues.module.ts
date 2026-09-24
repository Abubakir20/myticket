import { Module } from '@nestjs/common';
import { VenuesService } from './venues.service';
import {
  RowsController,
  SectorsController,
  VenuesController,
} from './venues.controller';

@Module({
  controllers: [VenuesController, SectorsController, RowsController],
  providers: [VenuesService],
})
export class VenuesModule {}
