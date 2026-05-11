import { Injectable } from '@nestjs/common';
import { OrderStatus, ReservationStatus, WarehouseItemStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

const DAY_MS = 86_400_000;

/**
 * Бизнес-логика расчётов:
 *
 * ВЫРУЧКА = сумма Order.totalAmount (только аренда, без залога) по DONE-заказам.
 * Залог (Order.deposit) — это обеспечительный платёж, возвращаемый клиенту,
 * он не является доходом.
 *
 * ACTIVE/OVERDUE заказы показываются отдельно как «ожидаемый доход» —
 * они ещё не завершены и не являются подтверждённой выручкой.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private async totalActiveUnits(): Promise<number> {
    return this.prisma.warehouseItem.count({
      where: { status: WarehouseItemStatus.OPERATIONAL },
    });
  }

  async dashboard() {
    const now = new Date();
    // Последние 30 дней — совпадает с периодом отчётов по умолчанию.
    const monthStart = new Date(now.getTime() - 30 * DAY_MS);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const [
      doneRevenue,
      pendingRevenue,
      activeCount,
      overdueCount,
      todayCount,
      totalUnits,
      busyUnits,
    ] = await Promise.all([
      // Подтверждённая выручка — только DONE
      this.prisma.order.aggregate({
        where: {
          status: OrderStatus.DONE,
          createdAt: { gte: monthStart },
        },
        _sum: { totalAmount: true },
      }),
      // Ожидаемый доход — ACTIVE + OVERDUE (ещё не завершены)
      this.prisma.order.aggregate({
        where: {
          status: { in: [OrderStatus.ACTIVE, OrderStatus.OVERDUE] },
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.count({
        where: { status: OrderStatus.ACTIVE },
      }),
      this.prisma.order.count({
        where: { status: OrderStatus.OVERDUE },
      }),
      this.prisma.order.count({
        where: { createdAt: { gte: todayStart, lt: todayEnd } },
      }),
      this.totalActiveUnits(),
      this.prisma.reservation.count({
        where: {
          status: ReservationStatus.ACTIVE,
          fromDate: { lte: now },
          toDate: { gte: now },
        },
      }),
    ]);

    const utilization = totalUnits === 0 ? 0 : Math.round((busyUnits / totalUnits) * 100);

    return {
      monthRevenue: doneRevenue._sum.totalAmount ?? 0,
      pendingRevenue: pendingRevenue._sum.totalAmount ?? 0,
      activeOrders: activeCount,
      overdueOrders: overdueCount,
      todayOrders: todayCount,
      utilization,
    };
  }

  /**
   * Суточная выручка за период — ТОЛЬКО завершённые заказы (DONE).
   * ACTIVE/OVERDUE — ещё не заработанные деньги.
   */
  async revenueByDay(fromStr?: string, toStr?: string) {
    const to = toStr ? new Date(toStr) : new Date();
    const from = fromStr ? new Date(fromStr) : new Date(to.getTime() - 29 * DAY_MS);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);

    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.DONE,
        createdAt: { gte: from, lte: to },
      },
      select: { createdAt: true, totalAmount: true },
    });

    const buckets = new Map<string, number>();
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      buckets.set(d.toISOString().slice(0, 10), 0);
    }
    for (const o of orders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      buckets.set(key, (buckets.get(key) ?? 0) + o.totalAmount);
    }

    return Array.from(buckets.entries()).map(([date, value]) => ({ date, value }));
  }

  /**
   * Топ оборудования: выручка только по DONE-заказам + утилизация по резервам.
   */
  async topEquipment(fromStr?: string, toStr?: string, limit = 6) {
    const to = toStr ? new Date(toStr) : new Date();
    const from = fromStr ? new Date(fromStr) : new Date(to.getTime() - 29 * DAY_MS);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);

    const lines = await this.prisma.orderLine.findMany({
      where: {
        order: {
          status: OrderStatus.DONE,
          createdAt: { gte: from, lte: to },
        },
      },
      select: {
        equipmentId: true,
        sumAmount: true,
        equipment: { select: { id: true, name: true } },
      },
    });

    const itemIds = Array.from(new Set(lines.map((l) => l.equipmentId)));
    const unitsByItem = new Map<number, number>();
    if (itemIds.length > 0) {
      const grouped = await this.prisma.warehouseItem.groupBy({
        by: ['catalogItemId'],
        where: {
          catalogItemId: { in: itemIds },
          status: WarehouseItemStatus.OPERATIONAL,
        },
        _count: { id: true },
      });
      for (const g of grouped) {
        if (g.catalogItemId != null) unitsByItem.set(g.catalogItemId, g._count.id);
      }
    }

    const reservations = itemIds.length
      ? await this.prisma.reservation.findMany({
          where: {
            warehouseItem: { catalogItemId: { in: itemIds } },
            status: {
              in: [ReservationStatus.ACTIVE, ReservationStatus.RETURNED, ReservationStatus.PLANNED],
            },
            fromDate: { lt: to },
            toDate: { gt: from },
          },
          select: {
            fromDate: true,
            toDate: true,
            warehouseItem: { select: { catalogItemId: true } },
          },
        })
      : [];
    const unitDaysByItem = new Map<number, number>();
    for (const r of reservations) {
      const catalogId = r.warehouseItem.catalogItemId;
      if (catalogId == null) continue;
      const start = Math.max(r.fromDate.getTime(), from.getTime());
      const end = Math.min(r.toDate.getTime(), to.getTime());
      const days = Math.max(0, Math.ceil((end - start) / DAY_MS));
      unitDaysByItem.set(catalogId, (unitDaysByItem.get(catalogId) ?? 0) + days);
    }

    const byEquipment = new Map<number, { name: string; revenue: number }>();
    for (const line of lines) {
      const cur = byEquipment.get(line.equipmentId) ?? {
        name: line.equipment.name,
        revenue: 0,
      };
      cur.revenue += line.sumAmount;
      byEquipment.set(line.equipmentId, cur);
    }

    const periodDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / DAY_MS));
    return Array.from(byEquipment.entries())
      .map(([id, v]) => {
        const totalUnits = Math.max(1, unitsByItem.get(id) ?? 1);
        const unitDays = unitDaysByItem.get(id) ?? 0;
        return {
          id,
          name: v.name,
          revenue: v.revenue,
          util: Math.min(100, Math.round((unitDays / (totalUnits * periodDays)) * 100)),
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, Number(limit));
  }

  /** Timeline — без изменений, оперативная загрузка через Reservation. */
  async timeline(fromStr?: string, toStr?: string, categoryId?: number) {
    const to = toStr ? new Date(toStr) : new Date();
    const from = fromStr ? new Date(fromStr) : new Date(to.getTime() - 14 * DAY_MS);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);

    const units = await this.prisma.warehouseItem.findMany({
      where: categoryId ? { catalogItem: { categoryId } } : undefined,
      select: {
        id: true,
        inventoryNumber: true,
        status: true,
        catalogItemId: true,
        catalogItem: {
          select: { id: true, name: true, sku: true, photos: true },
        },
      },
      orderBy: [{ catalogItemId: 'asc' }, { inventoryNumber: 'asc' }],
    });

    if (units.length === 0) return { items: [], unassigned: [] };

    const unitIds = units.map((u) => u.id);
    const reservations = await this.prisma.reservation.findMany({
      where: {
        warehouseItemId: { in: unitIds },
        status: {
          in: [ReservationStatus.PLANNED, ReservationStatus.ACTIVE, ReservationStatus.RETURNED],
        },
        fromDate: { lt: to },
        toDate: { gt: from },
      },
      select: {
        id: true,
        warehouseItemId: true,
        fromDate: true,
        toDate: true,
        status: true,
        orderLine: {
          select: {
            order: {
              select: {
                id: true,
                number: true,
                status: true,
                client: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { fromDate: 'asc' },
    });

    const reservationsByUnit = new Map<number, typeof reservations>();
    for (const r of reservations) {
      const list = reservationsByUnit.get(r.warehouseItemId) ?? [];
      list.push(r);
      reservationsByUnit.set(r.warehouseItemId, list);
    }

    type GroupedItem = {
      catalogItemId: number;
      catalogName: string;
      catalogSku: string;
      photo: string | null;
      units: Array<{
        id: number;
        inventoryNumber: string;
        status: WarehouseItemStatus;
        reservations: Array<{
          id: number;
          fromDate: Date;
          toDate: Date;
          status: ReservationStatus;
          orderId: number;
          orderNumber: string;
          orderStatus: OrderStatus;
          clientName: string;
        }>;
      }>;
    };

    const grouped = new Map<number, GroupedItem>();
    const unassigned: GroupedItem['units'] = [];

    for (const unit of units) {
      const unitReservations = (reservationsByUnit.get(unit.id) ?? []).map((r) => ({
        id: r.id,
        fromDate: r.fromDate,
        toDate: r.toDate,
        status: r.status,
        orderId: r.orderLine.order.id,
        orderNumber: r.orderLine.order.number,
        orderStatus: r.orderLine.order.status,
        clientName: r.orderLine.order.client.name,
      }));

      const unitInfo = {
        id: unit.id,
        inventoryNumber: unit.inventoryNumber,
        status: unit.status,
        reservations: unitReservations,
      };

      if (unit.catalogItemId == null || unit.catalogItem == null) {
        unassigned.push(unitInfo);
        continue;
      }

      const photoArr = (unit.catalogItem.photos as string[] | null) ?? [];
      const existing = grouped.get(unit.catalogItemId);
      if (existing) {
        existing.units.push(unitInfo);
      } else {
        grouped.set(unit.catalogItemId, {
          catalogItemId: unit.catalogItemId,
          catalogName: unit.catalogItem.name,
          catalogSku: unit.catalogItem.sku,
          photo: photoArr[0] ?? null,
          units: [unitInfo],
        });
      }
    }

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      items: Array.from(grouped.values()).sort((a, b) =>
        a.catalogName.localeCompare(b.catalogName, 'ru'),
      ),
      unassigned,
    };
  }

  /** Утилизация по дням — все резервы (PLANNED/ACTIVE/RETURNED). */
  async utilization(fromStr?: string, toStr?: string) {
    const to = toStr ? new Date(toStr) : new Date();
    const from = fromStr ? new Date(fromStr) : new Date(to.getTime() - 29 * DAY_MS);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);

    const reservations = await this.prisma.reservation.findMany({
      where: {
        status: {
          in: [ReservationStatus.PLANNED, ReservationStatus.ACTIVE, ReservationStatus.RETURNED],
        },
        fromDate: { lt: to },
        toDate: { gt: from },
      },
      select: { fromDate: true, toDate: true },
    });

    const totalUnits = Math.max(1, await this.totalActiveUnits());

    const buckets = new Map<string, number>();
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      buckets.set(d.toISOString().slice(0, 10), 0);
    }
    for (const r of reservations) {
      const start = new Date(Math.max(r.fromDate.getTime(), from.getTime()));
      const end = new Date(Math.min(r.toDate.getTime(), to.getTime()));
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }
    }

    return Array.from(buckets.entries()).map(([date, busy]) => ({
      date,
      busy,
      utilization: Math.min(100, Math.round((busy / totalUnits) * 100)),
    }));
  }
}
