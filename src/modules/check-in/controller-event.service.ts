import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../config/database/prisma.service';
import { successRes } from '../../common/helper/success-response';
import { Role } from '../../common/enum';
import { EventStatus } from '../../../generated/prisma/enums';
import { CreateControllerEventDto } from './dto/create-controller-event.dto';

@Injectable()
export class ControllerEventService {
  constructor(private readonly db: PrismaService) {}

  async create(organizerId: string, dto: CreateControllerEventDto) {
    // Organizer faqat o'zi yaratgan controllerni o'z tadbiriga biriktira oladi
    const controller = await this.db.user.findFirst({
      where: {
        id: dto.controllerId,
        role: Role.CONTROLLER,
        createdById: organizerId,
      },
    });
    if (!controller) {
      throw new NotFoundException('Controller topilmadi');
    }

    const event = await this.db.event.findFirst({
      where: { id: dto.eventId, organizerId },
    });
    if (!event) {
      throw new NotFoundException('Tadbir topilmadi');
    }
    if (event.status === EventStatus.CANCELLED) {
      throw new BadRequestException(
        'Bekor qilingan tadbirga biriktirib bo‘lmaydi',
      );
    }

    const exists = await this.db.controllerEvent.findUnique({
      where: {
        controllerId_eventId: {
          controllerId: dto.controllerId,
          eventId: dto.eventId,
        },
      },
    });
    if (exists) {
      throw new ConflictException(
        'Controller bu tadbirga allaqachon biriktirilgan',
      );
    }

    const controllerEvent = await this.db.controllerEvent.create({
      data: { controllerId: dto.controllerId, eventId: dto.eventId },
    });
    return successRes(controllerEvent, 201);
  }

  async remove(organizerId: string, id: string) {
    const controllerEvent = await this.db.controllerEvent.findFirst({
      where: { id, event: { organizerId } },
    });
    if (!controllerEvent) {
      throw new NotFoundException('Biriktirish topilmadi');
    }
    await this.db.controllerEvent.delete({ where: { id } });
    return successRes({});
  }
}
