import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { TransformBool } from '../../../common/transform/parse-bool';

export class CreateCategoryDto {
  @ApiProperty({ description: 'Название категории', example: 'Аккумуляторные дрели' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ required: false, description: 'Описание' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ required: false, description: 'Иконка (имя из либы)' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({
    required: false,
    description: 'Родительская категория. null/undefined = корневая',
  })
  @IsOptional()
  @IsInt()
  parentId?: number | null;

  @ApiProperty({ required: false, description: 'Порядок сортировки' })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsInt()
  parentId?: number | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class TreeQueryDto {
  @ApiProperty({ required: false, description: 'Только видимые (с активным каталогом)' })
  @IsOptional()
  @TransformBool()
  @IsBoolean()
  visibleOnly?: boolean;
}

export class BulkAttachEquipmentDto {
  @ApiProperty({ description: 'ID карточек каталога', type: [Number] })
  @IsInt({ each: true })
  equipmentIds!: number[];
}

export class BulkMoveEquipmentDto {
  @ApiProperty({ description: 'ID целевой категории (листовой)' })
  @IsInt()
  targetCategoryId!: number;

  @ApiProperty({ description: 'ID карточек каталога', type: [Number] })
  @IsInt({ each: true })
  equipmentIds!: number[];
}

export class BulkMoveCategoriesDto {
  @ApiProperty({
    required: false,
    nullable: true,
    description: 'ID целевого родителя (null = перенести на корневой уровень)',
  })
  @IsOptional()
  @IsInt()
  targetParentId?: number | null;

  @ApiProperty({ description: 'ID перемещаемых категорий', type: [Number] })
  @IsInt({ each: true })
  categoryIds!: number[];
}
