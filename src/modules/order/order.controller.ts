import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { AuthGuard } from '../../common/guard/jwt-auth.guard';
import { RolesGuard } from '../../common/guard/roles.guard';
import { AccessRoles } from '../../common/decorator/roles.decorator';
import { UserId } from '../../common/decorator/current-user.decorator';
import { Role } from '../../common/enum';

@UseGuards(AuthGuard, RolesGuard)
@AccessRoles(Role.CUSTOMER)
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  create(@UserId() userId: string, @Body() dto: CreateOrderDto) {
    return this.orderService.create(userId, dto);
  }

  // 'me' route ':id' dan oldin turishi kerak, aks holda 'me' id deb qabul qilinadi
  @Get('me')
  findMyOrders(@UserId() userId: string) {
    return this.orderService.findMyOrders(userId);
  }

  @Get(':id')
  findOne(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.orderService.findOne(userId, id);
  }

  @Patch(':id/cancel')
  cancel(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.orderService.cancel(userId, id);
  }
}
