import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../config/database/prisma.service';
import { successRes } from '../../common/helper/success-response';
import { UpdateUsersDto } from './dto/update-users.dto';
import { Crypt } from '../../infrastructure/lib/Crypt';
import { File } from '../../infrastructure/lib/File';
import { Role, UserStatus } from '../../common/enum';
import { CreateORgApplicationDto } from './dto/create-org-application.dto';

@Injectable()
export class UsersService {
  constructor(private readonly db: PrismaService) {}

  async myProfile(id: string) {
    const user = await this.db.user.findUnique({ where: { id }, select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      imageUrl: true,
      role: true,
      status: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true,
      createdById: false,
    }});
    if (!user) {
      throw new NotFoundException('Bunday foydalanuvchi topilmadi');
    }
    return successRes(user);
  }

  async editMyProfile(
    id: string,
    dto: UpdateUsersDto,
    image?: Express.Multer.File,
  ) {
    const user = await this.db.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException();
    }
    let hashedPassword = user.hashedPassword;
    if (dto.password) {
      hashedPassword = await Crypt.hash(dto.password);
    }
    let imageUrl = user.imageUrl;
    if (image) {
      if (imageUrl && (await File.exist(imageUrl))) {
        await File.delete(imageUrl);
      }
      imageUrl = await File.create(image);
    }
    delete dto.password;
    await this.db.user.update({
      where: { id },
      data: { imageUrl, hashedPassword, ...dto },
    });
    return successRes({ message: "malumolar muvafaqiyatli o'zgartirildi" });
  }

  async createApplication(userId: string, dto: CreateORgApplicationDto) {
    const { companyName, phone, description } = dto;
    const existsPhone = await this.db.user.findUnique({ where: { phone } });
    if (existsPhone) {
      throw new ConflictException(
        'Bunday telefon raqam tizimda allaqachon mavjud',
      );
    }
    const application = await this.db.organizerApplication.create({
      data: {
        userId,
        companyName,
        phone,
        description,
      },
    });

    return successRes(application);
  }

  async getApplications(userId: string) {
    const applications = await this.db.organizerApplication.findMany({
      where: { userId: userId },
    });

    if (!applications) {
      throw new NotFoundException("Arizalar ro'yxati bo'sh");
    }

    return successRes(applications);
  }
}
