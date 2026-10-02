import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../config/database/prisma.service';
import { RedisService } from '../../config/redis/redis.service';
import { EventCacheService } from '../../config/redis/event-cache.service';
import { successRes } from '../../common/helper/success-response';
import { seatHoldKey } from '../../common/helper/redis-keys';
import { Role } from '../../common/enum';
import {
  EventStatus,
  OrderStatus,
  SeatingType,
  SessionStatus,
  TicketStatus,
} from '../../../generated/prisma/enums';
import { OrderService } from '../order/order.service';
import {
  CreateSessionDto,
  CreateTicketCategoryDto,
} from './dto/create-session.dto';
import { UpdateTicketCategoryDto } from './dto/update-ticket-category.dto';

type SeatStatus = 'FREE' | 'HELD' | 'SOLD';

@Injectable()
export class SessionService {
  constructor(
    private readonly db: PrismaService,
    private readonly redis: RedisService,
    private readonly cache: EventCacheService,
    private readonly orderService: OrderService,
  ) {}

  // TZ 3.7: venueId, startTime, seatingType + kategoriyalar.
  // SEATED da har bir sektorga faqat bitta kategoriya (takrorlansa 409).
  async createSession(
    organizerId: string,
    eventId: string,
    dto: CreateSessionDto,
  ) {
    const event = await this.db.event.findFirst({
      where: { id: eventId, organizerId },
    });
    if (!event) {
      throw new NotFoundException('Tadbir topilmadi');
    }
    if (event.status === EventStatus.CANCELLED) {
      throw new BadRequestException("Bekor qilingan tadbirga seans qo'shib bo'lmaydi");
    }

    const startTime = new Date(dto.startTime);
    if (startTime <= new Date()) {
      throw new BadRequestException("Seans vaqti kelajakda bo'lishi kerak");
    }

    const venue = await this.db.venue.findUnique({
      where: { id: dto.venueId },
    });
    if (!venue || !venue.isActive) {
      throw new NotFoundException('Zal topilmadi yoki faol emas');
    }

    if (dto.seatingType === SeatingType.SEATED) {
      await this.validateSeatedCategories(dto.venueId, dto.categories);
    } else {
      this.validateGeneralCategories(dto.categories);
    }

    await this.ensureVenueIsFree(dto.venueId, startTime, event.duration);

    const session = await this.db.session.create({
      data: {
        eventId,
        venueId: dto.venueId,
        startTime,
        seatingType: dto.seatingType,
        ticketCategories: {
          create: dto.categories.map((category) => ({
            name: category.name,
            price: category.price,
            sectorId:
              dto.seatingType === SeatingType.SEATED ? category.sectorId : null,
            quantity:
              dto.seatingType === SeatingType.GENERAL ? category.quantity : null,
          })),
        },
      },
      include: { ticketCategories: true },
    });
    await this.cache.clear();
    return successRes(session, 201);
  }

  // Public: tasdiqlangan tadbirning faol seanslari
  async getSessionsByEvent(eventId: string) {
    const event = await this.db.event.findFirst({
      where: { id: eventId, status: EventStatus.APPROVED },
      select: { id: true },
    });
    if (!event) {
      throw new NotFoundException('Tadbir topilmadi');
    }
    const sessions = await this.db.session.findMany({
      where: { eventId, status: SessionStatus.ACTIVE },
      orderBy: { startTime: 'asc' },
      include: {
        venue: { select: { id: true, name: true, address: true } },
        ticketCategories: {
          select: { id: true, name: true, price: true, sectorId: true },
        },
      },
    });
    return successRes(sessions);
  }

