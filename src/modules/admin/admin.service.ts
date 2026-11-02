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
    return successRes({ message: "Admin muvaffaqiyatli o'chirildi" });
  }

  async getOrgApplications(status?: ApplicationStatus) {
    const applications = await this.db.organizerApplication.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, fullName: true, email: true, role: true } },
      },
    });
    return successRes(applications);
  }

  // Faqat PENDING ariza ko'rib chiqiladi; status sharti ikki admin bir vaqtda
  // bossa ham faqat bittasini o'tkazadi.
  private async reviewApplication(
    adminId: string,
    id: string,
    status: ApplicationStatus,
    rejectReason: string | null,
  ) {
    const application = await this.db.organizerApplication.findUnique({
      where: { id },
      include: { user: { select: { role: true } } },
    });
    if (!application) {
      throw new NotFoundException('Ariza topilmadi');
    }
    if (application.status !== ApplicationStatus.PENDING) {
      throw new ConflictException("Bu ariza allaqachon ko'rib chiqilgan");
    }

    const promoteUser =
      status === ApplicationStatus.APPROVED &&
      application.user.role === Role.CUSTOMER;

    await this.db.$transaction(async (tx) => {
      const { count } = await tx.organizerApplication.updateMany({
        where: { id, status: ApplicationStatus.PENDING },
        data: {
          status,
          rejectReason,
          reviewedById: adminId,
          reviewedAt: new Date(),
        },
      });
      if (!count) {
        throw new ConflictException("Bu ariza allaqachon ko'rib chiqilgan");
      }
      if (promoteUser) {
        await tx.user.update({
          where: { id: application.userId },
          data: { role: Role.ORGANIZER, isVerified: true },
        });
      }
    });
  }

  async approveApplication(adminId: string, id: string) {
    await this.reviewApplication(adminId, id, ApplicationStatus.APPROVED, null);
    return successRes({
      id,
      status: ApplicationStatus.APPROVED,
      message: 'Organizator muvaffaqiyatli yaratildi',
    });
  }

  async rejectApplication(adminId: string, id: string, rejectReason?: string) {
    await this.reviewApplication(
      adminId,
      id,
      ApplicationStatus.REJECTED,
      rejectReason?.trim() || null,
    );
    return successRes({
      id,
      status: ApplicationStatus.REJECTED,
      message: 'Arizaga rad javobi berildi',
    });
  }

  async stats() {
    const [users, events, applications, orders, tickets, revenue] =
      await Promise.all([
        this.db.user.groupBy({ by: ['role'], _count: { _all: true } }),
        this.db.event.groupBy({ by: ['status'], _count: { _all: true } }),
        this.db.organizerApplication.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
        this.db.order.groupBy({ by: ['status'], _count: { _all: true } }),
        this.db.ticket.groupBy({ by: ['status'], _count: { _all: true } }),
        this.db.orderItem.aggregate({
          where: { order: { status: 'PAID' } },
          _sum: { price: true },
        }),
      ]);

    const toMap = <K extends string>(
      rows: { _count: { _all: number } }[],
      key: K,
    ) =>
      Object.fromEntries(
        rows.map((row) => [
          (row as unknown as Record<K, string>)[key],
          row._count._all,
        ]),
      ) as Record<string, number>;

    return successRes({
      users: toMap(users, 'role'),
      events: toMap(events, 'status'),
      applications: toMap(applications, 'status'),
      orders: toMap(orders, 'status'),
      tickets: toMap(tickets, 'status'),
      revenue: Number(revenue._sum.price ?? 0),
    });
  }
}
