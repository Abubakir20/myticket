import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../config/database/prisma.service';
import { successRes } from '../../common/helper/success-response';
import { SessionStatus, TicketStatus } from '../../../generated/prisma/enums';
import { CheckInDto } from './dto/check-in.dto';

@Injectable()
export class CheckInService {
  constructor(private readonly db: PrismaService) {}

  async findMyEvents(controllerId: string) {
    const controllerEvents = await this.db.controllerEvent.findMany({
      where: { controllerId },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            posterUrl: true,
            status: true,
            sessions: {
              where: { status: SessionStatus.ACTIVE },
              orderBy: { startTime: 'asc' },
              select: {
                id: true,
                startTime: true,
                venue: { select: { name: true, address: true } },
              },
            },
          },
        },
      },
    });
    return successRes(controllerEvents.map((item) => item.event));
  }

  async checkIn(controllerId: string, dto: CheckInDto) {
    // 1. Chipta qrCode bo'yicha topiladi
    const ticket = await this.db.ticket.findUnique({
      where: { qrCode: dto.qrCode },
      include: {
        session: {
          select: {
            startTime: true,
            event: { select: { id: true, title: true } },
          },
        },
        seat: {
          select: {
            number: true,
            row: {
              select: { number: true, sector: { select: { name: true } } },
            },
          },
        },
        orderItem: { select: { ticketCategory: { select: { name: true } } } },
      },
    });
    if (!ticket) {
      throw new NotFoundException('Chipta topilmadi');
    }

    // 2. Controller shu tadbirga biriktirilgan bo'lishi kerak
    const assigned = await this.db.controllerEvent.findUnique({
      where: {
        controllerId_eventId: {
          controllerId,
          eventId: ticket.session.event.id,
        },
      },
    });
    if (!assigned) {
      throw new ForbiddenException('Siz bu tadbirga biriktirilmagansiz');
    }

    // 3. Faqat ACTIVE chipta o'tkaziladi
    if (ticket.status === TicketStatus.USED) {
      throw new ConflictException('Chipta allaqachon ishlatilgan');
    }
    if (ticket.status === TicketStatus.CANCELLED) {
      throw new BadRequestException('Chipta bekor qilingan');
    }

    // 4. Chipta USED bo'ladi. status: ACTIVE sharti — ikki controller bir vaqtda
    // skanerlasa, faqat bittasi o'tkazadi
    const usedAt = new Date();
    const updated = await this.db.ticket.updateMany({
      where: { id: ticket.id, status: TicketStatus.ACTIVE },
      data: { status: TicketStatus.USED, usedAt, checkedById: controllerId },
    });
    if (updated.count === 0) {
      throw new ConflictException('Chipta allaqachon ishlatilgan');
    }

    return successRes({
      ticketId: ticket.id,
      status: TicketStatus.USED,
      usedAt,
      event: ticket.session.event,
      startTime: ticket.session.startTime,
      category: ticket.orderItem.ticketCategory.name,
      seat: ticket.seat,
    });
  }
}