  // TZ 5-bo'lim: SOLD — tickets dan, HELD — Redis'dagi seat-hold kalitlaridan.
  // Muddati o'tgan band TTL bilan o'zi o'chadi, shuning uchun HELD doim aniq.
  async getSessionSeats(sessionId: string) {
    const session = await this.findPublicSession(sessionId);
    if (session.seatingType !== SeatingType.SEATED) {
      throw new BadRequestException(
        "Bu seans o'rindiqsiz (GENERAL) — /sessions/:id/categories dan foydalaning",
      );
    }

    const categories = await this.db.ticketCategory.findMany({
      where: { sessionId },
      select: { id: true, name: true, price: true, sectorId: true },
    });
    const categoryBySector = new Map(
      categories.map((category) => [category.sectorId, category]),
    );

    // Faqat kategoriyasi bor (ya'ni sotuvdagi) sektorlar ko'rsatiladi
    const sectors = await this.db.sector.findMany({
      where: {
        venueId: session.venueId,
        id: { in: [...categoryBySector.keys()].filter((id) => id !== null) },
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        rows: {
          orderBy: { number: 'asc' },
          select: {
            number: true,
            seats: {
              orderBy: { number: 'asc' },
              select: { id: true, number: true },
            },
          },
        },
      },
    });

    const soldTickets = await this.db.ticket.findMany({
      where: { sessionId, status: { not: TicketStatus.CANCELLED } },
      select: { seatId: true },
    });
    const soldSeatIds = new Set(soldTickets.map((ticket) => ticket.seatId));

    const allSeatIds = sectors.flatMap((sector) =>
      sector.rows.flatMap((row) => row.seats.map((seat) => seat.id)),
    );
    const heldSeatIds = new Set<string>();
    if (allSeatIds.length) {
      const holds = await this.redis.client.mget(
        allSeatIds.map((seatId) => seatHoldKey(sessionId, seatId)),
      );
      holds.forEach((orderId, i) => {
        if (orderId) heldSeatIds.add(allSeatIds[i]);
      });
    }

    const statusOf = (seatId: string): SeatStatus =>
      soldSeatIds.has(seatId)
        ? 'SOLD'
        : heldSeatIds.has(seatId)
          ? 'HELD'
          : 'FREE';

    const data = sectors.map((sector) => {
      const category = categoryBySector.get(sector.id)!;
      return {
        sectorId: sector.id,
        sectorName: sector.name,
        ticketCategoryId: category.id,
        categoryName: category.name,
        price: category.price,
        rows: sector.rows.map((row) => ({
          number: row.number,
          seats: row.seats.map((seat) => ({
            seatId: seat.id,
            number: seat.number,
            status: statusOf(seat.id),
          })),
        })),
      };
    });
    return successRes({ sessionId, sectors: data });
  }

  // GENERAL: qolgan soni = quantity − soldCount − PENDING (muddati o'tmagan) buyurtmalardagi soni
  async getSessionCategories(sessionId: string) {
    const session = await this.findPublicSession(sessionId);
    const categories = await this.db.ticketCategory.findMany({
      where: { sessionId },
      orderBy: { price: 'desc' },
      include: { sector: { select: { name: true } } },
    });

    if (session.seatingType === SeatingType.SEATED) {
      return successRes(
        categories.map((category) => ({
          id: category.id,
          name: category.name,
          price: category.price,
          sectorId: category.sectorId,
          sectorName: category.sector?.name ?? null,
        })),
      );
    }

    const pending = await this.db.orderItem.groupBy({
      by: ['ticketCategoryId'],
      where: {
        ticketCategory: { sessionId },
        order: { status: OrderStatus.PENDING, expiresAt: { gt: new Date() } },
      },
      _count: { _all: true },
    });
    const pendingByCategory = new Map(
      pending.map((item) => [item.ticketCategoryId, item._count._all]),
    );

    return successRes(
      categories.map((category) => ({
        id: category.id,
        name: category.name,
        price: category.price,
        quantity: category.quantity,
        remaining: Math.max(
          (category.quantity ?? 0) -
            category.soldCount -
            (pendingByCategory.get(category.id) ?? 0),
          0,
        ),
      })),
    );
  }

  // Narx yoki sonni faqat sotuv boshlanmagan bo'lsa o'zgartirish mumkin
  async updateTicketCategory(
    organizerId: string,
    categoryId: string,
    dto: UpdateTicketCategoryDto,
  ) {
    if (dto.price === undefined && dto.quantity === undefined) {
      throw new BadRequestException('price yoki quantity yuborilishi kerak');
    }
    const category = await this.db.ticketCategory.findFirst({
      where: { id: categoryId, session: { event: { organizerId } } },
      include: { session: { select: { status: true, seatingType: true } } },
    });
    if (!category) {
      throw new NotFoundException('Kategoriya topilmadi');
    }
    if (category.session.status !== SessionStatus.ACTIVE) {
      throw new BadRequestException('Seans bekor qilingan');
    }
    if (
      dto.quantity !== undefined &&
      category.session.seatingType === SeatingType.SEATED
    ) {
      throw new BadRequestException(
        "SEATED seansda son o'rindiqlar bilan belgilanadi, quantity o'zgartirilmaydi",
      );
    }

    const salesStarted = await this.db.orderItem.count({
      where: { ticketCategoryId: categoryId },
    });
    if (salesStarted > 0) {
      throw new ConflictException(
        "Sotuv boshlangan — narx yoki sonni o'zgartirib bo'lmaydi",
      );
    }

    const updated = await this.db.ticketCategory.update({
      where: { id: categoryId },
      data: { price: dto.price, quantity: dto.quantity },
    });
    await this.cache.clear();
    return successRes(updated);
  }

