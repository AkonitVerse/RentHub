import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { WarehouseService } from './warehouse.service';
import {
  BulkCreateWarehouseItemsDto,
  BulkLinkDto,
  BulkUnlinkDto,
  BulkUpdateStatusDto,
  CreateWarehouseItemDto,
  LinkToCatalogDto,
  ListWarehouseQueryDto,
  UpdateWarehouseItemDto,
} from './dto/warehouse.dto';

@ApiTags('Инвентарь')
@Controller('warehouse')
export class WarehouseController {
  constructor(private readonly service: WarehouseService) {}

  @Roles('ADMIN', 'MANAGER')
  @Get()
  @ApiOperation({ summary: 'Список физических единиц с фильтрами' })
  list(@Query() query: ListWarehouseQueryDto) {
    return this.service.list(query);
  }

  @Roles('ADMIN', 'MANAGER')
  @Get(':id')
  byId(@Param('id', ParseIntPipe) id: number) {
    return this.service.getById(id);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post()
  @ApiOperation({ summary: 'Создать единицу инвентаря' })
  create(@Body() dto: CreateWarehouseItemDto) {
    return this.service.create(dto);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post('bulk')
  @ApiOperation({ summary: 'Массовое создание единиц с авто-нумерацией' })
  bulkCreate(@Body() dto: BulkCreateWarehouseItemsDto) {
    return this.service.bulkCreate(dto);
  }

  @Roles('ADMIN', 'MANAGER')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateWarehouseItemDto) {
    return this.service.update(id, dto);
  }

  @Roles('ADMIN', 'MANAGER')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post(':id/link')
  @ApiOperation({ summary: 'Привязать единицу к карточке каталога' })
  link(@Param('id', ParseIntPipe) id: number, @Body() dto: LinkToCatalogDto) {
    return this.service.link(id, dto.catalogItemId);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post(':id/unlink')
  @ApiOperation({ summary: 'Открепить единицу от карточки каталога' })
  unlink(@Param('id', ParseIntPipe) id: number) {
    return this.service.unlink(id);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post('bulk-link')
  @ApiOperation({ summary: 'Массовая привязка единиц инвентаря к карточке каталога' })
  bulkLink(@Body() dto: BulkLinkDto) {
    return this.service.bulkLink(dto.catalogItemId, dto.warehouseItemIds);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post('bulk-unlink')
  @ApiOperation({ summary: 'Массовое открепление единиц инвентаря от карточки' })
  bulkUnlink(@Body() dto: BulkUnlinkDto) {
    return this.service.bulkUnlink(dto.warehouseItemIds);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post('bulk-status')
  @ApiOperation({ summary: 'Массовая смена физического статуса' })
  bulkStatus(@Body() dto: BulkUpdateStatusDto) {
    return this.service.bulkUpdateStatus(dto.warehouseItemIds, dto.status);
  }
}
