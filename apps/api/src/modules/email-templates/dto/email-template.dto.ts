import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateEmailTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  subject?: string;

  @ApiPropertyOptional({ description: 'HTML, поддерживает плейсхолдеры {{var}}' })
  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  bodyHtml?: string;
}

export class PreviewEmailTemplateDto {
  @ApiPropertyOptional({
    description:
      'Значения для подстановки в плейсхолдеры. Если не задано — используются дефолтные примеры.',
  })
  @IsOptional()
  @IsObject()
  values?: Record<string, unknown>;
}
