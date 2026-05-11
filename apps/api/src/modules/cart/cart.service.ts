import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderSource, OrderStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { withCatalogLock } from '../../common/prisma/locking';
import { PricingService } from '../pricing/pricing.service';
import { ClientLinkingService } from '../clients/client-linking.service';
import { NotificationDispatcher } from '../notifications/notification-dispatcher.service';
import { CartStoreService, CartLine } from './cart-store.service';
import { AddCartLineDto, CheckoutDto, UpdateCartLineDto } from './dto/cart.dto';

export interface CartLineComputed {
  catalogItemId: number;
  qty: number;
  fromDate: string;
  toDate: string;
  addedAt: string;
  // расчёт
  days: number;
  unitPriceNet: number;
  sumAmount: number;
  // данные карточки
  name: string;
  sku: string;
  deposit: number;
  photo: string | null;
  // доступность
  available: boolean;
  freeQty: number;
  // тариф (для отображения «по какому тиру посчитано»)
  tierRank: number | null;
  tierMinDays: number | null;
  tierMaxDays: number | null;
}

export interface CartView {
  sessionId: string;
  lines: CartLineComputed[];
  totalAmount: number;
  totalDeposit: number;
  totalQty: number;
  updatedAt: string;
  hasIssues: boolean;
}

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly store: CartStoreService,
    private readonly clientLinking: ClientLinkingService,
    private readonly notifications: NotificationDispatcher,
  ) {}

  /** Возвращает корзину с расчётами (цены по тирам, доступность). */
  async view(sessionId: string): Promise<CartView> {
    const cart = await this.store.get(sessionId);
    return this.compute(cart.sessionId, cart.lines, cart.updatedAt);
  }

  private async compute(
    sessionId: string,
    lines: CartLine[],
    updatedAt: string,
  ): Promise<CartView> {
    const computed: CartLineComputed[] = [];
    let totalAmount = 0;
    let totalDeposit = 0;
    let totalQty = 0;
    let hasIssues = false;

    for (const line of lines) {
      const item = await this.prisma.equipment.findUnique({
        where: { id: line.catalogItemId },
      });
      if (!item || !item.isActive) {
        hasIssues = true;
        computed.push({
          ...line,
          days: 0,
          unitPriceNet: 0,
          sumAmount: 0,
          name: item?.name ?? 'Карточка удалена',
          sku: item?.sku ?? '',
          deposit: 0,
          photo: null,
          available: false,
          freeQty: 0,
          tierRank: null,
          tierMinDays: null,
          tierMaxDays: null,
        });
        totalQty += line.qty;
        continue;
      }

      const fromDate = new Date(line.fromDate);
      const toDate = new Date(line.toDate);
      const days = Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / 86_400_000));

      let unitPriceNet = 0;
      let sumAmount = 0;
      let available = false;
      let freeQty = 0;
      let tierRank: number | null = null;
      let tierMinDays: number | null = null;
      let tierMaxDays: number | null = null;
      try {
        const calc = await this.pricing.calculateLine(line.catalogItemId, line.qty, days);
        unitPriceNet = calc.unitPriceNet;
        sumAmount = calc.sumAmount;
        tierRank = calc.appliedTier?.rank ?? null;
        tierMinDays = calc.appliedTier?.minDays ?? null;
        tierMaxDays = calc.appliedTier?.maxDays ?? null;
        const av = await this.pricing.checkAvailability(
          line.catalogItemId,
          line.qty,
          fromDate,
          toDate,
        );
        available = av.available;
        freeQty = av.freeQty;
        if (!available) hasIssues = true;
      } catch {
        hasIssues = true;
      }
      totalAmount += sumAmount;
      totalDeposit += item.deposit * line.qty;
      totalQty += line.qty;

      const photos = (item.photos as string[] | null) ?? [];
      computed.push({
        ...line,
        days,
        unitPriceNet,
        sumAmount,
        name: item.name,
        sku: item.sku,
        deposit: item.deposit,
        photo: photos[0] ?? null,
        available,
        freeQty,
        tierRank,
        tierMinDays,
        tierMaxDays,
      });
    }

    return {
      sessionId,
      lines: computed,
      totalAmount,
      totalDeposit,
      totalQty,
      updatedAt,
      hasIssues,
    };
  }

  async addLine(sessionId: string, dto: AddCartLineDto): Promise<CartView> {
    const fromDate = new Date(dto.fromDate);
    const toDate = new Date(dto.toDate);
    if (toDate <= fromDate) {
      throw new BadRequestException('Дата окончания должна быть позже даты начала');
    }

    const item = await this.prisma.equipment.findUnique({ where: { id: dto.catalogItemId } });
    if (!item) throw new NotFoundException(`Карточка #${dto.catalogItemId} не найдена`);
    if (!item.isActive) {
      throw new BadRequestException(`Карточка "${item.name}" неактивна`);
    }

    const cart = await this.store.get(sessionId);
    // Если эта же карточка уже есть с теми же датами — увеличиваем qty
    const existing = cart.lines.find(
      (l) =>
        l.catalogItemId === dto.catalogItemId &&
        l.fromDate === dto.fromDate &&
        l.toDate === dto.toDate,
    );
    if (existing) {
      existing.qty += dto.qty;
    } else {
      cart.lines.push({
        catalogItemId: dto.catalogItemId,
        qty: dto.qty,
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
        addedAt: new Date().toISOString(),
      });
    }
    await this.store.save(cart);
    return this.view(sessionId);
  }

  async updateLine(sessionId: string, idx: number, dto: UpdateCartLineDto): Promise<CartView> {
    const cart = await this.store.get(sessionId);
    const line = cart.lines[idx];
    if (!line) throw new NotFoundException(`Позиция #${idx} не найдена в корзине`);

    if (dto.qty !== undefined) line.qty = dto.qty;
    if (dto.fromDate !== undefined) line.fromDate = new Date(dto.fromDate).toISOString();
    if (dto.toDate !== undefined) line.toDate = new Date(dto.toDate).toISOString();
    if (new Date(line.toDate) <= new Date(line.fromDate)) {
      throw new BadRequestException('Дата окончания должна быть позже даты начала');
    }
    await this.store.save(cart);
    return this.view(sessionId);
  }

  async removeLine(sessionId: string, idx: number): Promise<CartView> {
    const cart = await this.store.get(sessionId);
    if (idx < 0 || idx >= cart.lines.length) {
      throw new NotFoundException(`Позиция #${idx} не найдена`);
    }
    cart.lines.splice(idx, 1);
    await this.store.save(cart);
    return this.view(sessionId);
  }

  async clear(sessionId: string): Promise<CartView> {
    await this.store.clear(sessionId);
    return this.view(sessionId);
  }

  /**
   * Оформление заказа из корзины.
   * - Под advisory lock на всех catalogItemIds: проверка доступности и create заказа атомарны.
   * - Клиент резолвится через ClientLinkingService (по userId, телефону или из новой карточки).
   * - Заказ создаётся со статусом PENDING (ожидает подтверждения менеджера) и source=WEB_CART.
   * - Снепшоты цен фиксируются в OrderLine.
   */
  async checkout(
    sessionId: string,
    dto: CheckoutDto,
    userId?: number,
  ): Promise<{ orderId: number; orderNumber: string }> {
    const cart = await this.store.get(sessionId);
    if (cart.lines.length === 0) {
      throw new BadRequestException('Корзина пуста');
    }

    const fromDates = cart.lines.map((l) => new Date(l.fromDate));
    const toDates = cart.lines.map((l) => new Date(l.toDate));
    const fromDate = new Date(Math.min(...fromDates.map((d) => d.getTime())));
    const toDate = new Date(Math.max(...toDates.map((d) => d.getTime())));
    const days = Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / 86_400_000));

    const lineCatalogIds = cart.lines.map((l) => l.catalogItemId);
    const orderNumber = await this.generateOrderNumber();

    const order = await this.prisma.$transaction(async (tx) => {
      return withCatalogLock(tx, lineCatalogIds, async () => {
        // Проверяем доступность под локом
        for (const line of cart.lines) {
          const av = await this.pricing.checkAvailability(
            line.catalogItemId,
            line.qty,
            new Date(line.fromDate),
            new Date(line.toDate),
            undefined,
            tx,
          );
          if (!av.available) {
            throw new ConflictException(
              `Недостаточно единиц карточки #${line.catalogItemId}: свободно ${av.freeQty} из ${line.qty}`,
            );
          }
        }

        // Считаем строки со снепшотами
        const calculatedLines = await Promise.all(
          cart.lines.map(async (l) => {
            const lineDays = Math.max(
              1,
              Math.ceil(
                (new Date(l.toDate).getTime() - new Date(l.fromDate).getTime()) / 86_400_000,
              ),
            );
            const calc = await this.pricing.calculateLine(l.catalogItemId, l.qty, lineDays, tx);
            const equipment = await tx.equipment.findUnique({
              where: { id: l.catalogItemId },
              select: { deposit: true },
            });
            return {
              equipmentId: l.catalogItemId,
              qty: l.qty,
              days: lineDays,
              unitPriceNet: calc.unitPriceNet,
              sumAmount: calc.sumAmount,
              pricingTierRank: calc.appliedTier?.rank ?? null,
              pricingTierMinDays: calc.appliedTier?.minDays ?? null,
              pricingTierMaxDays: calc.appliedTier?.maxDays ?? null,
              catalogItemDeposit: equipment?.deposit ?? 0,
            };
          }),
        );
        const totalAmount = calculatedLines.reduce((s, l) => s + l.sumAmount, 0);

        // Залог
        const itemIds = Array.from(new Set(cart.lines.map((l) => l.catalogItemId)));
        const items = await tx.equipment.findMany({
          where: { id: { in: itemIds } },
          select: { id: true, deposit: true },
        });
        const depositById = new Map(items.map((i) => [i.id, i.deposit]));
        const totalDeposit = cart.lines.reduce(
          (s, l) => s + (depositById.get(l.catalogItemId) ?? 0) * l.qty,
          0,
        );

        // Резолв клиента
        const client = await this.clientLinking.resolveForCheckout(
          userId,
          {
            name: dto.clientData?.name ?? dto.contactPhone,
            phone: dto.clientData?.phone ?? dto.contactPhone,
            email: dto.clientData?.email ?? dto.contactEmail ?? null,
          },
          tx,
        );

        return tx.order.create({
          data: {
            number: orderNumber,
            clientId: client.id,
            status: OrderStatus.PENDING,
            source: OrderSource.WEB_CART,
            fromDate,
            toDate,
            daysCount: days,
            totalAmount,
            deposit: totalDeposit,
            deliveryMethod: dto.deliveryMethod,
            address: dto.address,
            contactPhone: dto.contactPhone,
            contactEmail: dto.contactEmail,
            notes: dto.notes,
            lines: { create: calculatedLines },
            statusLog: {
              create: {
                fromStatus: null,
                toStatus: OrderStatus.PENDING,
                changedById: userId ?? null,
                note: 'Заказ оформлен из корзины',
              },
            },
          },
        });
      });
    });

    await this.store.clear(sessionId);

    // Уведомление менеджеров о новом заказе с витрины
    const fullOrder = await this.prisma.order.findUnique({
      where: { id: order.id },
      include: { client: true },
    });
    if (fullOrder) {
      this.notifications.dispatch({
        type: 'ORDER_CREATED',
        audience: 'STAFF',
        orderId: fullOrder.id,
        orderNumber: fullOrder.number,
        source: fullOrder.source,
        clientName: fullOrder.client.name,
        totalAmount: fullOrder.totalAmount,
        fromDate: fullOrder.fromDate?.toISOString() ?? null,
        toDate: fullOrder.toDate?.toISOString() ?? null,
      });
    }
    return { orderId: order.id, orderNumber: order.number };
  }

  /**
   * Генерация уникального номера заказа. Защищена PG advisory lock'ом —
   * иначе при параллельных checkout два запроса прочитают одинаковый max
   * и упадут на unique-constraint. Lock тот же, что в OrdersService — namespace (200, 1).
   */
  private async generateOrderNumber(): Promise<string> {
    await this.prisma.$executeRaw`SELECT pg_advisory_lock(200, 1)`;
    try {
      const orders = await this.prisma.order.findMany({ select: { number: true } });
      let max = 2840;
      for (const o of orders) {
        const m = o.number.match(/^RH-(\d{3,})$/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (Number.isFinite(n) && n > max) max = n;
        }
      }
      return `RH-${max + 1}`;
    } finally {
      await this.prisma.$executeRaw`SELECT pg_advisory_unlock(200, 1)`;
    }
  }
}
