import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../config/database/prisma.service';
import { successRes } from '../../common/helper/success-response';
import { Prisma } from '../../../generated/prisma/client';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { CreateSectorDto } from './dto/create-sector.dto';
import { CreateRowDto } from './dto/create-row.dto';

@Injectable()
export class VenuesService {
  constructor(private readonly db: PrismaService) {}

  async create(adminId: string, dto: CreateVenueDto) {
    const venue = await this.db.venue.create({
      data: { ...dto, createdById: adminId },
    });
    return successRes(venue, 201);
  }

  async findAll() {
    const venues = await this.db.venue.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { sectors: true } } },
    });
    return successRes(venues);
  }

  // Zal + sektor/qator/o'rindiq sxemasi
  async findOne(id: string) {
    const venue = await this.db.venue.findUnique({
      where: { id },
      include: {
        sectors: {
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            rows: {
              orderBy: { number: 'asc' },
              select: {
                id: true,
                number: true,
                seats: {
                  orderBy: { number: 'asc' },
                  select: { id: true, number: true },
                },
              },
            },
          },
        },
      },
    });
    if (!venue) {
      throw new NotFoundException('Zal topilmadi');
    }
    return successRes(venue);
  }

  async update(id: string, dto: UpdateVenueDto) {
    await this.ensureVenue(id);
    const venue = await this.db.venue.update({ where: { id }, data: dto });
    return successRes(venue);
  }

  async remove(id: string) {
    await this.ensureVenue(id);
    // sessions.venueId — Restrict: seans o'tkazilgan zalni o'chirib bo'lmaydi
    const sessionsCount = await this.db.session.count({
      where: { venueId: id },
    });
    if (sessionsCount > 0) {
      throw new ConflictException(
        "Bu zalda seanslar bor, uni o'chirib bo'lmaydi. Kerak bo'lsa isActive = false qiling",
      );
    }
    await this.db.venue.delete({ where: { id } });
    return successRes({});
  }

  async createSector(venueId: string, dto: CreateSectorDto) {
    await this.ensureVenue(venueId);
    const sector = await this.db.sector.create({
      data: { name: dto.name, venueId },
    });
    return successRes(sector, 201);
  }

  // Qator yaratiladi va uning o'rindiqlari 1..seatsCount avtomatik qo'shiladi
  async createRow(sectorId: string, dto: CreateRowDto) {
    const sector = await this.db.sector.findUnique({ where: { id: sectorId } });
    if (!sector) {
      throw new NotFoundException('Sektor topilmadi');
    }
    try {
      const row = await this.db.row.create({
        data: {
          sectorId,
          number: dto.number,
          seats: {
            createMany: {
              data: Array.from({ length: dto.seatsCount }, (_, i) => ({
                number: i + 1,
              })),
            },
          },
        },
        include: { seats: { orderBy: { number: 'asc' } } },
      });
      return successRes(row, 201);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Bu sektorda ${dto.number}-qator allaqachon mavjud`,
        );
      }
      throw error;
    }
  }

  async removeSector(id: string) {
    const sector = await this.db.sector.findUnique({ where: { id } });
    if (!sector) {
      throw new NotFoundException('Sektor topilmadi');
    }
    // ticket_categories.sectorId — Restrict: seansda ishlatilgan sektorni o'chirib bo'lmaydi
    const used = await this.db.ticketCategory.count({ where: { sectorId: id } });
    if (used > 0) {
      throw new ConflictException(
        "Bu sektor seanslarda ishlatilgan, uni o'chirib bo'lmaydi",
      );
    }
    await this.db.sector.delete({ where: { id } });
    return successRes({});
  }

  async removeRow(id: string) {
    const row = await this.db.row.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Qator topilmadi');
    }
    // order_items/tickets.seatId — Restrict: sotilgan yoki band o'rindiqli qatorni o'chirib bo'lmaydi
    const used = await this.db.orderItem.count({
      where: { seat: { rowId: id } },
    });
    if (used > 0) {
      throw new ConflictException(
        "Bu qatordagi o'rindiqlarga buyurtma berilgan, uni o'chirib bo'lmaydi",
      );
    }
    await this.db.row.delete({ where: { id } });
    return successRes({});
  }

  private async ensureVenue(id: string) {
    const venue = await this.db.venue.findUnique({ where: { id } });
    if (!venue) {
      throw new NotFoundException('Zal topilmadi');
    }
    return venue;
  }
}
