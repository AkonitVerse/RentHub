import { Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async upcomingReturns(days = 3) {
    const now = new Date();
    const horizon = new Date(now.getTime() + Number(days) * 86_400_000);
    return this.prisma.order.findMany({
      where: {
        status: OrderStatus.ACTIVE,
        toDate: { gte: now, lte: horizon },
      },
      orderBy: { toDate: 'asc' },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        _count: { select: { lines: true } },
      },
    });
  }

  async overdue() {
    const now = new Date();
    return this.prisma.order.findMany({
      where: {
        OR: [{ status: OrderStatus.OVERDUE }, { status: OrderStatus.ACTIVE, toDate: { lt: now } }],
      },
      orderBy: { toDate: 'asc' },
      include: {
        client: { select: { id: true, name: true, phone: true } },
      },
    });
  }

  async overdueCount(): Promise<{ count: number }> {
    const now = new Date();
    const count = await this.prisma.order.count({
      where: {
        OR: [{ status: OrderStatus.OVERDUE }, { status: OrderStatus.ACTIVE, toDate: { lt: now } }],
      },
    });
    return { count };
  }

  /**
   * Сегодняшние выдачи: подтверждённые заказы, у которых fromDate приходится на текущие сутки.
   * Используется виджетом «Сегодня выдать» в кабинете менеджера.
   */
  async todayPickups() {
    const { startOfDay, endOfDay } = this.todayBounds();
    return this.prisma.order.findMany({
      where: {
        status: OrderStatus.CONFIRMED,
        fromDate: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { fromDate: 'asc' },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        _count: { select: { lines: true } },
      },
    });
  }

  /**
   * Сегодняшние возвраты: активные заказы, у которых toDate приходится на текущие сутки.
   */
  async todayReturns() {
    const { startOfDay, endOfDay } = this.todayBounds();
    return this.prisma.order.findMany({
      where: {
        status: OrderStatus.ACTIVE,
        toDate: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { toDate: 'asc' },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        _count: { select: { lines: true } },
      },
    });
  }

  /**
   * Активность за период (по умолчанию 24 часа): новые заказы и смены статусов.
   * Объединяется в общий timeline для виджета «Активность» на /admin/today.
   */
  async recentActivity(hours = 24) {
    const since = new Date(Date.now() - hours * 3_600_000);
    const [newOrders, statusChanges, newClients] = await Promise.all([
      this.prisma.order.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          number: true,
          status: true,
          source: true,
          createdAt: true,
          totalAmount: true,
          client: { select: { id: true, name: true } },
        },
      }),
      this.prisma.orderStatusLog.findMany({
        where: { changedAt: { gte: since } },
        orderBy: { changedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          orderId: true,
          fromStatus: true,
          toStatus: true,
          changedAt: true,
          order: { select: { number: true, client: { select: { name: true } } } },
          changedBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.client.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, name: true, phone: true, createdAt: true },
      }),
    ]);
    return { newOrders, statusChanges, newClients, since: since.toISOString() };
  }

  private todayBounds() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { startOfDay, endOfDay };
  }
}
