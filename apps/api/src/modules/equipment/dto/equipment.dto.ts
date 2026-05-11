import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransformBool } from '../../../common/transform/parse-bool';

export class ListEquipmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Только активные карточки' })
  @IsOptional()
  @TransformBool()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Только избранные (для главной)' })
  @IsOptional()
  @TransformBool()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    description:
      'Сортировка: name | rating | price (тир 1) | new (по createdAt). Префикс "-" для desc, например "-rating".',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({
    description:
      'Фильтр доступности: ISO-дата начала окна. Если указана, используется вместе с availableTo.',
  })
  @IsOptional()
  @IsString()
  availableFrom?: string;

  @ApiPropertyOptional({ description: 'Фильтр доступности: ISO-дата конца окна.' })
  @IsOptional()
  @IsString()
  availableTo?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit = 24;
}

export class CreateEquipmentDto {
  @ApiPropertyOptional({
    description: 'Артикул (SKU). Если не задан — будет сгенерирован автоматически вида EQ-NNNNNN.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]+$/, { message: 'SKU: буквы, цифры, дефис и подчёркивание' })
  @MinLength(2)
  sku?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ description: 'Категория обязательна (листовая)' })
  @IsInt()
  categoryId!: number;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullDesc?: string;

  @ApiProperty({ description: 'Базовая цена тира 1 за день, руб.' })
  @IsInt()
  @Min(0)
  basePrice!: number;

  @ApiPropertyOptional({ description: 'Залог, руб.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  deposit?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Технические характеристики' })
  @IsOptional()
  @IsObject()
  specs?: Record<string, string>;
}

export class UpdateEquipmentDto extends PartialType(CreateEquipmentDto) {}

export class AvailabilityQueryDto {
  @ApiProperty()
  @IsString()
  from!: string;

  @ApiProperty()
  @IsString()
  to!: string;
}

export class StartMaintenanceDto {
  @ApiProperty({ description: 'ID единицы склада' })
  @IsInt()
  warehouseItemId!: number;

  @ApiProperty()
  @IsString()
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  cost?: number;
}

export class SetTierPriceDto {
  @ApiProperty()
  @IsInt()
  tierId!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  pricePerDay!: number;
}
