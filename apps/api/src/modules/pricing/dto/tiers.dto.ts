import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max } from 'class-validator';

export class AddTierDto {
  @ApiProperty({
    description: 'На какое количество суток закрыть текущий открытый тир',
    example: 7,
  })
  @IsInt()
  @Min(1)
  closeAtDays!: number;

  @ApiProperty({ description: 'Скидка нового тира в %', example: 15 })
  @IsInt()
  @Min(0)
  @Max(100)
  discountPercent!: number;
}

export class UpdateBoundaryDto {
  @ApiProperty({ description: 'Новая верхняя граница (maxDays)', example: 14 })
  @IsInt()
  @Min(1)
  maxDays!: number;
}

export class RecalculateTierDto {
  @ApiProperty({ description: 'Скидка тира в %', example: 12 })
  @IsInt()
  @Min(0)
  @Max(100)
  discountPercent!: number;
}
