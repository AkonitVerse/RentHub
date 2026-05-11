import { Module, forwardRef } from '@nestjs/common';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { OrgSettingsController } from './org-settings.controller';
import { OrgSettingsService } from './org-settings.service';

/**
 * EmailNotificationProvider — глобальный (NotificationsModule помечен @Global),
 * поэтому импортировать NotificationsModule здесь не нужно: провайдер уже
 * доступен в DI-контейнере для инъекции в OrgSettingsService.
 */
@Module({
  imports: [forwardRef(() => SchedulerModule)],
  controllers: [OrgSettingsController],
  providers: [OrgSettingsService],
  exports: [OrgSettingsService],
})
export class OrgSettingsModule {}
