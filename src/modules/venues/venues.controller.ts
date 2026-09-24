import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { VenuesService } from './venues.service';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { CreateSectorDto } from './dto/create-sector.dto';
import { CreateRowDto } from './dto/create-row.dto';
import { AuthGuard } from '../../common/guard/jwt-auth.guard';
import { RolesGuard } from '../../common/guard/roles.guard';
import { AccessRoles } from '../../common/decorator/roles.decorator';
import { UserId } from '../../common/decorator/current-user.decorator';
import { Role } from '../../common/enum';

@UseGuards(AuthGuard, RolesGuard)
@Controller('venues')
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Post()
  @AccessRoles(Role.ADMIN)
  create(@UserId() adminId: string, @Body() dto: CreateVenueDto) {
    return this.venuesService.create(adminId, dto);
  }

  @Get()
  @AccessRoles(Role.ADMIN, Role.ORGANIZER)
  findAll() {
    return this.venuesService.findAll();
  }

  @Get(':id')
  @AccessRoles(Role.ADMIN, Role.ORGANIZER)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.venuesService.findOne(id);
  }

  @Patch(':id')
  @AccessRoles(Role.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVenueDto,
  ) {
    return this.venuesService.update(id, dto);
  }

  @Delete(':id')
  @AccessRoles(Role.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.venuesService.remove(id);
  }

  @Post(':id/sectors')
  @AccessRoles(Role.ADMIN)
  createSector(
    @Param('id', ParseUUIDPipe) venueId: string,
    @Body() dto: CreateSectorDto,
  ) {
    return this.venuesService.createSector(venueId, dto);
  }
}

@UseGuards(AuthGuard, RolesGuard)
@AccessRoles(Role.ADMIN)
@Controller('sectors')
export class SectorsController {
  constructor(private readonly venuesService: VenuesService) {}

  @Post(':id/rows')
  createRow(
    @Param('id', ParseUUIDPipe) sectorId: string,
    @Body() dto: CreateRowDto,
  ) {
    return this.venuesService.createRow(sectorId, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.venuesService.removeSector(id);
  }
}

@UseGuards(AuthGuard, RolesGuard)
@AccessRoles(Role.ADMIN)
@Controller('rows')
export class RowsController {
  constructor(private readonly venuesService: VenuesService) {}

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.venuesService.removeRow(id);
  }
}