  // TZ 4.5: seans CANCELLED bo'lsa, ACTIVE chiptalar va PENDING buyurtmalar ham CANCELLED.
  // ORGANIZER faqat o'z seansini, ADMIN istalganini bekor qiladi.
  async cancelSession(userId: string, role: string, sessionId: string) {
    const isAdmin = role === Role.ADMIN || role === Role.SUPERADMIN;
    const session = await this.db.session.findFirst({
      where: isAdmin
        ? { id: sessionId }
        : { id: sessionId, event: { organizerId: userId } },
    });
    if (!session) {
      throw new NotFoundException('Seans topilmadi');
    }

    const updated = await this.db.session.updateMany({
      where: { id: sessionId, status: SessionStatus.ACTIVE },
      data: { status: SessionStatus.CANCELLED },
    });
    if (updated.count === 0) {
      throw new BadRequestException('Seans allaqachon bekor qilingan');
    }
    await this.orderService.cancelSessionSales(sessionId);
    await this.cache.clear();
    return successRes({ id: sessionId, status: SessionStatus.CANCELLED });
  }

  private async findPublicSession(sessionId: string) {
    const session = await this.db.session.findFirst({
      where: { id: sessionId, event: { status: EventStatus.APPROVED } },
    });
    if (!session) {
      throw new NotFoundException('Seans topilmadi');
    }
    return session;
  }

  private async validateSeatedCategories(
    venueId: string,
    categories: CreateTicketCategoryDto[],
  ) {
    const sectorIds = categories.map((category) => category.sectorId);
    if (sectorIds.some((id) => !id)) {
      throw new BadRequestException(
        'SEATED seansda har bir kategoriyaga sectorId berilishi kerak',
      );
    }
    if (categories.some((category) => category.quantity !== undefined)) {
      throw new BadRequestException(
        "SEATED seansda quantity yuborilmaydi — son o'rindiqlar bilan belgilanadi",
      );
    }
    if (new Set(sectorIds).size !== sectorIds.length) {
      throw new ConflictException(
        'SEATED seansda har bir sektorga faqat bitta kategoriya biriktiriladi',
      );
    }
    const sectorsCount = await this.db.sector.count({
      where: { id: { in: sectorIds as string[] }, venueId },
    });
    if (sectorsCount !== sectorIds.length) {
      throw new BadRequestException('Sektorlar shu zalga tegishli emas');
    }
  }

  private validateGeneralCategories(categories: CreateTicketCategoryDto[]) {
    if (categories.some((category) => category.sectorId)) {
      throw new BadRequestException('GENERAL seansda sectorId yuborilmaydi');
    }
    if (categories.some((category) => !category.quantity)) {
      throw new BadRequestException(
        'GENERAL seansda har bir kategoriyaga quantity berilishi kerak',
      );
    }
  }

  // Bitta zalda vaqti ustma-ust tushadigan ikkita faol seans bo'lmasligi kerak:
  // [start, start + duration) oraliqlari kesishsa — 409
  private async ensureVenueIsFree(
    venueId: string,
    startTime: Date,
    durationMinutes: number,
  ) {
    const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);
    const earlierSessions = await this.db.session.findMany({
      where: {
        venueId,
        status: SessionStatus.ACTIVE,
        startTime: { lt: endTime },
      },
      select: { startTime: true, event: { select: { duration: true } } },
    });
    const overlaps = earlierSessions.some(
      (session) =>
        session.startTime.getTime() + session.event.duration * 60_000 >
        startTime.getTime(),
    );
    if (overlaps) {
      throw new ConflictException('Bu vaqtda zal boshqa seans bilan band');
    }
  }
}
