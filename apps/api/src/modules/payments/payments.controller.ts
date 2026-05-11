import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreatePaymentDto } from './dto/payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Roles('ADMIN', 'MANAGER')
  @Get('orders/:id/payments')
  @ApiOperation({ summary: 'Платежи по заказу со сводкой (paid/remaining).' })
  list(@Param('id', ParseIntPipe) orderId: number) {
    return this.service.listForOrder(orderId);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post('orders/:id/payments')
  @ApiOperation({ summary: 'Зафиксировать платёж по заказу (наличные / карта / перевод).' })
  create(
    @Param('id', ParseIntPipe) orderId: number,
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.service.create(orderId, dto, user?.sub ?? null);
  }

  @Roles('ADMIN')
  @Delete('payments/:id')
  @ApiOperation({ summary: 'Удалить платёж (например, ошибочный).' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
