import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Уведомления')
@Controller('notifications')
@Roles('ADMIN', 'MANAGER')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get('upcoming-returns')
  upcoming(@Query('days') days?: number) {
    return this.service.upcomingReturns(Number(days) || 3);
  }

  @Get('overdue')
  overdue() {
    return this.service.overdue();
  }

  @Get('overdue/count')
  overdueCount() {
    return this.service.overdueCount();
  }

  @Get('today-pickups')
  todayPickups() {
    return this.service.todayPickups();
  }

  @Get('today-returns')
  todayReturns() {
    return this.service.todayReturns();
  }

  @Get('activity')
  activity(@Query('hours') hours?: number) {
    return this.service.recentActivity(Number(hours) || 24);
  }
}
