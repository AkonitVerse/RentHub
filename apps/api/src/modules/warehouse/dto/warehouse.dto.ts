import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { WarehouseItemStatus } from '@prisma/client';

export class CreateWarehouseItemDto {
  @ApiProperty({ description: 'Название единицы (обычно совпадает с карточкой)' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ description: 'Инвентарный номер', example: 'INV-000123' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]+$/, { message: 'Только буквы, цифры, дефис и подчёркивание' })
  @MaxLength(50)
  inventoryNumber!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  serialNumber?: string;

  @ApiProperty({ enum: WarehouseItemStatus, required: false })
  @IsOptional()
  @IsEnum(WarehouseItemStatus)
  status?: WarehouseItemStatus;

  @ApiProperty({ required: false, description: 'Привязка к карточке каталога' })
  @IsOptional()
  @IsInt()
  @Min(1)
  catalogItemId?: number | null;

  @ApiProperty({ required: false, description: 'Дата покупки (ISO)' })
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiProperty({ required: false, description: 'Закупочная цена в рублях' })
  @IsOptional()
  @IsInt()
  @Min(0)
  purchasePrice?: number;

  @ApiProperty({ required: false, description: 'Гарантия до (ISO)' })
  @IsOptional()
  @IsDateString()
  warrantyUntil?: string;

  @ApiProperty({ required: false, description: 'Заметка о состоянии' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateWarehouseItemDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]+$/)
  @MaxLength(50)
  inventoryNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  serialNumber?: string;

  @IsOptional()
  @IsEnum(WarehouseItemStatus)
  status?: WarehouseItemStatus;

  @IsOptional()
  @IsInt()
  catalogItemId?: number | null;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  purchasePrice?: number | null;

  @IsOptional()
  @IsDateString()
  warrantyUntil?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class ListWarehouseQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(WarehouseItemStatus)
  status?: WarehouseItemStatus;

  @ApiProperty({
    required: false,
    description: 'Фильтр по категории — собирает единицы привязанных к категории карточек',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  catalogItemId?: number;

  @ApiProperty({ required: false, description: 'Только без карточки (общий пул)' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unlinkedOnly?: boolean;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  limit?: number;
}

export class LinkToCatalogDto {
  @ApiProperty({ description: 'ID карточки каталога' })
  @IsInt()
  @Min(1)
  catalogItemId!: number;
}

export class BulkLinkDto {
  @ApiProperty({ description: 'ID карточки каталога' })
  @IsInt()
  @Min(1)
  catalogItemId!: number;

  @ApiProperty({ description: 'ID единиц склада', type: [Number] })
  @IsInt({ each: true })
  warehouseItemIds!: number[];
}

export class BulkUnlinkDto {
  @ApiProperty({ description: 'ID единиц склада', type: [Number] })
  @IsInt({ each: true })
  warehouseItemIds!: number[];
}

export class BulkUpdateStatusDto {
  @ApiProperty({ description: 'ID единиц склада', type: [Number] })
  @IsInt({ each: true })
  warehouseItemIds!: number[];

  @ApiProperty({ enum: WarehouseItemStatus })
  @IsEnum(WarehouseItemStatus)
  status!: WarehouseItemStatus;
}

export class BulkCreateWarehouseItemsDto {
  @ApiProperty({ description: 'Базовое название (применяется ко всем единицам)' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ description: 'Префикс инвентарного номера', example: 'INV-' })
  @IsString()
  @MaxLength(20)
  prefix!: string;

  @ApiProperty({ description: 'Стартовый номер для нумерации', example: 100 })
  @IsInt()
  @Min(0)
  startNumber!: number;

  @ApiProperty({ description: 'Количество единиц для создания (1..50)' })
  @IsInt()
  @Min(1)
  count!: number;

  @ApiProperty({
    description: 'Ширина числовой части (для нулевого паддинга, 1..6)',
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  padWidth?: number;

  @ApiProperty({ enum: WarehouseItemStatus, required: false })
  @IsOptional()
  @IsEnum(WarehouseItemStatus)
  status?: WarehouseItemStatus;

  @ApiProperty({
    description: 'Привязать сразу все к этой карточке (опц.)',
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  catalogItemId?: number;
}
