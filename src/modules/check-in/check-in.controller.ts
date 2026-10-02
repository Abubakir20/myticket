import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CheckInService } from './check-in.service';
import { CheckInDto } from './dto/check-in.dto';
import { AuthGuard } from '../../common/guard/jwt-auth.guard';
import { RolesGuard } from '../../common/guard/roles.guard';
import { AccessRoles } from '../../common/decorator/roles.decorator';
import { UserId } from '../../common/decorator/current-user.decorator';
import { Role } from '../../common/enum';

@UseGuards(AuthGuard, RolesGuard)
@AccessRoles(Role.CONTROLLER)
@Controller('check-in')
export class CheckInController {
  constructor(private readonly checkInService: CheckInService) {}

  @Get('events')
  findMyEvents(@UserId() controllerId: string) {
    return this.checkInService.findMyEvents(controllerId);
  }

  @Post()
  checkIn(@UserId() controllerId: string, @Body() dto: CheckInDto) {
    return this.checkInService.checkIn(controllerId, dto);
  }
}
