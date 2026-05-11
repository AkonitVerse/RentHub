import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { OrderSource, OrderStatus, OrgSettings, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { assertTransition } from '../orders/order-status.machine';
import { NotificationDispatcher } from '../notifications/notification-dispatcher.service';

/**
 * Namespace для job-локов scheduler. Не пересекается с catalog-локами (42).
 */
const JOB_LOCK_NAMESPACE = 100;
enum JobLock {
  DETECT_OVERDUE = 1,
  EXPIRE_DRAFTS = 2,
  RETURN_REMINDERS = 3,
  DAILY_BRIEF = 4,
}

const JOB_NAMES = {
  detectOverdue: 'cron.detectOverdue',
  dailyBrief: 'cron.dailyOpsBrief',
  returnReminders: 'cron.sendReturnReminders',
  expireDrafts: 'cron.expireOldDrafts',
} as const;

/**
 * Динамический планировщик: расписание задач не зашито декораторами @Cron,
 * а читается из таблицы OrgSettings и регистрируется через SchedulerRegistry.
 * При изменении настроек админом вызывается reload() — задачи пересоздаются.
 */
@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationDispatcher,
    private readonly registry: SchedulerRegistry,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  /**
   * Перерегистрирует все cron-задачи на основе текущих OrgSettings.
   * Существующие job-ы предварительно удаляются.
   */
  async reload(): Promise<void> {
    const settings = await this.loadSettings();
    this.unregisterAll();

    if (settings.overdueCheckEnabled) {
      this.register(
        JOB_NAMES.detectOverdue,
        `0 */${settings.overdueCheckEveryMinutes} * * * *`,
        () => this.detectOverdue(),
        settings.timezone,
      );
    }
    if (settings.dailyBriefEnabled) {
      this.register(
        JOB_NAMES.dailyBrief,
        `0 ${settings.dailyBriefMinute} ${settings.dailyBriefHour} * * *`,
        () => this.sendDailyOpsBrief(),
        settings.timezone,
      );
    }
    if (settings.returnReminderEnabled) {
      this.register(
        JOB_NAMES.returnReminders,
        `0 ${settings.returnReminderMinute} ${settings.returnReminderHour} * * *`,
        () => this.sendReturnReminders(settings.returnReminderDaysBefore),
        settings.timezone,
      );
    }
    if (settings.inquiryExpireEnabled) {
      this.register(
        JOB_NAMES.expireDrafts,
        `0 ${settings.inquiryExpireMinute} ${settings.inquiryExpireHour} * * *`,
        () => this.expireOldDrafts(settings.inquiryExpireAfterDays),
        settings.timezone,
      );
    }

    this.logger.log(
      `Cron перезагружен: overdue=${settings.overdueCheckEnabled}/${settings.overdueCheckEveryMinutes}мин, ` +
        `brief=${settings.dailyBriefEnabled}/${settings.dailyBriefHour}:${pad(settings.dailyBriefMinute)}, ` +
        `reminder=${settings.returnReminderEnabled}/${settings.returnReminderHour}:${pad(settings.returnReminderMinute)}/T-${settings.returnReminderDaysBefore}, ` +
        `expire=${settings.inquiryExpireEnabled}/${settings.inquiryExpireHour}:${pad(settings.inquiryExpireMinute)}/${settings.inquiryExpireAfterDays}д, ` +
        `tz=${settings.timezone}`,
    );
  }

  // ============================================================
  // Загрузка / регистрация
  // ============================================================

  private async loadSettings(): Promise<OrgSettings> {
    let row = await this.prisma.orgSettings.findUnique({ where: { id: 1 } });
    if (!row) {
      row = await this.prisma.orgSettings.create({ data: { id: 1 } });
    }
    return row;
  }

  private register(
    name: string,
    cronExpr: string,
    handler: () => Promise<void> | void,
    timezone: string,
  ): void {
    try {
      const job = new CronJob(
        cronExpr,
        () => {
          // Не блокирующий вызов — ошибки уже логируются внутри runWithLock
          Promise.resolve(handler()).catch((err) => {
            this.logger.error(`[${name}] необработанная ошибка`, err);
          });
        },
        null,
        true,
        timezone,
      );
      this.registry.addCronJob(
        name,
        job as unknown as Parameters<typeof this.registry.addCronJob>[1],
      );
    } catch (e) {
      this.logger.error(
        `[${name}] не удалось зарегистрировать (cron="${cronExpr}", tz="${timezone}")`,
        (e as Error).message,
      );
    }
  }

  private unregisterAll(): void {
    for (const name of Object.values(JOB_NAMES)) {
      try {
        const existing = this.registry.getCronJob(name);
        existing.stop();
        this.registry.deleteCronJob(name);
      } catch {
        // job не зарегистрирован — это нормально на первом запуске
      }
    }
  }

  // ============================================================
  // Хендлеры задач (бизнес-логика)
  // ============================================================

  /** Переводит ACTIVE-заказы с истёкшим toDate в OVERDUE. */
  async detectOverdue(): Promise<void> {
    await this.runWithLock(JobLock.DETECT_OVERDUE, 'detectOverdue', async () => {
      const now = new Date();
      const candidates = await this.prisma.order.findMany({
        where: {
          status: OrderStatus.ACTIVE,
          toDate: { lt: now, not: null },
        },
        select: {
          id: true,
          status: true,
          number: true,
          toDate: true,
          client: { select: { name: true, email: true } },
        },
      });
      if (candidates.length === 0) return;

      await this.prisma.$transaction(async (tx) => {
        for (const o of candidates) {
          assertTransition(o.status, OrderStatus.OVERDUE);
          await tx.order.update({ where: { id: o.id }, data: { status: OrderStatus.OVERDUE } });
          await tx.orderStatusLog.create({
            data: {
              orderId: o.id,
              fromStatus: o.status,
              toStatus: OrderStatus.OVERDUE,
              changedById: null,
              note: 'Автоматически: срок возврата истёк',
            },
          });
        }
      });

      for (const o of candidates) {
        if (!o.toDate) continue;
        for (const audience of ['CLIENT', 'STAFF'] as const) {
          this.notifications.dispatch({
            type: 'ORDER_OVERDUE',
            audience,
            orderId: o.id,
            orderNumber: o.number,
            clientEmail: o.client.email,
            clientName: o.client.name,
            toDate: o.toDate.toISOString().slice(0, 10),
          });
        }
      }

      this.logger.log(`Переведено в OVERDUE: ${candidates.length} заказов`);
    });
  }

  /** Автоотмена WEB_INQUIRY-черновиков, оставленных без внимания. */
  async expireOldDrafts(afterDays: number): Promise<void> {
    await this.runWithLock(JobLock.EXPIRE_DRAFTS, 'expireOldDrafts', async () => {
      const threshold = new Date(Date.now() - afterDays * 86_400_000);
      const stale = await this.prisma.order.findMany({
        where: {
          status: OrderStatus.DRAFT,
          source: OrderSource.WEB_INQUIRY,
          createdAt: { lt: threshold },
        },
        select: { id: true, status: true },
      });
      if (stale.length === 0) return;

      await this.prisma.$transaction(async (tx) => {
        for (const o of stale) {
          assertTransition(o.status, OrderStatus.CANCELLED);
          await tx.order.update({
            where: { id: o.id },
            data: { status: OrderStatus.CANCELLED },
          });
          await tx.reservation.updateMany({
            where: {
              orderLine: { orderId: o.id },
              status: { in: [ReservationStatus.PLANNED, ReservationStatus.ACTIVE] },
            },
            data: { status: ReservationStatus.CANCELLED },
          });
          await tx.orderStatusLog.create({
            data: {
              orderId: o.id,
              fromStatus: OrderStatus.DRAFT,
              toStatus: OrderStatus.CANCELLED,
              changedById: null,
              note: `Автоматически: web-инквайри старше ${afterDays} дней`,
            },
          });
        }
      });

      this.logger.log(`Просроченных WEB_INQUIRY отменено: ${stale.length}`);
    });
  }

  /** Напоминание клиентам — до возврата осталось N дней. */
  async sendReturnReminders(daysBefore: number): Promise<void> {
    await this.runWithLock(JobLock.RETURN_REMINDERS, 'sendReturnReminders', async () => {
      const now = new Date();
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysBefore);
      const targetEnd = new Date(target);
      targetEnd.setHours(23, 59, 59, 999);

      const orders = await this.prisma.order.findMany({
        where: {
          status: OrderStatus.ACTIVE,
          toDate: { gte: target, lte: targetEnd },
        },
        select: {
          id: true,
          number: true,
          toDate: true,
          client: { select: { name: true, email: true } },
        },
      });
      if (orders.length === 0) return;

      for (const o of orders) {
        if (!o.toDate) continue;
        this.notifications.dispatch({
          type: 'ORDER_RETURN_REMINDER',
          audience: 'CLIENT',
          orderId: o.id,
          orderNumber: o.number,
          clientEmail: o.client.email,
          clientName: o.client.name,
          toDate: o.toDate.toISOString().slice(0, 10),
          daysLeft: daysBefore,
        });
      }

      this.logger.log(`Напоминаний о возврате (T-${daysBefore}): ${orders.length}`);
    });
  }

  /** Утренняя сводка для менеджеров: что сегодня выдать / принять / просрочки. */
  async sendDailyOpsBrief(): Promise<void> {
    await this.runWithLock(JobLock.DAILY_BRIEF, 'sendDailyOpsBrief', async () => {
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const [pickupsCount, returnsCount, overdueCount] = await Promise.all([
        this.prisma.order.count({
          where: {
            status: OrderStatus.CONFIRMED,
            fromDate: { gte: dayStart, lte: dayEnd },
          },
        }),
        this.prisma.order.count({
          where: {
            status: OrderStatus.ACTIVE,
            toDate: { gte: dayStart, lte: dayEnd },
          },
        }),
        this.prisma.order.count({ where: { status: OrderStatus.OVERDUE } }),
      ]);

      if (pickupsCount === 0 && returnsCount === 0 && overdueCount === 0) return;

      this.notifications.dispatch({
        type: 'DAILY_OPS_BRIEF',
        audience: 'STAFF',
        date: dayStart.toISOString().slice(0, 10),
        pickupsCount,
        returnsCount,
        overdueCount,
      });

      this.logger.log(
        `Утренняя сводка: выдач ${pickupsCount}, возвратов ${returnsCount}, просрочек ${overdueCount}`,
      );
    });
  }

  // ============================================================
  // Защита от двойного выполнения (postgres advisory lock)
  // ============================================================

  private async runWithLock(
    lockId: JobLock,
    jobName: string,
    fn: () => Promise<void>,
  ): Promise<void> {
    const acquired = await this.prisma.$queryRawUnsafe<Array<{ pg_try_advisory_lock: boolean }>>(
      `SELECT pg_try_advisory_lock(${JOB_LOCK_NAMESPACE}::int, ${lockId}::int)`,
    );
    const ok = acquired?.[0]?.pg_try_advisory_lock === true;
    if (!ok) {
      this.logger.debug(`[${jobName}] пропущен — лок занят другим экземпляром`);
      return;
    }
    try {
      await fn();
    } catch (e) {
      this.logger.error(`[${jobName}] ошибка`, (e as Error).stack);
    } finally {
      await this.prisma.$executeRawUnsafe(
        `SELECT pg_advisory_unlock(${JOB_LOCK_NAMESPACE}::int, ${lockId}::int)`,
      );
    }
  }
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
