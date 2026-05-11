import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateOrgSettingsDto {
  // ---- Просрочки ----
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  overdueCheckEnabled?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 60 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  overdueCheckEveryMinutes?: number;

  // ---- Утренняя сводка ----
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dailyBriefEnabled?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 23 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  dailyBriefHour?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 59 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(59)
  dailyBriefMinute?: number;

  // ---- Напоминание о возврате ----
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  returnReminderEnabled?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 23 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  returnReminderHour?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 59 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(59)
  returnReminderMinute?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 14 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(14)
  returnReminderDaysBefore?: number;

  // ---- Автоотмена инквайри ----
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  inquiryExpireEnabled?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 23 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  inquiryExpireHour?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 59 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(59)
  inquiryExpireMinute?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 365 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  inquiryExpireAfterDays?: number;

  // ---- Таймзона ----
  @ApiPropertyOptional({ example: 'Europe/Moscow' })
  @IsOptional()
  @IsString()
  timezone?: string;

  // ---- Реквизиты организации ----
  @ApiPropertyOptional({ example: 'Прокат на Лесной' })
  @IsOptional()
  @IsString()
  orgName?: string;

  @ApiPropertyOptional({ example: 'Прокат на Лесной' })
  @IsOptional()
  @IsString()
  orgShortName?: string;

  @ApiPropertyOptional({ example: '+7 (999) 123-45-67' })
  @IsOptional()
  @IsString()
  orgPhone?: string;

  @ApiPropertyOptional({ example: 'info@example.com' })
  @IsOptional()
  @IsString()
  orgEmail?: string;

  @ApiPropertyOptional({ example: 'г. Москва, ул. Лесная, 5' })
  @IsOptional()
  @IsString()
  orgAddress?: string;

  @ApiPropertyOptional({ example: 'Пн–Пт 9:00–19:00, Сб 10:00–17:00' })
  @IsOptional()
  @IsString()
  orgHours?: string;

  // ---- Публичная информация: Условия аренды ----
  @ApiPropertyOptional({ description: 'Заголовок страницы «Условия аренды»' })
  @IsOptional()
  @IsString()
  rentalTermsTitle?: string;

  @ApiPropertyOptional({ description: 'HTML-контент страницы «Условия аренды»' })
  @IsOptional()
  @IsString()
  rentalTermsContent?: string;

  // ---- Отправитель писем ----
  @ApiPropertyOptional({ example: 'Название организации' })
  @IsOptional()
  @IsString()
  senderName?: string;

  @ApiPropertyOptional({ example: 'info@example.com' })
  @IsOptional()
  @IsString()
  senderEmail?: string;

  @ApiPropertyOptional({ example: 'manager@example.com, ops@example.com' })
  @IsOptional()
  @IsString()
  staffEmails?: string;

  // ---- SMTP-транспорт ----
  @ApiPropertyOptional({ example: 'smtp.yandex.ru' })
  @IsOptional()
  @IsString()
  smtpHost?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 65535, example: 465 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(65535)
  smtpPort?: number;

  @ApiPropertyOptional({ example: 'noreply@example.com' })
  @IsOptional()
  @IsString()
  smtpUser?: string;

  @ApiPropertyOptional({ description: 'Пароль (или app password) для SMTP-логина.' })
  @IsOptional()
  @IsString()
  smtpPass?: string;

  @ApiPropertyOptional({ description: 'true = TLS (порт 465), false = STARTTLS на 587' })
  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;

  /**
   * Явный сигнал «стереть сохранённый пароль приложения».
   *
   * Нужен чтобы отличить два намерения:
   *  - smtpPass='' (или undefined) = «не менять текущий пароль»
   *  - clearSmtpPass=true = «удалить пароль, оставить пусто»
   *
   * UI выставляет этот флаг при сохранении настроек на ДРУГОЙ пилюле-пресете
   * без ввода нового пароля: старый пароль был от другого SMTP-сервера и в
   * новом контексте бесполезен.
   */
  @ApiPropertyOptional({ description: 'true = удалить сохранённый пароль приложения' })
  @IsOptional()
  @IsBoolean()
  clearSmtpPass?: boolean;
}
