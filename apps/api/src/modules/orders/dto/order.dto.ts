import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { OrderStatus, OrderSource, DeliveryMethod } from '@prisma/client';

export class OrderLineInput {
  @ApiProperty({ description: 'ID карточки каталога' })
  @IsInt()
  equipmentId!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  qty!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unitTag?: string;

  @ApiPropertyOptional({ description: 'ID конкретной единицы склада (опц.)' })
  @IsOptional()
  @IsInt()
  warehouseItemId?: number;
}

export class CreateOrderDto {
  @ApiProperty()
  @IsInt()
  clientId!: number;

  @ApiProperty()
  @IsDateString()
  fromDate!: string;

  @ApiProperty()
  @IsDateString()
  toDate!: string;

  @ApiProperty({ enum: DeliveryMethod })
  @IsEnum(DeliveryMethod)
  deliveryMethod!: DeliveryMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: '+79234567890' })
  @IsString()
  @Matches(/^\+7\d{10}$/, { message: 'Телефон в формате +7XXXXXXXXXX (11 цифр)' })
  contactPhone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  deposit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Если true — заказ создаётся в статусе DRAFT, иначе сразу PENDING (готов к подтверждению).',
  })
  @IsOptional()
  @IsBoolean()
  asDraft?: boolean;

  @ApiProperty({ type: [OrderLineInput] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderLineInput)
  lines!: OrderLineInput[];
}

export class UpdateOrderDto extends PartialType(CreateOrderDto) {}

/**
 * DTO для DRAFT-заказа из формы «связаться» на витрине.
 * Анонимный, минимальные поля. Менеджер дозаполнит позже.
 */
export class CreateInquiryDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Карточка, по которой пришёл инквайри' })
  @IsOptional()
  @IsInt()
  equipmentId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;
}

export class ListOrdersDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ enum: OrderSource })
  @IsOptional()
  @IsEnum(OrderSource)
  source?: OrderSource;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  clientId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit = 50;
}

export class ChangeStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class PreviewOrderDto {
  @ApiProperty()
  @IsDateString()
  fromDate!: string;

  @ApiProperty()
  @IsDateString()
  toDate!: string;

  @ApiProperty({ type: [OrderLineInput] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderLineInput)
  lines!: OrderLineInput[];
}

export class AddOrderLineDto extends OrderLineInput {}

export class UpdateOrderLineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  equipmentId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  qty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unitTag?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  warehouseItemId?: number | null;
}

export class AssignUnitDto {
  @ApiProperty({ description: 'ID единицы склада' })
  @IsInt()
  warehouseItemId!: number;
}

/**
 * Продление аренды — сдвигает toDate позиции и связанных Reservation.
 * Стоимость продления считается по снепшоту цены позиции.
 */
export class ExtendLineDto {
  @ApiProperty({ description: 'Новая дата окончания (>= текущей toDate позиции)' })
  @IsDateString()
  newToDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

