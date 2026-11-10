import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import {
  AdminEventQueryDto,
  PaginationQueryDto,
  RejectEventDto,
} from './dto/event-query.dto';
import { AuthGuard } from '../../common/guard/jwt-auth.guard';
import { RolesGuard } from '../../common/guard/roles.guard';
import { AccessRoles } from '../../common/decorator/roles.decorator';
import { UserId } from '../../common/decorator/current-user.decorator';
import { UserRole } from '../../common/decorator/user-role.decorator';
import { Role } from '../../common/enum';
import {
  eventImageMulterOptions,
  MAX_GALLERY_FILES,
} from '../../config/upload/event-image.upload';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @AccessRoles(Role.ORGANIZER)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('poster', eventImageMulterOptions))
  create(
    @UserId() organizerId: string,
    @Body() dto: CreateEventDto,
    @UploadedFile() poster?: Express.Multer.File,
  ) {
    return this.eventsService.create(organizerId, dto, poster);
  }

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.eventsService.findAll(query);
  }

  // 'my' route ':id' dan oldin turishi kerak
  @Get('my')
  @UseGuards(AuthGuard, RolesGuard)
  @AccessRoles(Role.ORGANIZER)
  findMy(@UserId() organizerId: string) {
    return this.eventsService.findMy(organizerId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @AccessRoles(Role.ORGANIZER)
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(FileInterceptor('poster', eventImageMulterOptions))
  update(
    @UserId() organizerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
    @UploadedFile() poster?: Express.Multer.File,
  ) {
    return this.eventsService.update(organizerId, id, dto, poster);
  }

  @Post(':id/images')
  @UseGuards(AuthGuard, RolesGuard)
  @AccessRoles(Role.ORGANIZER)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: `Ko'pi bilan ${MAX_GALLERY_FILES} ta rasm`,
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('images', MAX_GALLERY_FILES, eventImageMulterOptions),
  )
  addImages(
    @UserId() organizerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() images: Express.Multer.File[],
  ) {
    return this.eventsService.addImages(organizerId, id, images);
  }

  @Delete(':id/images/:imageId')
  @UseGuards(AuthGuard, RolesGuard)
  @AccessRoles(Role.ORGANIZER)
  removeImage(
    @UserId() organizerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.eventsService.removeImage(organizerId, id, imageId);
  }

  @Patch(':id/approve')
  @UseGuards(AuthGuard, RolesGuard)
  @AccessRoles(Role.ADMIN)
  approve(@UserId() adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.approve(adminId, id);
  }

  @Patch(':id/reject')
  @UseGuards(AuthGuard, RolesGuard)
  @AccessRoles(Role.ADMIN)
  reject(
    @UserId() adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectEventDto,
  ) {
    return this.eventsService.reject(adminId, id, dto.rejectReason);
  }

  @Patch(':id/cancel')
  @UseGuards(AuthGuard, RolesGuard)
  @AccessRoles(Role.ORGANIZER, Role.ADMIN)
  cancel(
    @UserId() userId: string,
    @UserRole() role: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.eventsService.cancel(userId, role, id);
  }
}

@UseGuards(AuthGuard, RolesGuard)
@AccessRoles(Role.ADMIN)
@Controller('admin/events')
export class AdminEventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  findAll(@Query() query: AdminEventQueryDto) {
    return this.eventsService.findForAdmin(query);
  }
}
