import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../config/database/prisma.service';
import { successRes } from '../../common/helper/success-response';
import { Prisma } from '../../../generated/prisma/client';
import {
  OrderStatus,
  PaymentStatus,
  SeatingType,
} from '../../../generated/prisma/enums';
import { OrderService } from '../order/order.service';
import { PayOrderDto } from './dto/pay-order.dto';

@Injectable()
export class PaymentService {
  constructor(
    private readonly db: PrismaService,
    private readonly orderService: OrderService,
  ) {}

  async pay(userId: string, orderId: string, dto: PayOrderDto) {
    // 1. Buyurtma shu userniki, PENDING va muddati o'tmagan bo'lishi kerak
    const order = await this.db.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: true,
        session: { select: { seatingType: true } },
      },
    });
    if (!order) {
      throw new NotFoundException('Buyurtma topilmadi');
    }
    if (order.status === OrderStatus.PAID) {
      throw new ConflictException("Buyurtma allaqachon to'langan");
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException("Bu buyurtmani to'lab bo'lmaydi");
    }
    if (order.expiresAt <= new Date()) {
      await this.orderService.markExpired(order.id);
      throw new GoneException(
        'Buyurtma muddati tugagan, qaytadan buyurtma bering',
      );
    }

    const amount = this.orderService.totalPrice(order.items);
    const transactionId = this.generateTransactionId();

    // 2. Muvaffaqiyatsiz to'lov: payment FAILED, buyurtma PENDING qoladi — muddat ichida qayta urinish mumkin.
    // payments.orderId unique, shuning uchun qayta urinishda yangi yozuv emas, mavjudi yangilanadi (upsert).
    if (!dto.success) {
      await this.db.payment.upsert({
        where: { orderId },
        create: { orderId, status: PaymentStatus.FAILED, transactionId },
        update: { status: PaymentStatus.FAILED, transactionId },
      });
      return successRes({
        orderId,
        paymentStatus: PaymentStatus.FAILED,
        amount,
        expiresAt: order.expiresAt,
        message:
          "To'lov amalga oshmadi. Muddat tugaguncha qayta urinib ko'rishingiz mumkin",
      });
    }

    // 3. Muvaffaqiyatli to'lov: hammasi bitta transaction ichida —
    // biror qadam xato bersa, hech narsa saqlanmaydi
    let tickets: { id: string; qrCode: string; seatId: string | null }[];
    try {
      tickets = await this.db.$transaction(async (tx) => {
        // Buyurtma hali ham PENDING bo'lsagina PAID ga o'tadi — ikki marta to'lash yoki
        // shu payt bekor qilishdan himoya
        const updated = await tx.order.updateMany({
          where: { id: orderId, status: OrderStatus.PENDING },
          data: { status: OrderStatus.PAID },
        });
        if (updated.count === 0) {
          throw new ConflictException(
            "Buyurtma holati o'zgargan, qayta tekshiring",
          );
        }

        const paidAt = new Date();
        await tx.payment.upsert({
          where: { orderId },
          create: {
            orderId,
            status: PaymentStatus.SUCCESS,
            transactionId,
            paidAt,
          },
          update: { status: PaymentStatus.SUCCESS, transactionId, paidAt },
        });

        if (order.session.seatingType === SeatingType.GENERAL) {
          await this.increaseSoldCount(tx, order.items);
        }

        // Har bir order_item uchun bitta chipta, qrCode — noyob UUID
        return tx.ticket.createManyAndReturn({
          data: order.items.map((item) => ({
            orderItemId: item.id,
            sessionId: order.sessionId,
            seatId: item.seatId,
            qrCode: randomUUID(),
          })),
          select: { id: true, qrCode: true, seatId: true },
        });
      });
    } catch (error) {
      // tickets (sessionId, seatId) unique — o'rindiq boshqa buyurtma orqali sotilib bo'lgan
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException("O'rindiq allaqachon sotilgan");
      }
      throw error;
    }

    // 4. Transactiondan keyin Redis'dagi seat-hold kalitlari o'chiriladi
    await this.orderService.releaseSeatHolds(
      order.id,
      order.sessionId,
      this.orderService.seatIdsOf(order.items),
    );

    return successRes(
      {
        orderId,
        paymentStatus: PaymentStatus.SUCCESS,
        transactionId,
        amount,
        tickets,
      },
      201,
    );
  }

  // GENERAL: soldCount atomar oshiriladi. Oshirilgandan keyin sig'imdan o'tib ketsa,
  // xato tashlanadi va butun transaction bekor bo'ladi.
  private async increaseSoldCount(
    tx: Prisma.TransactionClient,
    items: { ticketCategoryId: string }[],
  ) {
    const countByCategory = new Map<string, number>();
    for (const item of items) {
      const count = countByCategory.get(item.ticketCategoryId) ?? 0;
      countByCategory.set(item.ticketCategoryId, count + 1);
    }

    for (const [categoryId, count] of countByCategory) {
      const category = await tx.ticketCategory.update({
        where: { id: categoryId },
        data: { soldCount: { increment: count } },
      });
      if (
        category.quantity !== null &&
        category.soldCount > category.quantity
      ) {
        throw new ConflictException(
          `"${category.name}" kategoriyasida chipta qolmadi`,
        );
      }
    }
  }

  private generateTransactionId() {
    return `MOCK-${randomUUID()}`;
  }
}
