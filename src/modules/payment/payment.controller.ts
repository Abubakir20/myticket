import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PayOrderDto } from './dto/pay-order.dto';
import { AuthGuard } from '../../common/guard/jwt-auth.guard';
import { RolesGuard } from '../../common/guard/roles.guard';
import { AccessRoles } from '../../common/decorator/roles.decorator';
import { UserId } from '../../common/decorator/current-user.decorator';
import { Role } from '../../common/enum';

@UseGuards(AuthGuard, RolesGuard)
@AccessRoles(Role.CUSTOMER)
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post(':orderId/pay')
  pay(
    @UserId() userId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: PayOrderDto,
  ) {
    return this.paymentService.pay(userId, orderId, dto);
  }
}
