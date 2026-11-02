import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { AuthGuard } from '../../common/guard/jwt-auth.guard';
import { RolesGuard } from '../../common/guard/roles.guard';
import { AccessRoles } from '../../common/decorator/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImageValidationPipe } from '../../common/pipe/image-validation.pipe';
import { Role } from '../../common/enum';
import { UserId } from '../../common/decorator/current-user.decorator';
import {
  ApplicationQueryDto,
  RejectApplicationDto,
} from './dto/application.dto';

@UseGuards(AuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  create(@Body() createAdminDto: CreateAdminDto) {
    return this.adminService.create(createAdminDto);
  }

  @Get()
  findAll() {
    return this.adminService.findAll();
  }

  @AccessRoles(Role.ADMIN)
  @Get('stats')
  stats() {
    return this.adminService.stats();
  }

  @AccessRoles(Role.ADMIN)
  @Get('organizerapplications')
  getOrgApplications(@Query() query: ApplicationQueryDto) {
    return this.adminService.getOrgApplications(query.status);
  }

  @AccessRoles('ID')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminService.findOne(id);
  }

  @Patch(':id')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: {
        fileSize: 20 * 1024 * 1024,
      },
    }),
  )
  update(
    @Param('id') id: string,
    @Body() updateAdminDto: UpdateAdminDto,
    @UploadedFile(new ImageValidationPipe()) image?: Express.Multer.File,
  ) {
    return this.adminService.update(id, updateAdminDto, image);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.adminService.remove(id);
  }

  @AccessRoles(Role.ADMIN)
  @Patch(':id/approve')
  approveApplication(
    @UserId() adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.adminService.approveApplication(adminId, id);
  }

  @AccessRoles(Role.ADMIN)
  @Patch(':id/reject')
  rejectApplication(
    @UserId() adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectApplicationDto,
  ) {
    return this.adminService.rejectApplication(adminId, id, dto.rejectReason);
  }
}
