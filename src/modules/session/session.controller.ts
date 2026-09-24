import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SessionService } from './session.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateTicketCategoryDto } from './dto/update-ticket-category.dto';
import { AuthGuard } from '../../common/guard/jwt-auth.guard';
import { RolesGuard } from '../../common/guard/roles.guard';
import { AccessRoles } from '../../common/decorator/roles.decorator';
import { UserId } from '../../common/decorator/current-user.decorator';
import { UserRole } from '../../common/decorator/user-role.decorator';
import { Role } from '../../common/enum';

@Controller()
export class SessionsController {
  constructor(private readonly sessionService: SessionService) {}

  @Post('events/:id/sessions')
  @UseGuards(AuthGuard, RolesGuard)
  @AccessRoles(Role.ORGANIZER)
  create(
    @UserId() organizerId: string,
    @Param('id', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateSessionDto,
  ) {
    return this.sessionService.createSession(organizerId, eventId, dto);
  }

  @Get('events/:id/sessions')
  findByEvent(@Param('id', ParseUUIDPipe) eventId: string) {
    return this.sessionService.getSessionsByEvent(eventId);
  }

  @Get('sessions/:id/seats')
  findSeats(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionService.getSessionSeats(id);
  }

  @Get('sessions/:id/categories')
  findCategories(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionService.getSessionCategories(id);
  }

  @Patch('sessions/:id/cancel')
  @UseGuards(AuthGuard, RolesGuard)
  @AccessRoles(Role.ORGANIZER, Role.ADMIN)
  cancel(
    @UserId() userId: string,
    @UserRole() role: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sessionService.cancelSession(userId, role, id);
  }

  @Patch('ticket-categories/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @AccessRoles(Role.ORGANIZER)
  updateCategory(
    @UserId() organizerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketCategoryDto,
  ) {
    return this.sessionService.updateTicketCategory(organizerId, id, dto);
  }
}
