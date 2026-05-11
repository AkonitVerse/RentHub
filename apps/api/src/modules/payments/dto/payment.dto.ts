import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentKind, PaymentMethod } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ minimum: 1, description: 'Сумма в рублях, целое число' })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiPropertyOptional({ enum: PaymentKind, default: PaymentKind.CHARGE })
  @IsOptional()
  @IsEnum(PaymentKind)
  kind?: PaymentKind;

  @ApiPropertyOptional({ description: 'Дата получения денег. По умолчанию — сейчас.' })
  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
