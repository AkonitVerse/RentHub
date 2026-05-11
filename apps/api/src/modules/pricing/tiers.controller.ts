import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TiersService } from './tiers.service';
import { AddTierDto, RecalculateTierDto, UpdateBoundaryDto } from './dto/tiers.dto';

@ApiTags('Ценовые тиры')
@Controller('pricing/tiers')
export class TiersController {
  constructor(private readonly service: TiersService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Список глобальных ценовых тиров' })
  list() {
    return this.service.list();
  }

  @Roles('ADMIN', 'MANAGER')
  @Post()
  @ApiOperation({ summary: 'Добавить новый последний тир (с массовым расчётом цен)' })
  add(@Body() dto: AddTierDto) {
    return this.service.addTier(dto.closeAtDays, dto.discountPercent);
  }

  @Roles('ADMIN', 'MANAGER')
  @Patch(':id/boundary')
  @ApiOperation({ summary: 'Изменить верхнюю границу не-последнего тира' })
  updateBoundary(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBoundaryDto) {
    return this.service.updateBoundary(id, dto.maxDays);
  }

  @Roles('ADMIN', 'MANAGER')
  @Delete('last')
  @ApiOperation({ summary: 'Удалить последний (открытый) тир' })
  deleteLast() {
    return this.service.deleteLast();
  }

  @Roles('ADMIN', 'MANAGER')
  @Post(':id/recalculate/preview')
  @ApiOperation({
    summary: 'Превью пересчёта: показывает «было/станет» по каждой карточке без записи в БД',
  })
  previewRecalculate(@Param('id', ParseIntPipe) id: number, @Body() dto: RecalculateTierDto) {
    return this.service.previewRecalculate(id, dto.discountPercent);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post(':id/recalculate')
  @ApiOperation({ summary: 'Пересчитать цены тира для всех карточек' })
  recalculate(@Param('id', ParseIntPipe) id: number, @Body() dto: RecalculateTierDto) {
    return this.service.recalculate(id, dto.discountPercent);
  }
}
