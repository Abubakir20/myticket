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

// Parol xeshi hech qachon javobga chiqmaydi
const CONTROLLER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
} as const;

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
      select: CONTROLLER_SELECT,
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
    const controllers = await this.db.user.findMany({
      where: { createdById: organizerId, role: Role.CONTROLLER },
      orderBy: { createdAt: 'desc' },
      select: {
        ...CONTROLLER_SELECT,
        controllerEvents: {
          select: { id: true, event: { select: { id: true, title: true } } },
        },
        _count: { select: { checkedTickets: true } },
      },
    });
    return successRes(controllers);
  }

  // Faqat o'zi yaratgan kontrollerni o'chira oladi
  async deleteController(organizerId: string, id: string) {
    const controller = await this.db.user.findFirst({
      where: { id, createdById: organizerId, role: Role.CONTROLLER },
    });
    if (!controller) {
      throw new NotFoundException('Kontroller topilmadi');
    }
    if (controller.imageUrl && (await File.exist(controller.imageUrl))) {
      await File.delete(controller.imageUrl);
    }
    await this.db.user.delete({ where: { id } });
    return successRes({ message: "Kontroller muvaffaqiyatli o'chirildi" });
  }
}
