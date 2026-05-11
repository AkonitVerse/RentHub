import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { DeliveryMethod } from '@prisma/client';

export class AddCartLineDto {
  @ApiProperty({ description: 'ID карточки каталога' })
  @IsInt()
  @Min(1)
  catalogItemId!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  qty!: number;

  @ApiProperty()
  @IsDateString()
  fromDate!: string;

  @ApiProperty()
  @IsDateString()
  toDate!: string;
}

export class UpdateCartLineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  qty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class CheckoutClientDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: '+79234567890' })
  @IsString()
  @Matches(/^\+7\d{10}$/, { message: 'Телефон в формате +7XXXXXXXXXX (11 цифр)' })
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class CheckoutDto {
  @ApiPropertyOptional({ description: 'Существующий клиент' })
  @IsOptional()
  @IsInt()
  clientId?: number;

  @ApiPropertyOptional({ description: 'Или данные нового клиента' })
  @IsOptional()
  clientData?: CheckoutClientDto;

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
  @IsString()
  notes?: string;
}
