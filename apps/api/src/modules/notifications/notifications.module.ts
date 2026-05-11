import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationDispatcher } from './notification-dispatcher.service';
import { LogNotificationProvider } from './providers/log.provider';
import { EmailNotificationProvider } from './providers/email.provider';
import { EmailTemplatesModule } from '../email-templates/email-templates.module';

/**
 * Модуль помечен @Global, чтобы NotificationDispatcher был доступен
 * без явного импорта в каждый feature-модуль (orders, cart, scheduler).
 */
@Global()
@Module({
  imports: [EmailTemplatesModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    LogNotificationProvider,
    EmailNotificationProvider,
    NotificationDispatcher,
  ],
  exports: [NotificationsService, NotificationDispatcher, EmailNotificationProvider],
})
export class NotificationsModule {}
