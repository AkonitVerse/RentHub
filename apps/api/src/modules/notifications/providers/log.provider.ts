import { Injectable, Logger } from '@nestjs/common';
import { NotificationProvider } from './notification-provider.interface';
import { NotificationEvent } from '../notification-event';

/**
 * Дефолтный провайдер: пишет краткое представление события в логи NestJS.
 * Всегда включён — полезен в dev и для аудита.
 */
@Injectable()
export class LogNotificationProvider implements NotificationProvider {
  readonly name = 'log';
  private readonly logger = new Logger('Notifications');

  isEnabled(): boolean {
    return true;
  }

  send(event: NotificationEvent): Promise<void> {
    const audience = event.audience;
    const summary = formatEvent(event);
    this.logger.log(`[${event.type} → ${audience}] ${summary}`);
    return Promise.resolve();
  }
}

/** В prod не логируем PII (имена, телефоны, email, коды) — попадает в Sentry/Loki/файлы. */
const isDev = process.env.NODE_ENV !== 'production';
const mask = (s: string | undefined | null, keepEnd = 2): string => {
  if (!s) return '';
  if (isDev) return s;
  if (s.length <= keepEnd) return '***';
  return '*'.repeat(Math.max(2, s.length - keepEnd)) + s.slice(-keepEnd);
};

function formatEvent(event: NotificationEvent): string {
  switch (event.type) {
    case 'INQUIRY_RECEIVED':
      return `${event.orderNumber} от ${mask(event.contactName)} (${mask(event.contactPhone, 4)})${event.equipmentName ? ` — ${event.equipmentName}` : ''}`;
    case 'ORDER_CREATED':
      return `${event.orderNumber} (${event.source}) от ${mask(event.clientName)}, сумма ${event.totalAmount}₽`;
    case 'ORDER_STATUS_CHANGED':
      return `${event.orderNumber}: ${event.fromStatus} → ${event.toStatus} (клиент: ${mask(event.clientName)})`;
    case 'ORDER_OVERDUE':
      return `${event.orderNumber}: просрочен возврат (срок был ${event.toDate}, клиент: ${mask(event.clientName)})`;
    case 'ORDER_RETURN_REMINDER':
      return `${event.orderNumber}: напоминание клиенту ${mask(event.clientName)} — завтра возврат (${event.toDate})`;
    case 'ORDER_EXTENDED':
      return `${event.orderNumber}: продлён на +${event.addedDays} дн., доплата ${event.addedAmount}₽`;
    case 'PASSWORD_RESET_CODE':
      // КРИТИЧНО: код в продакшене НЕ выводим целиком — попадает в логи навсегда,
      // а злоумышленник с доступом к логам может за 15 минут сбросить пароль жертвы.
      // В dev оставляем для удобства тестирования.
      if (isDev) {
        return `Код сброса пароля для ${event.clientEmail}: ${event.code} (TTL ${event.ttlMinutes} мин)`;
      }
      return `Сгенерирован код сброса пароля для ${mask(event.clientEmail, 4)} (TTL ${event.ttlMinutes} мин)`;
    case 'EMAIL_VERIFICATION_CODE':
      // То же правило что и для PASSWORD_RESET_CODE — код в проде маскируется.
      if (isDev) {
        return `Код подтверждения email для ${event.clientEmail}: ${event.code} (TTL ${event.ttlMinutes} мин)`;
      }
      return `Сгенерирован код подтверждения email для ${mask(event.clientEmail, 4)} (TTL ${event.ttlMinutes} мин)`;
    case 'DAILY_OPS_BRIEF':
      return `Сводка ${event.date}: выдач ${event.pickupsCount}, возвратов ${event.returnsCount}, просрочек ${event.overdueCount}`;
  }
}
