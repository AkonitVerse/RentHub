import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CacheTTL } from '@nestjs/cache-manager';
import { SkipThrottle } from '@nestjs/throttler';
import { AnalyticsService } from './analytics.service';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Аналитика')
@Controller('analytics')
// Финансовая аналитика — выручка, утилизация парка, топ оборудования.
// Это коммерческая инфа, менеджеру по операциям видеть её не надо.
// UI и так прячет раздел через RequireRole('ADMIN'), но через прямой curl
// без этой защиты менеджер мог бы получить данные. Приводим в соответствие.
@Roles('ADMIN')
// Throttler отключён: эндпоинты и так за RBAC (ADMIN/MANAGER),
// а при загрузке страницы отчётов идёт 4 параллельных запроса — throttler
// с общим лимитом по IP блокирует легитимные запросы.
@SkipThrottle()
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('dashboard')
  @CacheTTL(60_000)
  dashboard() {
    return this.service.dashboard();
  }

  @Get('revenue')
  @CacheTTL(300_000)
  revenue(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.revenueByDay(from, to);
  }

  @Get('top-equipment')
  @CacheTTL(300_000)
  topEquipment(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: number,
  ) {
    return this.service.topEquipment(from, to, Number(limit) || 6);
  }

  /**
   * Утилизация парка по дням — % занятых единиц от общего числа OPERATIONAL.
   * Это оперативная нагрузка, не финансы. Менеджеру нужно для месячной сетки
   * на /admin/calendar (раскраска ячеек по % загрузки). Перекрывает class-level ADMIN.
   */
  @Roles('ADMIN', 'MANAGER')
  @Get('utilization')
  @CacheTTL(300_000)
  utilization(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.utilization(from, to);
  }

  /**
   * Timeline-календарь занятости по каждой единице инвентаря.
   * Кэш короткий — менеджер ожидает увидеть свежие резервы сразу после их создания.
   *
   * Доступен и менеджеру тоже — это операционная информация (что свободно когда),
   * без выручки/денег. Используется в /admin/calendar (Timeline-режим).
   * Перекрывает class-level @Roles('ADMIN').
   */
  @Roles('ADMIN', 'MANAGER')
  @Get('timeline')
  @CacheTTL(15_000)
  timeline(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    const catId = categoryId ? Number(categoryId) : undefined;
    return this.service.timeline(from, to, catId && !Number.isNaN(catId) ? catId : undefined);
  }
}
