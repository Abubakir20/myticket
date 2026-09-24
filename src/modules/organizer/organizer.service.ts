import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../config/database/prisma.service';
import { successRes } from '../../common/helper/success-response';
import { Crypt } from '../../infrastructure/lib/Crypt';
import { File } from '../../infrastructure/lib/File';
import { CreateControllerDto } from './dto/create-controller.dto';
import { Role, UserStatus } from '../../common/enum';

@Injectable()
export class OrganizerService {
  constructor(private readonly db: PrismaService) {}
  async createController(organizerId: string, dto: CreateControllerDto) {
    const { fullName, email, password } = dto;
    const existsEmail = await this.db.user.findUnique({ where: { email } });
    if (existsEmail) {
      throw new ConflictException('Bunday email tizimda allaqachon mavjud');
    }
    const hashedPassword = await Crypt.hash(password);
    const controller = await this.db.user.create({
      data: {
        fullName,
        email,
        hashedPassword,
        role: Role.CONTROLLER,
        createdById: organizerId,
        isVerified: true,
        status: UserStatus.ACTIVE,
      },
    });
    return successRes(controller, 201);
  }

  async getControllers(organizerId: string) {
    const constrollers = await this.db.user.findMany({
      where: { createdById: organizerId },
    });

    if (!constrollers) {
      throw new NotFoundException('Siz hali Controller yaratmagansiz');
    }

    return successRes(constrollers);
  }

  async deleteController(id: string) {
    const controller = await this.db.user.findUnique({ where: { id } });
    if (!controller) {
      throw new NotFoundException();
    }
    if (controller.imageUrl && (await File.exist(controller.imageUrl))) {
      await File.delete(controller.imageUrl);
    }
    await this.db.user.delete({ where: { id } });
    return successRes({ message: "Controller muvafaqiyatli o'chirildi" });
  }
}
