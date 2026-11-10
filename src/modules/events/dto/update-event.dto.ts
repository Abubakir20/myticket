import { PartialType } from '@nestjs/swagger';
import { CreateEventDto } from './create-event.dto';

// poster ham ixtiyoriy: yuborilsa eski afisha diskdan o'chiriladi
export class UpdateEventDto extends PartialType(CreateEventDto) {}
