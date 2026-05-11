import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import {
  AddOrderLineDto,
  AssignUnitDto,
  ChangeStatusDto,
  CreateInquiryDto,
  CreateOrderDto,
  ExtendLineDto,
  ListOrdersDto,
  PreviewOrderDto,
  UpdateOrderDto,
  UpdateOrderLineDto,
} from './dto/order.dto';

@ApiTags('Заказы')
@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Roles('ADMIN', 'MANAGER')
  @Get()
  list(@Query() query: ListOrdersDto) {
    return this.service.list(query);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post('preview')
  preview(@Body() dto: PreviewOrderDto) {
    return this.service.preview(dto);
  }

  /**
   * Публичный эндпойнт: лёгкая заявка с витрины (форма «связаться»).
   * Создаёт DRAFT-заказ без авторизации. Менеджер дозаполнит и подтвердит.
   */
  @Public()
  @Post('inquiry')
  @ApiOperation({ summary: 'Заявка с витрины (анонимно)' })
  inquiry(@Body() dto: CreateInquiryDto) {
    return this.service.createInquiry(dto);
  }

  @Roles('ADMIN', 'MANAGER')
  @Get(':id')
  byId(@Param('id', ParseIntPipe) id: number) {
    return this.service.getById(id);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post()
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: JwtUserPayload) {
    return this.service.create(dto, user.sub);
  }

  @Roles('ADMIN', 'MANAGER')
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrderDto) {
    return this.service.update(id, dto);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post(':id/status')
  changeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.service.changeStatus(id, dto, user.sub);
  }

  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  // =====================
  // Inline-редактирование позиций
  // =====================

  @Roles('ADMIN', 'MANAGER')
  @Post(':id/lines')
  @ApiOperation({ summary: 'Добавить позицию в заказ' })
  addLine(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddOrderLineDto,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.service.addLine(id, dto, user.sub);
  }

  @Roles('ADMIN', 'MANAGER')
  @Patch(':id/lines/:lineId')
  @ApiOperation({ summary: 'Обновить позицию (qty, equipment, unit)' })
  updateLine(
    @Param('id', ParseIntPipe) id: number,
    @Param('lineId', ParseIntPipe) lineId: number,
    @Body() dto: UpdateOrderLineDto,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.service.updateLine(id, lineId, dto, user.sub);
  }

  @Roles('ADMIN', 'MANAGER')
  @Delete(':id/lines/:lineId')
  @ApiOperation({ summary: 'Удалить позицию' })
  removeLine(
    @Param('id', ParseIntPipe) id: number,
    @Param('lineId', ParseIntPipe) lineId: number,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.service.removeLine(id, lineId, user.sub);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post(':id/lines/:lineId/assign-unit')
  @ApiOperation({ summary: 'Назначить конкретную единицу склада' })
  assignUnit(
    @Param('id', ParseIntPipe) id: number,
    @Param('lineId', ParseIntPipe) lineId: number,
    @Body() dto: AssignUnitDto,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.service.assignUnit(id, lineId, dto, user.sub);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post(':id/lines/:lineId/return')
  @ApiOperation({ summary: 'Отметить возврат позиции' })
  returnLine(
    @Param('id', ParseIntPipe) id: number,
    @Param('lineId', ParseIntPipe) lineId: number,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.service.returnLine(id, lineId, user.sub);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post(':id/lines/:lineId/extend')
  @ApiOperation({ summary: 'Продлить аренду по позиции' })
  extendLine(
    @Param('id', ParseIntPipe) id: number,
    @Param('lineId', ParseIntPipe) lineId: number,
    @Body() dto: ExtendLineDto,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.service.extendLine(id, lineId, dto, user.sub);
  }
}
