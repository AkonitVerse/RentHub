import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PricingTier, ReservationStatus, WarehouseItemStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface LinePriceResult {
  unitPriceNet: number;
  sumAmount: number;
  appliedTier: PricingTier | null;
}

export interface AvailabilityResult {
  available: boolean;
  busyQty: number;
  totalUnits: number;
  freeQty: number;
}

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Подбирает применимый тариф (rank) для заданного количества дней.
   */
  async resolveTier(
    days: number,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<PricingTier | null> {
    if (days < 1) throw new BadRequestException('Срок аренды не может быть меньше 1 дня');
    const tiers = await db.pricingTier.findMany({ orderBy: { rank: 'asc' } });
    return tiers.find((t) => days >= t.minDays && (t.maxDays == null || days <= t.maxDays)) ?? null;
  }

  /**
   * Возвращает цену за день для конкретной карточки на заданный срок.
   * Читает CatalogItemPrice; если нет цены для подходящего тира — ошибка.
   */
  async resolveDailyPrice(
    catalogItemId: number,
    days: number,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<{ price: number; tier: PricingTier | null }> {
    const tier = await this.resolveTier(days, db);
    if (!tier) {
      throw new BadRequestException('Нет ни одного ценового тира — настройте тарифы');
    }

    const priceRow = await db.catalogItemPrice.findUnique({
      where: { catalogItemId_tierId: { catalogItemId, tierId: tier.id } },
    });
    if (!priceRow) {
      throw new BadRequestException(
        `Цена для тира ${tier.rank} у карточки #${catalogItemId} не настроена`,
      );
    }
    return { price: priceRow.pricePerDay, tier };
  }

  /**
   * Рассчитывает сумму одной позиции заказа: цена за день × количество × дни.
   */
  async calculateLine(
    catalogItemId: number,
    qty: number,
    days: number,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<LinePriceResult> {
    if (qty < 1) throw new BadRequestException('Количество должно быть ≥ 1');
    const { price, tier } = await this.resolveDailyPrice(catalogItemId, days, db);
    const unitPriceNet = price;
    const sumAmount = unitPriceNet * qty * days;
    return { unitPriceNet, sumAmount, appliedTier: tier };
  }

  /**
   * Доступно ли указанное количество единиц карточки на интервале [from..to].
   *
   * Алгоритм:
   *   totalUnits = OPERATIONAL единицы карточки
   *   busyUnits  = из них те, у которых есть пересекающийся Reservation
   *                в статусах PLANNED или ACTIVE (с опц. exclusion заказа)
   *   available  = (totalUnits - busyUnits) >= qty
   *
   * Логика опирается на Reservation, а не на WarehouseItem.status:
   * статус единицы — это её физическое состояние, а не «занятость».
   */
  async checkAvailability(
    catalogItemId: number,
    qty: number,
    fromDate: Date,
    toDate: Date,
    excludeOrderId?: number,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<AvailabilityResult> {
    const equipment = await db.equipment.findUnique({
      where: { id: catalogItemId },
      select: { id: true, isActive: true },
    });
    if (!equipment) throw new NotFoundException(`Карточка #${catalogItemId} не найдена`);
    if (!equipment.isActive) {
      return { available: false, busyQty: 0, totalUnits: 0, freeQty: 0 };
    }

    const totalUnits = await db.warehouseItem.count({
      where: { catalogItemId, status: WarehouseItemStatus.OPERATIONAL },
    });

    const busyUnits = await db.warehouseItem.count({
      where: {
        catalogItemId,
        status: WarehouseItemStatus.OPERATIONAL,
        reservations: {
          some: {
            status: { in: [ReservationStatus.PLANNED, ReservationStatus.ACTIVE] },
            fromDate: { lt: toDate },
            toDate: { gt: fromDate },
            ...(excludeOrderId ? { orderLine: { orderId: { not: excludeOrderId } } } : {}),
          },
        },
      },
    });

    const freeQty = Math.max(0, totalUnits - busyUnits);
    return { available: freeQty >= qty, busyQty: busyUnits, totalUnits, freeQty };
  }

  /**
   * Возвращает массив дат, в которые все единицы заняты — для календаря на витрине.
   * Окно [from..to] просматривается посуточно по UTC.
   */
  async getBusyDates(catalogItemId: number, from: Date, to: Date): Promise<Date[]> {
    const totalUnits = await this.prisma.warehouseItem.count({
      where: { catalogItemId, status: WarehouseItemStatus.OPERATIONAL },
    });
    if (totalUnits === 0) return [];

    const reservations = await this.prisma.reservation.findMany({
      where: {
        warehouseItem: { catalogItemId },
        status: { in: [ReservationStatus.PLANNED, ReservationStatus.ACTIVE] },
        fromDate: { lt: to },
        toDate: { gt: from },
      },
      select: { fromDate: true, toDate: true },
    });

    const busyByDay = new Map<string, number>();
    for (const r of reservations) {
      const start = new Date(Math.max(r.fromDate.getTime(), from.getTime()));
      const end = new Date(Math.min(r.toDate.getTime(), to.getTime()));
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        busyByDay.set(key, (busyByDay.get(key) ?? 0) + 1);
      }
    }

    return Array.from(busyByDay.entries())
      .filter(([, count]) => count >= totalUnits)
      .map(([key]) => new Date(`${key}T00:00:00.000Z`));
  }

  /**
   * Расчёт превью заказа без сохранения в БД.
   */
  async previewOrder(
    lines: Array<{ catalogItemId: number; qty: number }>,
    fromDate: Date,
    toDate: Date,
  ): Promise<{
    days: number;
    lines: Array<LinePriceResult & { catalogItemId: number; qty: number; days: number }>;
    totalAmount: number;
  }> {
    const days = Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / 86_400_000));
    const calculated = await Promise.all(
      lines.map(async (line) => {
        const result = await this.calculateLine(line.catalogItemId, line.qty, days);
        return { ...result, catalogItemId: line.catalogItemId, qty: line.qty, days };
      }),
    );
    const totalAmount = calculated.reduce((acc, l) => acc + l.sumAmount, 0);
    return { days, lines: calculated, totalAmount };
  }
}
