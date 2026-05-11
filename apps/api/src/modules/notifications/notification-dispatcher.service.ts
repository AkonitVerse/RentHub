import { Injectable, Logger } from '@nestjs/common';
import { LogNotificationProvider } from './providers/log.provider';
import { EmailNotificationProvider } from './providers/email.provider';
import { NotificationProvider } from './providers/notification-provider.interface';
import { NotificationEvent } from './notification-event';

/**
 * Единая точка отправки уведомлений. Все триггеры в бизнес-сервисах
 * вызывают `dispatch(event)` — диспетчер сам разбирается, какие провайдеры
 * включены и куда слать.
 *
 * Best-effort: ошибка одного провайдера не блокирует другие и не пробрасывается
 * наверх (события идут «fire and forget»).
 *
 * Расширение: добавить новый канал (Telegram, webhook) — сделать класс,
 * имплементирующий NotificationProvider, добавить в массив providers.
 */
@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);
  private readonly providers: NotificationProvider[];

  constructor(logProvider: LogNotificationProvider, emailProvider: EmailNotificationProvider) {
    this.providers = [logProvider, emailProvider];
  }

  /**
   * Отправляет событие во все включённые провайдеры. Не ждёт результата
   * (Promise.allSettled с fire-and-forget внутри).
   */
  dispatch(event: NotificationEvent): void {
    const enabled = this.providers.filter((p) => p.isEnabled());
    if (enabled.length === 0) return;
    void Promise.allSettled(
      enabled.map(async (p) => {
        try {
          await p.send(event);
        } catch (err) {
          this.logger.warn(
            `Провайдер ${p.name} не смог отправить ${event.type}: ${(err as Error).message}`,
          );
        }
      }),
    );
  }
}
