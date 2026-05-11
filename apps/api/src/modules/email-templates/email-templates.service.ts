import { Injectable, NotFoundException } from '@nestjs/common';
import { EmailTemplate } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Известные типы событий — должны совпадать с NotificationEvent.type.
 * Шаблон с неизвестным eventType админ изменить не сможет (404).
 */
export const KNOWN_EVENT_TYPES = [
  'INQUIRY_RECEIVED',
  'ORDER_CREATED',
  'ORDER_STATUS_CHANGED',
  'ORDER_OVERDUE',
  'ORDER_RETURN_REMINDER',
  'ORDER_EXTENDED',
  'PASSWORD_RESET_CODE',
  'EMAIL_VERIFICATION_CODE',
  'DAILY_OPS_BRIEF',
] as const;
export type KnownEventType = (typeof KNOWN_EVENT_TYPES)[number];

@Injectable()
export class EmailTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.emailTemplate.findMany({ orderBy: { id: 'asc' } });
  }

  async getByEventType(eventType: string): Promise<EmailTemplate | null> {
    return this.prisma.emailTemplate.findUnique({ where: { eventType } });
  }

  async getByEventTypeOrThrow(eventType: string): Promise<EmailTemplate> {
    const t = await this.getByEventType(eventType);
    if (!t) throw new NotFoundException(`Шаблон ${eventType} не найден`);
    return t;
  }

  async update(
    eventType: string,
    data: { enabled?: boolean; subject?: string; bodyHtml?: string },
  ): Promise<EmailTemplate> {
    if (!KNOWN_EVENT_TYPES.includes(eventType as KnownEventType)) {
      throw new NotFoundException(`Неизвестный тип события: ${eventType}`);
    }
    await this.getByEventTypeOrThrow(eventType);
    return this.prisma.emailTemplate.update({
      where: { eventType },
      data,
    });
  }

  /**
   * Простая подстановка плейсхолдеров {{var}} → values[var].
   * undefined / null / отсутствующая переменная → пустая строка.
   * Не выполняет HTML-экранирование (значения подставляются «как есть» —
   * предполагается, что они приходят из проверенных DTO; в письмах
   * вёрстка идёт на нашей стороне).
   */
  static render(template: string, values: Record<string, unknown>): string {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
      const v = values[key];
      if (v === undefined || v === null) return '';
      return String(v);
    });
  }

  /** Превью шаблона с подставленными примерами значений. */
  preview(eventType: string, sampleValues: Record<string, unknown>) {
    return this.getByEventTypeOrThrow(eventType).then((t) => ({
      eventType: t.eventType,
      subject: EmailTemplatesService.render(t.subject, sampleValues),
      bodyHtml: EmailTemplatesService.render(t.bodyHtml, sampleValues),
    }));
  }
}
