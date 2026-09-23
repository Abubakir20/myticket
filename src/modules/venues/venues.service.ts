import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { PrismaService } from '../../config/database/prisma.service';
import { CreateSectorDto } from './dto/create-sector.dto';
import { CreateRowDto } from './dto/create-row.dto';
import { CreatESeatsDto } from './dto/create-seats.dto';

@Injectable()
export class VenuesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createVenueDto: CreateVenueDto) {
    return this.prisma.venue.create({
      data: createVenueDto,
    });
  }

  async findAll() {
    return this.prisma.venue.findMany({});
  }

  async findOne(id: string) {
    const venue = await this.prisma.venue.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        address: true,
        description: true,
        sectors: {
          select: {
            id: true,
            name: true,
            rows: {
              select: {
                id: true,
                number: true,
                seats: {
                  select: {
                    id: true,
                    number: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!venue) {
      throw new NotFoundException('Bunday venue topilmadi');
    }
    return venue;
  }

  async update(id: string, updateVenueDto: UpdateVenueDto) {
    try {
      return await this.prisma.venue.update({
        where: { id },
        data: updateVenueDto,
      });
    } catch (error) {
      console.log('Xatolik venues updateda' + error);
    }
  }

  async createSector(venueId: string, createSectorDto: CreateSectorDto) {
    await this.findOne(venueId);

    return this.prisma.sector.create({
      data: {
        name: createSectorDto.name,
        venueId: venueId,
      },
    });
  }

  async createRow(sectorId: string, createRowDto: CreateRowDto) {
    const sector = await this.prisma.sector.findUnique({
      where: { id: sectorId },
    });
    if (!sector) {
      throw new NotFoundException('Bunday idli sektor topilmadi');
    }

    return this.prisma.row.create({
      data: {
        number: createRowDto.number,
        sectorId: sectorId,
      },
    });
  }

  async createSeats(rowId: string, createSeatsDto: CreatESeatsDto) {
    const row = await this.prisma.row.findUnique({
      where: { id: rowId },
    });
    if (!row) {
      throw new NotFoundException('Bunday idli sektor topilmadi');
    }

    return this.prisma.seat.create({
      data: {
        number: createSeatsDto.number,
        rowId: rowId,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.venue.delete({ where: { id } });
    return { message: 'Venue muvafaqiyatli ochirilidi' };
  }
}
