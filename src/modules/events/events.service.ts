import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../config/database/prisma.service';
import { EventCacheService } from '../../config/redis/event-cache.service';
import {
  removeEventImage,
  saveEventImage,
} from '../../config/upload/event-image.upload';
import { successRes } from '../../common/helper/success-response';
import {
  eventCacheKey,
  eventListCacheKey,
} from '../../common/helper/redis-keys';
import { Role } from '../../common/enum';
import {
  EventStatus,
  SessionStatus,
} from '../../../generated/prisma/enums';
import { OrderService } from '../order/order.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import {
  AdminEventQueryDto,
  PaginationQueryDto,
} from './dto/event-query.dto';

@Injectable()
export class EventsService {
  constructor(
    private readonly db: PrismaService,
    private readonly cache: EventCacheService,
    private readonly orderService: OrderService,
  ) {}

  // Yangi tadbir doim PENDING — ADMIN tasdiqlamaguncha ro'yxatda ko'rinmaydi
  async create(
    organizerId: string,
    dto: CreateEventDto,
    poster?: Express.Multer.File,
  ) {
    if (!poster) {
      throw new BadRequestException('Afisha (poster) yuklanishi shart');
    }
    const { poster: _poster, ...data } = dto;
    const posterUrl = await saveEventImage(poster);
    try {
      const event = await this.db.event.create({
        data: { ...data, organizerId, posterUrl },
      });
      return successRes(event, 201);
    } catch (error) {
      await removeEventImage(posterUrl);
      throw error;
    }
  }

  async addImages(
    organizerId: string,
    eventId: string,
    files: Express.Multer.File[] = [],
  ) {
    if (!files.length) {
      throw new BadRequestException('Kamida bitta rasm yuklang');
    }
    const event = await this.findOwnEvent(organizerId, eventId);
    this.ensureNotCancelled(event.status);

    const urls: string[] = [];
    try {
      for (const file of files) {
        urls.push(await saveEventImage(file));
      }
      const images = await this.db.eventImage.createManyAndReturn({
        data: urls.map((url) => ({ eventId, url })),
      });
      await this.cache.clear();
      return successRes(images, 201);
    } catch (error) {
      await Promise.all(urls.map((url) => removeEventImage(url)));
      throw error;
    }
  }

  async removeImage(organizerId: string, eventId: string, imageId: string) {
    const image = await this.db.eventImage.findFirst({
      where: { id: imageId, eventId, event: { organizerId } },
    });
    if (!image) {
      throw new NotFoundException('Rasm topilmadi');
    }
    await this.db.eventImage.delete({ where: { id: imageId } });
    await removeEventImage(image.url);
    await this.cache.clear();
    return successRes({});
  }

  // Qayta moderatsiya (TZ 3.6): APPROVED yoki REJECTED tadbir tahrirlansa, PENDING ga qaytadi.
  // PENDING paytida yangi buyurtma qabul qilinmaydi (OrderService tadbir APPROVED ekanini tekshiradi).
  async update(
    organizerId: string,
    id: string,
    dto: UpdateEventDto,
    poster?: Express.Multer.File,
  ) {
    const event = await this.findOwnEvent(organizerId, id);
    this.ensureNotCancelled(event.status);

    const { poster: _poster, ...data } = dto;
    const posterUrl = poster ? await saveEventImage(poster) : undefined;
    try {
      const updated = await this.db.event.update({
        where: { id },
        data: {
          ...data,
          ...(posterUrl && { posterUrl }),
          status: EventStatus.PENDING,
          rejectReason: null,
          reviewedById: null,
        },
      });
      if (posterUrl) {
        await removeEventImage(event.posterUrl);
      }
      await this.cache.clear();
      return successRes(updated);
    } catch (error) {
      if (posterUrl) {
        await removeEventImage(posterUrl);
      }
      throw error;
    }
  }

