import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { PrismaService } from '../../config/database/prisma.service';
import { Crypt } from '../../infrastructure/lib/Crypt';
import { ApplicationStatus, Role } from '../../common/enum';
import { successRes } from '../../common/helper/success-response';
import { File } from '../../infrastructure/lib/File';

@Injectable()
export class AdminService {
  constructor(private readonly db: PrismaService) {}

  async create(createAdminDto: CreateAdminDto) {
    const { email, password } = createAdminDto;
    const existsEmail = await this.db.user.findUnique({ where: { email } });
    if (existsEmail) {
      throw new ConflictException('Bunday email tizimda allaqachon mavjud');
    }
    const hashedPassword = await Crypt.hash(password);
    const admin = await this.db.user.create({
      data: { email, hashedPassword, role: Role.ADMIN },
    });
    return successRes(admin, 201);
  }

  async findAll() {
    const admins = await this.db.user.findMany({
      where: {
        role: Role.ADMIN,
      },
      select: {
        id: true,
        phone: true,
        status: true,
        fullName: true,
        imageUrl: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!admins) {
      throw new NotFoundException('Siz hali admin yaratmagansiz');
    }
    return successRes(admins);
  }

  async findOne(id: string) {
    const admin = await this.db.user.findUnique({
      where: { id },
      select: {
        id: true,
        phone: true,
        status: true,
        fullName: true,
        imageUrl: true,
      },
    });
    if (!admin) {
      throw new NotFoundException();
    }
    return successRes(admin);
  }

  async update(
    id: string,
    updateAdminDto: UpdateAdminDto,
    image?: Express.Multer.File,
  ) {
    const admin = await this.db.user.findUnique({ where: { id } });
    if (!admin) {
      throw new NotFoundException();
    }
    let hashedPassword = admin.hashedPassword;
    if (updateAdminDto.password) {
      hashedPassword = await Crypt.hash(updateAdminDto.password);
    }
    let imageUrl = admin.imageUrl;
    if (image) {
      if (imageUrl && (await File.exist(imageUrl))) {
        await File.delete(imageUrl);
      }
      imageUrl = await File.create(image);
    }
    delete updateAdminDto.password;
    await this.db.user.update({
      where: { id },
      data: { imageUrl, hashedPassword, ...updateAdminDto },
    });
    return successRes({
      message: "Admin malumolari muvafaqiyatli o'zgartirildi",
    });
  }

  async remove(id: string) {
    const admin = await this.db.user.findUnique({ where: { id } });
    if (!admin) {
      throw new NotFoundException();
    }
    if (admin.imageUrl && (await File.exist(admin.imageUrl))) {
      await File.delete(admin.imageUrl);
    }
    await this.db.user.delete({ where: { id } });
    return successRes({ message: "Admin muvafaqiyatli o'chirildi" });
  }

  async getOrgApplications() {
    const applications = await this.db.organizerApplication.findMany();
    if (!applications) {
      throw new NotFoundException("Arizalar ro'yxati bo'sh");
    }

    return successRes(applications);
  }

  async approveApplication(id: string) {
    const application = await this.db.organizerApplication.findUnique({
      where: { id },
    });

    if (!application) {
      throw new NotFoundException('Ariza topilmadi');
    }
    const userId = application.userId;

    await this.db.user.update({
      where: { id: userId },
      data: {
        role: Role.ORGANIZER,
        isVerified: true,
       },
    });

    await this.db.organizerApplication.update({
      where: { id },
      data: {
        status: ApplicationStatus.APPROVED,
      },
    });

    return successRes({ message: 'Organizator muvafaqilyatli yaratildi' });
  }

  async rejectApplication(id: string) {
    const application = await this.db.organizerApplication.findUnique({
      where: { id },
    });

    if (!application) {
      throw new NotFoundException('Ariza topilmadi');
    }

    await this.db.organizerApplication.update({
      where: { id },
      data: {
        status: ApplicationStatus.REJECTED,
      },
    });

    return successRes({ message: 'Customer rad javobini oldi' });
  }
}
