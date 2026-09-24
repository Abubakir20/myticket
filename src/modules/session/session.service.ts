import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateSessionDto } from './dto/create-session.dto';
import { PrismaService } from '../../config/database/prisma.service';

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(eventId: string, data: CreateSessionDto) {
    const requestedStart = new Date(data.startTime);

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) throw new NotFoundException('Tadbir topilmadi.');

    const requestedEnd = new Date(
      requestedStart.getTime() + event.duration * 60000,
    );

    const conflictingSession = await this.prisma.session.findFirst({
      where: {
        venueId: data.venueId,
        status: 'ACTIVE',
        startTime: { lte: requestedEnd },
      },
    });

    if (conflictingSession) {
      throw new ConflictException(
        'Bu vaqtda ushbu bino/arena band (Venue double-booking detected).',
      );
    }

    if (data.seatingType === 'SEATED') {
      const sectorIds = data.categories.map((c) => c.sectorId).filter(Boolean);
      const uniqueSectorIds = new Set(sectorIds);
      if (sectorIds.length !== uniqueSectorIds.size) {
        throw new ConflictException(
          'SEATED da har bir sektorga faqat bitta toifa biriktirilishi mumkin.',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const session = await tx.session.create({
        data: {
          eventId,
          venueId: data.venueId,
          startTime: requestedStart,
          seatingType: data.seatingType,
          status: 'ACTIVE',
        },
      });

      for (const cat of data.categories) {
        await tx.ticketCategory.create({
          data: {
            sessionId: session.id,
            name: cat.name,
            price: cat.price,
            sectorId: data.seatingType === 'SEATED' ? cat.sectorId : null,
            quantity: data.seatingType === 'GENERAL' ? cat.quantity : null,
          },
        });
      }

      await tx.event.update({
        where: { id: eventId },
        data: { status: 'PENDING' },
      });

      return session;
    });
  }

  async getSessionsByEvent(eventId: string) {
    return this.prisma.session.findMany({
      where: { eventId, status: 'ACTIVE' },
      include: { ticketCategories: true },
    });
  }

  async getSessionSeats(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        venue: {
          include: {
            sectors: {
              include: {
                rows: {
                  include: { seats: true },
                },
              },
            },
          },
        },
      },
    });

    if (!session) throw new NotFoundException('Seans topilmadi.');
    if (session.seatingType !== 'SEATED') {
      throw new BadRequestException('Ushbu seans oʻrindiqli (SEATED) emas.');
    }

    const soldTickets = await this.prisma.ticket.findMany({
      where: { sessionId, status: 'ACTIVE' },
      select: { seatId: true },
    });

    const heldItems = await this.prisma.orderItem.findMany({
      where: { order: { sessionId, status: 'PENDING' } },
      select: { seatId: true },
    });

    const soldSeatIds = new Set(soldTickets.map((t) => t.seatId));
    const heldSeatIds = new Set(heldItems.map((h) => h.seatId));

    const categories = await this.prisma.ticketCategory.findMany({
      where: { sessionId },
    });
    const sectorPrices = new Map(categories.map((c) => [c.sectorId, c.price]));

    const seatsLayout: {
      seatId: string;
      sector: string;
      row: number;
      seatNumber: number;
      status: string;
      price: any;
    }[] = [];

    for (const sector of session.venue.sectors) {
      const price = sectorPrices.get(sector.id) || 0;
      for (const row of sector.rows) {
        for (const seat of row.seats) {
          let status = 'FREE';
          if (soldSeatIds.has(seat.id)) status = 'SOLD';
          else if (heldSeatIds.has(seat.id)) status = 'HELD';

          seatsLayout.push({
            seatId: seat.id,
            sector: sector.name,
            row: row.number,
            seatNumber: seat.number,
            status,
            price,
          });
        }
      }
    }

    return seatsLayout;
  }

  async getSessionCategories(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Seans topilmadi.');

    const categories = await this.prisma.ticketCategory.findMany({
      where: { sessionId },
    });

    return categories.map((cat) => {
      if (session.seatingType === 'GENERAL') {
        return {
          id: cat.id,
          name: cat.name,
          price: cat.price,
          remainingCount: (cat.quantity || 0) - cat.soldCount,
        };
      }
      return {
        id: cat.id,
        name: cat.name,
        price: cat.price,
      };
    });
  }

  async updateTicketCategory(categoryId: string, data: any) {
    const category = await this.prisma.ticketCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category) throw new NotFoundException('Toifa topilmadi.');

    const ordersExist = await this.prisma.orderItem.findFirst({
      where: { ticketCategoryId: categoryId },
    });

    if (ordersExist) {
      throw new ForbiddenException(
        'Chipta sotish boshlangan boʻlsa, narx yoki sonni oʻzgartirib boʻlmaydi.',
      );
    }

    return this.prisma.ticketCategory.update({
      where: { id: categoryId },
      data: {
        price: data.price,
        quantity: data.quantity,
      },
    });
  }

  async cancelSession(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Seans topilmadi.');

    return this.prisma.session.update({
      where: { id: sessionId },
      data: { status: 'CANCELLED' },
    });
  }
}