  // Public: faqat APPROVED tadbirlar, pagination, Redis kesh (60 s)
  async findAll({ page, limit }: PaginationQueryDto) {
    const key = eventListCacheKey(page, limit);
    const cached = await this.cache.get<object>(key);
    if (cached) {
      return successRes(cached);
    }

    const where = { status: EventStatus.APPROVED };
    const [items, total] = await Promise.all([
      this.db.event.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          posterUrl: true,
          ageLimit: true,
          duration: true,
          sessions: {
            where: { status: SessionStatus.ACTIVE, startTime: { gt: new Date() } },
            orderBy: { startTime: 'asc' },
            select: {
              startTime: true,
              venue: { select: { name: true } },
              ticketCategories: { select: { price: true } },
            },
          },
        },
      }),
      this.db.event.count({ where }),
    ]);

    // Kartada ko'rsatish uchun: eng yaqin seans, uning zali va kelgusi seanslardagi eng arzon narx
    const data = {
      items: items.map(({ sessions, ...event }) => {
        const prices = sessions.flatMap((session) =>
          session.ticketCategories.map((category) => Number(category.price)),
        );
        return {
          ...event,
          nextSessionAt: sessions[0]?.startTime ?? null,
          venueName: sessions[0]?.venue.name ?? null,
          minPrice: prices.length ? Math.min(...prices) : null,
        };
      }),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
    await this.cache.set(key, data);
    return successRes(data);
  }

  // Public: tadbir + galereya + seanslar
  async findOne(id: string) {
    const key = eventCacheKey(id);
    const cached = await this.cache.get<object>(key);
    if (cached) {
      return successRes(cached);
    }

    const event = await this.db.event.findFirst({
      where: { id, status: EventStatus.APPROVED },
      include: {
        organizer: { select: { id: true, fullName: true } },
        images: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, url: true },
        },
        sessions: {
          where: { status: SessionStatus.ACTIVE },
          orderBy: { startTime: 'asc' },
          select: {
            id: true,
            startTime: true,
            seatingType: true,
            venue: { select: { id: true, name: true, address: true } },
            ticketCategories: {
              select: { id: true, name: true, price: true },
            },
          },
        },
      },
    });
    if (!event) {
      throw new NotFoundException('Tadbir topilmadi');
    }
    await this.cache.set(key, event);
    return successRes(event);
  }

  // Organizer: o'z tadbirlari, barcha statuslar bilan
  async findMy(organizerId: string) {
    const events = await this.db.event.findMany({
      where: { organizerId },
      orderBy: { createdAt: 'desc' },
      include: {
        images: { select: { id: true, url: true } },
        sessions: {
          orderBy: { startTime: 'asc' },
          select: {
            id: true,
            startTime: true,
            seatingType: true,
            status: true,
            venue: { select: { id: true, name: true } },
          },
        },
      },
    });
    return successRes(events);
  }

  // Admin: moderatsiya ro'yxati
  async findForAdmin({ status, page, limit }: AdminEventQueryDto) {
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      this.db.event.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          organizer: { select: { id: true, fullName: true, email: true } },
          _count: { select: { sessions: true, images: true } },
        },
      }),
      this.db.event.count({ where }),
    ]);
    return successRes({
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }

  async approve(adminId: string, id: string) {
    await this.moderate(id, {
      status: EventStatus.APPROVED,
      reviewedById: adminId,
      rejectReason: null,
    });
    await this.cache.clear();
    return successRes({ id, status: EventStatus.APPROVED });
  }

  async reject(adminId: string, id: string, rejectReason: string) {
    await this.moderate(id, {
      status: EventStatus.REJECTED,
      reviewedById: adminId,
      rejectReason,
    });
    await this.cache.clear();
    return successRes({ id, status: EventStatus.REJECTED, rejectReason });
  }

  // TZ 4.5: tadbir CANCELLED bo'lsa, uning barcha seanslari CANCELLED bo'ladi,
  // har bir seansning ACTIVE chiptalari va PENDING buyurtmalari ham bekor qilinadi.
  // ORGANIZER faqat o'z tadbirini, ADMIN istalganini bekor qiladi.
  async cancel(userId: string, role: string, id: string) {
    const isAdmin = role === Role.ADMIN || role === Role.SUPERADMIN;
    const event = await this.db.event.findFirst({
      where: isAdmin ? { id } : { id, organizerId: userId },
      include: {
        sessions: {
          where: { status: SessionStatus.ACTIVE },
          select: { id: true },
        },
      },
    });
    if (!event) {
      throw new NotFoundException('Tadbir topilmadi');
    }
    this.ensureNotCancelled(event.status);

    await this.db.$transaction([
      this.db.event.update({
        where: { id },
        data: { status: EventStatus.CANCELLED },
      }),
      this.db.session.updateMany({
        where: { eventId: id, status: SessionStatus.ACTIVE },
        data: { status: SessionStatus.CANCELLED },
      }),
    ]);
    for (const session of event.sessions) {
      await this.orderService.cancelSessionSales(session.id);
    }
    await this.cache.clear();
    return successRes({
      id,
      status: EventStatus.CANCELLED,
      cancelledSessions: event.sessions.length,
    });
  }

  // Faqat PENDING tadbir moderatsiya qilinadi. status sharti — ikki admin
  // bir vaqtda bossa, faqat bittasi o'tadi.
  private async moderate(
    id: string,
    data: {
      status: EventStatus;
      reviewedById: string;
      rejectReason: string | null;
    },
  ) {
    const event = await this.db.event.findUnique({ where: { id } });
    if (!event) {
      throw new NotFoundException('Tadbir topilmadi');
    }
    const updated = await this.db.event.updateMany({
      where: { id, status: EventStatus.PENDING },
      data,
    });
    if (updated.count === 0) {
      throw new ConflictException(
        `Faqat PENDING tadbirni ko'rib chiqish mumkin (hozirgi holat: ${event.status})`,
      );
    }
  }

  private async findOwnEvent(organizerId: string, id: string) {
    const event = await this.db.event.findFirst({
      where: { id, organizerId },
    });
    if (!event) {
      throw new NotFoundException('Tadbir topilmadi');
    }
    return event;
  }

  private ensureNotCancelled(status: EventStatus) {
    if (status === EventStatus.CANCELLED) {
      throw new BadRequestException('Tadbir bekor qilingan');
    }
  }
}
