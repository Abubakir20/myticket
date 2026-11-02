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
import { Prisma } from '../../../generated/prisma/client';
import { AdminUserQueryDto } from './dto/application.dto';

type AdminUserRow = {
  id: string;
  fullName: string | null;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  isVerified: boolean;
  createdAt: Date;
  tickets: number;
  orders: number;
  spent: number;
  lastPurchaseAt: Date | null;
  lastActiveAt: Date | null;
};

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

  // Foydalanuvchilar ro'yxati + har biri uchun xarid statistikasi (faqat PAID buyurtmalar).
  async findUsers({
    search,
    role,
    sort = 'new',
    page,
    limit,
  }: AdminUserQueryDto) {
    const filters: Prisma.Sql[] = [];
    if (role) filters.push(Prisma.sql`u.role::text = ${role}`);
    const term = search?.trim();
    if (term) {
      const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      filters.push(
        Prisma.sql`(u.email ILIKE ${like} OR u."fullName" ILIKE ${like} OR u.phone ILIKE ${like})`,
      );
    }
    const where = filters.length
      ? Prisma.sql`WHERE ${Prisma.join(filters, ' AND ')}`
      : Prisma.empty;
    const order = {
      new: Prisma.sql`u."createdAt" DESC`,
      tickets: Prisma.sql`tickets DESC, u."createdAt" DESC`,
      spent: Prisma.sql`spent DESC, u."createdAt" DESC`,
    }[sort];

    const [items, total] = await Promise.all([
      this.db.$queryRaw<AdminUserRow[]>`
        SELECT u.id, u."fullName", u.email, u.phone, u.role::text AS role,
               u.status::text AS status, u."isVerified", u."createdAt",
               COALESCE(s.tickets, 0)::int AS tickets,
               COALESCE(s.orders, 0)::int AS orders,
               COALESCE(s.spent, 0)::float AS spent,
               s."lastPurchaseAt", d."lastActiveAt"
        FROM users u
        LEFT JOIN (
          SELECT o."userId",
                 COUNT(t.id) AS tickets,
                 COUNT(DISTINCT o.id) AS orders,
                 SUM(oi.price) AS spent,
                 MAX(COALESCE(p."paidAt", o."createdAt")) AS "lastPurchaseAt"
          FROM orders o
          JOIN order_items oi ON oi."orderId" = o.id
          LEFT JOIN tickets t ON t."orderItemId" = oi.id
          LEFT JOIN payments p ON p."orderId" = o.id
          WHERE o.status = 'PAID'
          GROUP BY o."userId"
        ) s ON s."userId" = u.id
        LEFT JOIN (
          SELECT "userId", MAX("lastActiveAt") AS "lastActiveAt"
          FROM devices GROUP BY "userId"
        ) d ON d."userId" = u.id
        ${where}
        ORDER BY ${order}
        LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      this.db.$queryRaw<{ total: number }[]>`
        SELECT COUNT(*)::int AS total FROM users u ${where}`,
    ]);
    const count = total[0]?.total ?? 0;
    return successRes({
      items,
      meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  }

  // Bitta foydalanuvchi: profil, xaridlar tarixi (har bir buyurtma va chiptalari), arizalari.
  async findUserDetail(id: string) {
    const user = await this.db.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        imageUrl: true,
        role: true,
        status: true,
        isVerified: true,
        createdAt: true,
        createdBy: { select: { fullName: true, email: true } },
        devices: {
          orderBy: { lastActiveAt: 'desc' },
          take: 3,
          select: { device: true, lastActiveAt: true, createdAt: true },
        },
        applications: {
          orderBy: { createdAt: 'desc' },
          select: { companyName: true, status: true, createdAt: true },
        },
        _count: { select: { organizedEvents: true, checkedTickets: true } },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            status: true,
            createdAt: true,
            payment: { select: { paidAt: true, status: true } },
            session: {
              select: {
                startTime: true,
                venue: { select: { name: true } },
                event: { select: { id: true, title: true, posterUrl: true } },
              },
            },
            items: {
              select: {
                price: true,
                ticketCategory: { select: { name: true } },
                seat: {
                  select: {
                    number: true,
                    row: {
                      select: {
                        number: true,
                        sector: { select: { name: true } },
                      },
                    },
                  },
                },
                ticket: { select: { status: true, usedAt: true } },
              },
            },
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }
    const { orders, ...profile } = user;
    const history = orders.map(({ items, payment, ...order }) => ({
      ...order,
      paidAt: payment?.paidAt ?? null,
      total: items.reduce((acc, item) => acc + Number(item.price), 0),
      tickets: items.map((item) => ({
        category: item.ticketCategory.name,
        price: Number(item.price),
        seat: item.seat
          ? {
              sector: item.seat.row.sector.name,
              row: item.seat.row.number,
              number: item.seat.number,
            }
          : null,
        status: item.ticket?.status ?? null,
        usedAt: item.ticket?.usedAt ?? null,
      })),
    }));
    const paid = history.filter((order) => order.status === 'PAID');
    return successRes({
      ...profile,
      summary: {
        tickets: paid.reduce((acc, order) => acc + order.tickets.length, 0),
        orders: paid.length,
        spent: paid.reduce((acc, order) => acc + order.total, 0),
        used: paid.reduce(
          (acc, order) =>
            acc + order.tickets.filter((t) => t.status === 'USED').length,
          0,
        ),
      },
      orders: history,
    });
  }
}
