import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { VenuesService } from './venues.service';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { CreateRowDto } from './dto/create-row.dto';

import { AuthGuard } from '../../common/guard/jwt-auth.guard';
import { RolesGuard } from '../../common/guard/roles.guard';
import { AccessRoles } from '../../common/decorator/roles.decorator';
import { CreateSectorDto } from './dto/create-sector.dto';
import { CreatESeatsDto } from './dto/create-seats.dto';

@Controller('venues')
@UseGuards(AuthGuard, RolesGuard)
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Post()
  @AccessRoles('admin')
  create(@Body() createVenueDto: CreateVenueDto) {
    return this.venuesService.create(createVenueDto);
  }

  @Get()
  @AccessRoles('admin', 'organizer')
  findAll() {
    return this.venuesService.findAll();
  }

  @Get(':id')
  @AccessRoles('admin', 'organizer')
  findOne(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () =>
          new BadRequestException(
            "ID noto'g'ri kiritildi! U UUID v4 formatida bo'lishi shart.",
          ),
      }),
    )
    id: string,
  ) {
    return this.venuesService.findOne(id);
  }

  @Patch(':id')
  @AccessRoles('admin')
  update(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () =>
          new BadRequestException(
            "ID noto'g'ri kiritildi! U UUID v4 formatida bo'lishi shart.",
          ),
      }),
    )
    id: string,
    @Body() updateVenueDto: UpdateVenueDto,
  ) {
    return this.venuesService.update(id, updateVenueDto);
  }

  @Post(':id/sectors')
  @AccessRoles('admin')
  async createSector(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () =>
          new BadRequestException(
            "ID noto'g'ri kiritildi! Venue ID qiymati UUID v4 bo'lishi shart.",
          ),
      }),
    )
    venueId: string,
    @Body() createSectorDto: CreateSectorDto,
  ) {
    return this.venuesService.createSector(venueId, createSectorDto);
  }

  @Post('/sectors/:id/rows')
  @AccessRoles('admin')
  async createRow(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () =>
          new BadRequestException(
            "ID noto'g'ri kiritildi! sector ID qiymati UUID v4 bo'lishi shart.",
          ),
      }),
    )
    sectorId: string,
    @Body() createRowDto: CreateRowDto,
  ) {
    return this.venuesService.createRow(sectorId, createRowDto);
  }

  @Post('/sectors/rows/:id/seats')
  @AccessRoles('admin')
  async createSeats(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () => new BadRequestException(
          "ID notog'ri kiritildi!"
        ),
      }),
    )
    rowId: string,
    @Body() createSeatsDto: CreatESeatsDto,
  ) {
    return this.venuesService.createSeats(rowId, createSeatsDto)
  }

  @Delete(':id')
  @AccessRoles('admin')
  async remove(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () =>
          new BadRequestException(
            "ID noto'g'ri kiritildi! U UUID v4 formatida bo'lishi shart.",
          ),
      }),
    )
    id: string,
  ) {
    return this.venuesService.remove(id);
  }
}
