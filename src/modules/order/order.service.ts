import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../config/database/prisma.service';
import { RedisService } from '../../config/redis/redis.service';
import { successRes } from '../../common/helper/success-response';
import { seatHoldKey } from '../../common/helper/redis-keys';
import { env } from '../../config';
import { Prisma } from '../../../generated/prisma/client';
import {
  EventStatus,
  OrderStatus,
  SeatingType,
  SessionStatus,
  TicketStatus,
} from '../../../generated/prisma/enums';
import { CreateOrderDto, GeneralOrderItemDto } from './dto/create-order.dto';

const MAX_TICKETS_PER_ORDER = 5;

// Kalitni faqat uning qiymati shu orderId bo'lsa o'chiradi.
// Band qilish muddati o'tgach, o'rindiqni boshqa buyurtma egallagan bo'lishi mumkin —
// oddiy DEL uning bandini ham o'chirib yuborardi.
const RELEASE_HOLD_SCRIPT = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  end
  return 0
`;

type NewOrderItem = {
  ticketCategoryId: string;
  seatId: string | null;
  price: Prisma.Decimal;
};

@Injectable()
export class OrderService {
  constructor(
    private readonly db: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async create(userId: string, dto: CreateOrderDto) {
    // 1. Seans ACTIVE, tadbir APPROVED va seans hali boshlanmagan bo'lishi kerak
    const session = await this.db.session.findUnique({
      where: { id: dto.sessionId },
      include: { event: { select: { status: true } } },
    });
    if (!session) {
      throw new NotFoundException('Seans topilmadi');
    }
    if (
      session.status !== SessionStatus.ACTIVE ||
      session.event.status !== EventStatus.APPROVED
    ) {
      throw new BadRequestException('Bu seansga chipta sotilmaydi');
    }
    if (session.startTime <= new Date()) {
      throw new BadRequestException('Seans allaqachon boshlangan');
    }

    // orderId ni oldindan yaratamiz: Redis'dagi band kalitiga qiymat sifatida kerak
    const orderId = randomUUID();
    const expiresAt = new Date(Date.now() + env.ORDER.HOLD_MINUTES * 60 * 1000);

    // 2-4. Seans turiga qarab joylar tekshiriladi
    let items: NewOrderItem[];
    let heldSeatIds: string[] = [];
    if (session.seatingType === SeatingType.SEATED) {
      if (dto.items) {
        throw new BadRequestException(
          'SEATED seans uchun faqat seatIds yuboriladi',
        );
      }
      items = await this.prepareSeatedItems(session, dto.seatIds);
      heldSeatIds = items.map((item) => item.seatId as string);
      await this.holdSeats(session.id, heldSeatIds, orderId);
    } else {
      if (dto.seatIds) {
        throw new BadRequestException(
          'GENERAL seans uchun faqat items yuboriladi',
        );
      }
      items = await this.prepareGeneralItems(session.id, dto.items);
    }

    // 5. Buyurtma va uning elementlari yaratiladi.
    // Bazaga yozishda xato bo'lsa, Redis'da qo'yilgan bandlar bo'shatiladi.
    try {
      const order = await this.db.order.create({
        data: {
          id: orderId,
          userId,
          sessionId: session.id,
          expiresAt,
          items: { create: items },
        },
        include: { items: true },
      });
      return successRes(
        {
          orderId: order.id,
          status: order.status,
          expiresAt: order.expiresAt,
          totalPrice: this.totalPrice(order.items),
          items: order.items,
        },
        201,
      );
    } catch (error) {
      await this.releaseSeatHolds(orderId, session.id, heldSeatIds);
      throw error;
    }
  }

  async findMyOrders(userId: string) {
    await this.expireOverdueOrders(userId);
    const orders = await this.db.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        session: {
          select: {
            id: true,
            startTime: true,
            event: { select: { id: true, title: true, posterUrl: true } },
            venue: { select: { name: true, address: true } },
          },
        },
        items: { select: { price: true } },
        payment: { select: { status: true, paidAt: true } },
      },
    });
    const data = orders.map(({ items, ...order }) => ({
      ...order,
      ticketsCount: items.length,
      totalPrice: this.totalPrice(items),
    }));
    return successRes(data);
  }

  async findOne(userId: string, id: string) {
    await this.expireOverdueOrders(userId);
    const order = await this.db.order.findFirst({
      where: { id, userId },
      include: {
        session: {
          select: {
            id: true,
            startTime: true,
            seatingType: true,
            event: { select: { id: true, title: true, posterUrl: true } },
            venue: { select: { name: true, address: true } },
          },
        },
        items: {
          include: {
            ticketCategory: { select: { id: true, name: true } },
            seat: {
              select: {
                number: true,
                row: {
                  select: { number: true, sector: { select: { name: true } } },
                },
              },
            },
            ticket: { select: { id: true, status: true } },
          },
        },
        payment: {
          select: { status: true, transactionId: true, paidAt: true },
        },
      },
    });
    if (!order) {
      throw new NotFoundException('Buyurtma topilmadi');
    }
    return successRes({ ...order, totalPrice: this.totalPrice(order.items) });
  }

  async cancel(userId: string, id: string) {
    const order = await this.db.order.findFirst({
      where: { id, userId },
      include: { items: { select: { seatId: true } } },
    });
    if (!order) {
      throw new NotFoundException('Buyurtma topilmadi');
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        "Faqat to'lanmagan (PENDING) buyurtmani bekor qilish mumkin",
      );
    }
    if (order.expiresAt <= new Date()) {
      await this.markExpired(order.id);
      throw new GoneException('Buyurtma muddati tugagan');
    }

    // status: PENDING sharti — shu payt to'lov ham o'tayotgan bo'lsa, ikkalasidan faqat bittasi yutadi
    const updated = await this.db.order.updateMany({
      where: { id, status: OrderStatus.PENDING },
      data: { status: OrderStatus.CANCELLED },
    });
    if (updated.count === 0) {
      throw new ConflictException(
        "Buyurtma holati o'zgargan, qayta tekshiring",
      );
    }
    await this.releaseSeatHolds(
      order.id,
      order.sessionId,
      this.seatIdsOf(order.items),
    );
    return successRes({});
  }

  // TZ 4.5: seans bekor qilinganda chaqiriladi (Sessions/Events modulidan).
  // ACTIVE chiptalar va PENDING buyurtmalar CANCELLED bo'ladi, bandlar bo'shatiladi.
  async cancelSessionSales(sessionId: string) {
    const pendingOrders = await this.db.order.findMany({
      where: { sessionId, status: OrderStatus.PENDING },
      include: { items: { select: { seatId: true } } },
    });
    await this.db.$transaction([
      this.db.ticket.updateMany({
        where: { sessionId, status: TicketStatus.ACTIVE },
        data: { status: TicketStatus.CANCELLED },
      }),
      this.db.order.updateMany({
        where: { sessionId, status: OrderStatus.PENDING },
        data: { status: OrderStatus.CANCELLED },
      }),
    ]);
    for (const order of pendingOrders) {
      await this.releaseSeatHolds(
        order.id,
        sessionId,
        this.seatIdsOf(order.items),
      );
    }
  }

  async markExpired(orderId: string) {
    await this.db.order.updateMany({
      where: { id: orderId, status: OrderStatus.PENDING },
      data: { status: OrderStatus.EXPIRED },
    });
  }

  async releaseSeatHolds(
    orderId: string,
    sessionId: string,
    seatIds: string[],
  ) {
    for (const seatId of seatIds) {
      await this.redis.client.eval(
        RELEASE_HOLD_SCRIPT,
        1,
        seatHoldKey(sessionId, seatId),
        orderId,
      );
    }
  }

  // Buyurtma summasi bazada saqlanmaydi — har safar order_items narxlari yig'indisidan hisoblanadi
  totalPrice(items: { price: Prisma.Decimal }[]) {
    return items.reduce(
      (sum, item) => sum.plus(item.price),
      new Prisma.Decimal(0),
    );
  }

  seatIdsOf(items: { seatId: string | null }[]) {
    return items
      .map((item) => item.seatId)
      .filter((seatId): seatId is string => seatId !== null);
  }

  // 3. SEATED: o'rindiqlar shu seans zaliga tegishli, sektori uchun kategoriya bor va hali sotilmagan
  private async prepareSeatedItems(
    session: { id: string; venueId: string },
    seatIds?: string[],
  ): Promise<NewOrderItem[]> {
    if (!seatIds?.length) {
      throw new BadRequestException(
        'SEATED seans uchun seatIds yuborilishi kerak',
      );
    }

    const seats = await this.db.seat.findMany({
      where: { id: { in: seatIds } },
      select: {
        id: true,
        row: { select: { sector: { select: { id: true, venueId: true } } } },
      },
    });
    const isSameVenue = seats.every(
      (seat) => seat.row.sector.venueId === session.venueId,
    );
    if (seats.length !== seatIds.length || !isSameVenue) {
      throw new BadRequestException(
        "O'rindiqlar shu seans zaliga tegishli emas",
      );
    }

    const soldCount = await this.db.ticket.count({
      where: { sessionId: session.id, seatId: { in: seatIds } },
    });
    if (soldCount > 0) {
      throw new ConflictException(
        "Tanlangan o'rindiqlarning ayrimlari allaqachon sotilgan",
      );
    }

    const categories = await this.db.ticketCategory.findMany({
      where: { sessionId: session.id },
    });
    return seats.map((seat) => {
      const category = categories.find(
        (c) => c.sectorId === seat.row.sector.id,
      );
      if (!category) {
        throw new BadRequestException('Bu sektor uchun chipta sotilmaydi');
      }
      return {
        ticketCategoryId: category.id,
        seatId: seat.id,
        price: category.price,
      };
    });
  }

  // 3. Har bir o'rindiq Redis'da NX bilan band qilinadi.
  // Bittasi band bo'lsa, shu so'rovda qo'yilgan kalitlar o'chiriladi va 409 qaytadi.
  private async holdSeats(
    sessionId: string,
    seatIds: string[],
    orderId: string,
  ) {
    const ttlSeconds = env.ORDER.HOLD_MINUTES * 60;
    const heldSeatIds: string[] = [];
    for (const seatId of seatIds) {
      const result = await this.redis.client.set(
        seatHoldKey(sessionId, seatId),
        orderId,
        'EX',
        ttlSeconds,
        'NX',
      );
      if (result !== 'OK') {
        await this.releaseSeatHolds(orderId, sessionId, heldSeatIds);
        throw new ConflictException(
          "Tanlangan o'rindiqlarning ayrimlari boshqa foydalanuvchi tomonidan band qilingan",
        );
      }
      heldSeatIds.push(seatId);
    }
  }

  // 2 va 4. GENERAL: jami ≤ 5, qolgan soni = quantity − soldCount − faol PENDING buyurtmalardagi soni
  private async prepareGeneralItems(
    sessionId: string,
    items?: GeneralOrderItemDto[],
  ): Promise<NewOrderItem[]> {
    if (!items?.length) {
      throw new BadRequestException(
        'GENERAL seans uchun items yuborilishi kerak',
      );
    }

    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    if (totalQuantity > MAX_TICKETS_PER_ORDER) {
      throw new BadRequestException(
        `Bitta buyurtmada ${MAX_TICKETS_PER_ORDER} tadan ortiq chipta bo'lishi mumkin emas`,
      );
    }

    const categoryIds = items.map((item) => item.ticketCategoryId);
    if (new Set(categoryIds).size !== categoryIds.length) {
      throw new BadRequestException('Kategoriyalar takrorlanmasligi kerak');
    }

    const categories = await this.db.ticketCategory.findMany({
      where: { id: { in: categoryIds }, sessionId },
    });
    if (categories.length !== categoryIds.length) {
      throw new NotFoundException('Kategoriya bu seansda topilmadi');
    }

    const result: NewOrderItem[] = [];
    for (const item of items) {
      const category = categories.find((c) => c.id === item.ticketCategoryId)!;
      const pendingCount = await this.db.orderItem.count({
        where: {
          ticketCategoryId: category.id,
          order: { status: OrderStatus.PENDING, expiresAt: { gt: new Date() } },
        },
      });
      const available =
        (category.quantity ?? 0) - category.soldCount - pendingCount;
      if (available < item.quantity) {
        throw new ConflictException(
          `"${category.name}" kategoriyasida faqat ${Math.max(available, 0)} ta chipta qoldi`,
        );
      }
      // Har bir chipta alohida order_item — keyin har biriga alohida ticket (QR) yaratiladi
      for (let i = 0; i < item.quantity; i++) {
        result.push({
          ticketCategoryId: category.id,
          seatId: null,
          price: category.price,
        });
      }
    }
    return result;
  }

  // TZ 4.3: muddati o'tgan buyurtmalar ro'yxat so'ralganda EXPIRED ga o'tkaziladi.
  // Redis kalitlari TTL bilan o'zi o'chadi.
  private async expireOverdueOrders(userId: string) {
    await this.db.order.updateMany({
      where: {
        userId,
        status: OrderStatus.PENDING,
        expiresAt: { lte: new Date() },
      },
      data: { status: OrderStatus.EXPIRED },
    });
  }
}
