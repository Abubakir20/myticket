import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { TicketService } from './ticket.service';
import { AuthGuard } from '../../common/guard/jwt-auth.guard';
import { RolesGuard } from '../../common/guard/roles.guard';
import { AccessRoles } from '../../common/decorator/roles.decorator';
import { UserId } from '../../common/decorator/current-user.decorator';
import { Role } from '../../common/enum';

@UseGuards(AuthGuard, RolesGuard)
@AccessRoles(Role.CUSTOMER)
@Controller('tickets')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Get('me')
  findMyTickets(@UserId() userId: string) {
    return this.ticketService.findMyTickets(userId);
  }

  @Get(':id')
  findOne(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.ticketService.findOne(userId, id);
  }
}
