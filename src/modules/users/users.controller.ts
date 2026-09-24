import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../../common/guard/jwt-auth.guard';
import { UserId } from '../../common/decorator/current-user.decorator';
import { ImageValidationPipe } from '../../common/pipe/image-validation.pipe';
import { UpdateUsersDto } from './dto/update-users.dto';
import { CreateORgApplicationDto } from './dto/create-org-application.dto';

@UseGuards(AuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  myProfile(@UserId() userId: string) {
    return this.usersService.myProfile(userId);
  }

  @Patch('me')
  editMyProfile(
    @UserId() userId: string,
    @Body() updateusersDto: UpdateUsersDto,
    @UploadedFile(new ImageValidationPipe()) image?: Express.Multer.File,
  ) {
    return this.usersService.editMyProfile(userId, updateusersDto, image);
  }

  @Post('organizer-applications')
  createApplication(
    @UserId() userId: string,
    @Body() createApplicationDto: CreateORgApplicationDto,
  ) {
    return this.usersService.createApplication(userId, createApplicationDto);
  }

  @Get('organizer-applications/me')
  getApplications(@UserId() userId: string) {
    return this.usersService.getApplications(userId);
  }
}
