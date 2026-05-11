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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { EquipmentService } from './equipment.service';
import {
  AvailabilityQueryDto,
  CreateEquipmentDto,
  ListEquipmentDto,
  SetTierPriceDto,
  StartMaintenanceDto,
  UpdateEquipmentDto,
} from './dto/equipment.dto';
import { equipmentMulterOptions } from '../uploads/multer.options';

@ApiTags('Каталог (карточки оборудования)')
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly service: EquipmentService) {}

  @Public()
  @Get()
  list(@Query() query: ListEquipmentDto) {
    return this.service.list(query);
  }

  @Public()
  @Get(':id')
  byId(@Param('id', ParseIntPipe) id: number) {
    return this.service.getById(id);
  }

  @Public()
  @Get(':id/availability')
  availability(@Param('id', ParseIntPipe) id: number, @Query() q: AvailabilityQueryDto) {
    return this.service.getAvailability(id, q.from, q.to);
  }

  @Roles('ADMIN', 'MANAGER')
  @Get(':id/activation-status')
  @ApiOperation({
    summary: 'Проверка готовности карточки к активации (тиры + OPERATIONAL единицы)',
  })
  activationStatus(@Param('id', ParseIntPipe) id: number) {
    return this.service.getActivationStatus(id);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post()
  @ApiOperation({ summary: 'Создать карточку каталога' })
  create(@Body() dto: CreateEquipmentDto) {
    return this.service.create(dto);
  }

  @Roles('ADMIN', 'MANAGER')
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEquipmentDto) {
    return this.service.update(id, dto);
  }

  @Roles('ADMIN', 'MANAGER')
  @Patch(':id/tier-price')
  @ApiOperation({ summary: 'Установить цену конкретного тира для карточки' })
  setTierPrice(@Param('id', ParseIntPipe) id: number, @Body() dto: SetTierPriceDto) {
    return this.service.setTierPrice(id, dto.tierId, dto.pricePerDay);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post(':id/archive')
  @ApiOperation({ summary: 'Архивировать карточку (soft-delete, скрывает с витрины)' })
  archive(@Param('id', ParseIntPipe) id: number) {
    return this.service.archive(id);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post(':id/unarchive')
  @ApiOperation({ summary: 'Восстановить карточку из архива (с проверкой активации)' })
  unarchive(@Param('id', ParseIntPipe) id: number) {
    return this.service.unarchive(id);
  }

  @Roles('ADMIN')
  @Delete(':id')
  @ApiOperation({ summary: 'Удалить карточку навсегда (только из архива и без истории)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post(':id/photo')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file', equipmentMulterOptions))
  uploadPhoto(@Param('id', ParseIntPipe) id: number, @UploadedFile() file: Express.Multer.File) {
    const url = `/uploads/equipment/${file.filename}`;
    return this.service.addPhoto(id, url);
  }

  @Roles('ADMIN', 'MANAGER')
  @Patch(':id/photos')
  @ApiOperation({ summary: 'Перезаписать массив фото (для drag-reorder)' })
  setPhotos(@Param('id', ParseIntPipe) id: number, @Body() body: { photos: string[] }) {
    return this.service.setPhotos(id, body.photos);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post('maintenance')
  @ApiOperation({ summary: 'Поставить единицу склада на обслуживание' })
  startMaintenance(@Body() dto: StartMaintenanceDto) {
    return this.service.startMaintenance(dto);
  }

  @Roles('ADMIN', 'MANAGER')
  @Put('maintenance/:maintenanceId/end')
  endMaintenance(@Param('maintenanceId', ParseIntPipe) maintenanceId: number) {
    return this.service.endMaintenance(maintenanceId);
  }
}
