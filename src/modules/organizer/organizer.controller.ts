import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guard/jwt-auth.guard';
import { UserId } from '../../common/decorator/current-user.decorator';
import { RolesGuard } from '../../common/guard/roles.guard';
import { Role } from '../../common/enum';
import { CreateControllerDto } from './dto/create-controller.dto';
import { AccessRoles } from '../../common/decorator/roles.decorator';
import { OrganizerService } from './organizer.service';

@UseGuards(AuthGuard)
@Controller('organizer')
export class OrganizerController {
  constructor(private readonly organizerService: OrganizerService) {}
  @UseGuards(RolesGuard)
  @AccessRoles(Role.ORGANIZER)
  @Post('createcontroller')
  createController(
    @UserId() organizerId: string,
    @Body() createControllerDto: CreateControllerDto,
  ) {
    return this.organizerService.createController(
      organizerId,
      createControllerDto,
    );
  }

  @UseGuards(RolesGuard)
  @AccessRoles(Role.ORGANIZER)
  @Get('mycontrollers')
  getControllers(@UserId() organizerId: string) {
    return this.organizerService.getControllers(organizerId);
  }

  @UseGuards(RolesGuard)
  @AccessRoles(Role.ORGANIZER)
  @Delete(':id')
  deleteController(
    @UserId() organizerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.organizerService.deleteController(organizerId, id);
  }
}
