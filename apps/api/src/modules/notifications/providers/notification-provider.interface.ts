import { NotificationEvent } from '../notification-event';

/**
 * Транспорт уведомлений. Реализации:
 *  - LogProvider — всегда подключён, пишет в console.
 *  - EmailProvider — подключается, если задан SMTP_HOST.
 *
 * Провайдер сам решает, поддерживает ли он событие. dispatch() ловит
 * исключения провайдера и не даёт им сломать основной поток (best-effort).
 */
export interface NotificationProvider {
  /** Человекочитаемое имя для логов. */
  readonly name: string;

  /** Включён ли провайдер (зависит от env). */
  isEnabled(): boolean;

  /** Доставить событие. Может бросать — внешний слой ловит. */
  send(event: NotificationEvent): Promise<void>;
}
