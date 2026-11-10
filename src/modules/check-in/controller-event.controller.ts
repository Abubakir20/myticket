import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ControllerEventService } from './controller-event.service';
import { CreateControllerEventDto } from './dto/create-controller-event.dto';
import { AuthGuard } from '../../common/guard/jwt-auth.guard';
import { RolesGuard } from '../../common/guard/roles.guard';
import { AccessRoles } from '../../common/decorator/roles.decorator';
import { UserId } from '../../common/decorator/current-user.decorator';
import { Role } from '../../common/enum';

@UseGuards(AuthGuard, RolesGuard)
@AccessRoles(Role.ORGANIZER)
@Controller('controller-events')
export class ControllerEventController {
  constructor(
    private readonly controllerEventService: ControllerEventService,
  ) {}

  @Post()
  create(@UserId() organizerId: string, @Body() dto: CreateControllerEventDto) {
    return this.controllerEventService.create(organizerId, dto);
  }

  @Delete(':id')
  remove(
    @UserId() organizerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.controllerEventService.remove(organizerId, id);
  }
}
