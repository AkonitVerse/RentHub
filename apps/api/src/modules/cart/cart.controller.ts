import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CartService } from './cart.service';
import { AddCartLineDto, CheckoutDto, UpdateCartLineDto } from './dto/cart.dto';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';

type CartRequest = Request & { cartSessionId?: string };

function getSession(req: CartRequest): string {
  if (!req.cartSessionId) throw new Error('Cart session middleware не сработал');
  return req.cartSessionId;
}

@ApiTags('Корзина')
@Controller('cart')
export class CartController {
  constructor(private readonly service: CartService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Текущая корзина (с расчётом цен и доступности)' })
  view(@Req() req: CartRequest) {
    return this.service.view(getSession(req));
  }

  @Public()
  @Post('lines')
  @ApiOperation({ summary: 'Добавить позицию в корзину' })
  addLine(@Req() req: CartRequest, @Body() dto: AddCartLineDto) {
    return this.service.addLine(getSession(req), dto);
  }

  @Public()
  @Patch('lines/:idx')
  updateLine(
    @Req() req: CartRequest,
    @Param('idx', ParseIntPipe) idx: number,
    @Body() dto: UpdateCartLineDto,
  ) {
    return this.service.updateLine(getSession(req), idx, dto);
  }

  @Public()
  @Delete('lines/:idx')
  removeLine(@Req() req: CartRequest, @Param('idx', ParseIntPipe) idx: number) {
    return this.service.removeLine(getSession(req), idx);
  }

  @Public()
  @Delete()
  clear(@Req() req: CartRequest) {
    return this.service.clear(getSession(req));
  }

  @Public()
  @Post('checkout')
  @ApiOperation({ summary: 'Оформить заказ из корзины' })
  checkout(
    @Req() req: CartRequest,
    @Body() dto: CheckoutDto,
    @CurrentUser() user?: JwtUserPayload,
  ) {
    return this.service.checkout(getSession(req), dto, user?.sub);
  }
}
