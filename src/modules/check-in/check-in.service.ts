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
    // Eng yaqin seansli tadbir ro'yxat boshida — kontroller bugungi tadbirni darrov topadi
    const nextStart = (event: (typeof controllerEvents)[number]['event']) =>
      event.sessions
        .find((s) => s.startTime.getTime() > Date.now())
        ?.startTime.getTime() ?? Number.MAX_SAFE_INTEGER;
    const events = controllerEvents
      .map((item) => item.event)
      .sort((a, b) => nextStart(a) - nextStart(b));
    return successRes(events);
  }

  async checkIn(controllerId: string, dto: CheckInDto) {
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

    if (ticket.status === TicketStatus.USED) {
      throw new ConflictException('Chipta allaqachon ishlatilgan');
    }
    if (ticket.status === TicketStatus.CANCELLED) {
      throw new BadRequestException('Chipta bekor qilingan');
    }

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
