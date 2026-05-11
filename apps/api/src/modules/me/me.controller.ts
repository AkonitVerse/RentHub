import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { OrderOwnerGuard } from '../../common/guards/order-owner.guard';
import { MeService } from './me.service';
import { ChangePasswordDto, UpdateProfileDto } from './dto/me.dto';

@ApiTags('Личный кабинет')
@Controller('me')
export class MeController {
  constructor(private readonly service: MeService) {}

  @Get()
  @ApiOperation({ summary: 'Профиль текущего пользователя и привязанный клиент' })
  profile(@CurrentUser() user: JwtUserPayload) {
    return this.service.profile(user.sub);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Обновить профиль (имя/email/телефон/адрес)' })
  updateProfile(@CurrentUser() user: JwtUserPayload, @Body() dto: UpdateProfileDto) {
    return this.service.updateProfile(user.sub, dto);
  }

  @Patch('password')
  @ApiOperation({ summary: 'Сменить пароль (требуется текущий)' })
  changePassword(@CurrentUser() user: JwtUserPayload, @Body() dto: ChangePasswordDto) {
    return this.service.changePassword(user.sub, dto);
  }

  @Get('orders')
  @ApiOperation({ summary: 'Список своих заказов' })
  listOrders(@CurrentUser() user: JwtUserPayload, @Query('status') status?: OrderStatus) {
    return this.service.listOrders(user.sub, { status });
  }

  @Get('orders/:id')
  @UseGuards(OrderOwnerGuard)
  @ApiOperation({ summary: 'Деталь своего заказа' })
  getOrder(@Param('id', ParseIntPipe) id: number) {
    return this.service.getOrder(id);
  }

  @Post('orders/:id/cancel')
  @UseGuards(OrderOwnerGuard)
  @ApiOperation({ summary: 'Отменить заказ (DRAFT/PENDING)' })
  cancelOrder(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUserPayload) {
    return this.service.cancelOrder(id, user.sub);
  }
}
