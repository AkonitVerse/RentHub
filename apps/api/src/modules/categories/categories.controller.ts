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
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CategoriesService } from './categories.service';
import {
  BulkAttachEquipmentDto,
  BulkMoveCategoriesDto,
  BulkMoveEquipmentDto,
  CreateCategoryDto,
  TreeQueryDto,
  UpdateCategoryDto,
} from './dto/categories.dto';

@ApiTags('Категории')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Public()
  @Get('config')
  @ApiOperation({ summary: 'Параметры дерева категорий (макс. глубина)' })
  config() {
    return { maxDepth: this.service.getMaxDepth() };
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Плоский список категорий' })
  list() {
    return this.service.list();
  }

  @Public()
  @Get('tree')
  @ApiOperation({ summary: 'Дерево категорий (опционально только видимые)' })
  tree(@Query() q: TreeQueryDto) {
    return this.service.tree(q.visibleOnly === true);
  }

  @Public()
  @Get(':id')
  byId(@Param('id', ParseIntPipe) id: number) {
    return this.service.getById(id);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post()
  @ApiOperation({ summary: 'Создать категорию (admin)' })
  create(@Body() dto: CreateCategoryDto) {
    return this.service.create(dto);
  }

  @Roles('ADMIN', 'MANAGER')
  @Patch(':id')
  @ApiOperation({ summary: 'Обновить категорию (admin)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoryDto) {
    return this.service.update(id, dto);
  }

  @Roles('ADMIN', 'MANAGER')
  @Delete(':id')
  @ApiOperation({ summary: 'Удалить категорию (admin)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post(':id/equipment/bulk-attach')
  @ApiOperation({ summary: 'Массовая привязка карточек к категории (только листовая)' })
  bulkAttach(@Param('id', ParseIntPipe) id: number, @Body() dto: BulkAttachEquipmentDto) {
    return this.service.bulkAttachEquipment(id, dto.equipmentIds);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post('equipment/bulk-move')
  @ApiOperation({ summary: 'Массовое перемещение карточек в другую категорию (листовую)' })
  bulkMove(@Body() dto: BulkMoveEquipmentDto) {
    return this.service.bulkMoveEquipment(dto.targetCategoryId, dto.equipmentIds);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post('bulk-move')
  @ApiOperation({ summary: 'Массовое перемещение категорий под нового родителя' })
  bulkMoveCategories(@Body() dto: BulkMoveCategoriesDto) {
    return this.service.bulkMoveCategories(dto.targetParentId ?? null, dto.categoryIds);
  }
}
