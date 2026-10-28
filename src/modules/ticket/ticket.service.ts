import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/database/prisma.service';
import { successRes } from '../../common/helper/success-response';
import { Prisma } from '../../../generated/prisma/client';

const TICKET_INCLUDE = {
  session: {
    select: {
      id: true,
      startTime: true,
      event: { select: { id: true, title: true, posterUrl: true } },
      venue: { select: { name: true, address: true } },
    },
  },
  seat: {
    select: {
      number: true,
      row: { select: { number: true, sector: { select: { name: true } } } },
    },
  },
  orderItem: {
    select: {
      orderId: true,
      price: true,
      ticketCategory: { select: { name: true } },
    },
  },
} satisfies Prisma.TicketInclude;

@Injectable()
export class TicketService {
  constructor(private readonly db: PrismaService) {}

  async findMyTickets(userId: string) {
    const tickets = await this.db.ticket.findMany({
      where: { orderItem: { order: { userId } } },
      include: TICKET_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return successRes(tickets);
  }

  async findOne(userId: string, id: string) {
    const ticket = await this.db.ticket.findFirst({
      where: { id, orderItem: { order: { userId } } },
      include: TICKET_INCLUDE,
    });
    if (!ticket) {
      throw new NotFoundException('Chipta topilmadi');
    }
    return successRes(ticket);
  }
}
