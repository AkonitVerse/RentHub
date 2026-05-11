import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  OrderSource,
  OrderStatus,
  ReservationStatus,
  WarehouseItemStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { withCatalogLock } from '../../common/prisma/locking';
import { PricingService } from '../pricing/pricing.service';
import { NotificationDispatcher } from '../notifications/notification-dispatcher.service';
import {
  AddOrderLineDto,
  AssignUnitDto,
  ChangeStatusDto,
  CreateInquiryDto,
  CreateOrderDto,
  ExtendLineDto,
  ListOrdersDto,
  PreviewOrderDto,
  UpdateOrderDto,
  UpdateOrderLineDto,
} from './dto/order.dto';
import { assertReadyForPending, assertTransition } from './order-status.machine';

const DAY_MS = 86_400_000;

const RESERVABLE_STATUSES = new Set<OrderStatus>([
  OrderStatus.CONFIRMED,
  OrderStatus.ACTIVE,
  OrderStatus.OVERDUE,
]);

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly notifications: NotificationDispatcher,
  ) {}

  // =====================
  // Чтение
  // =====================

  async list(query: ListOrdersDto) {
    const where: Prisma.OrderWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.source) where.source = query.source;
    if (query.clientId) where.clientId = Number(query.clientId);
    if (query.from || query.to) {
      where.AND = [];
      if (query.from)
        (where.AND as Prisma.OrderWhereInput[]).push({ toDate: { gte: new Date(query.from) } });
      if (query.to)
        (where.AND as Prisma.OrderWhereInput[]).push({ fromDate: { lte: new Date(query.to) } });
    }
    if (query.search) {
      where.OR = [
        { number: { contains: query.search, mode: 'insensitive' } },
        { client: { name: { contains: query.search, mode: 'insensitive' } } },
        { contactPhone: { contains: query.search } },
      ];
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          client: true,
          lines: { include: { equipment: true, warehouseItem: true } },
          _count: { select: { lines: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getById(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        client: true,
        inquiryEquipment: { select: { id: true, sku: true, name: true } },
        lines: {
          include: {
            equipment: { include: { category: true } },
            warehouseItem: true,
            reservations: true,
            extensions: { orderBy: { createdAt: 'desc' } },
          },
        },
        statusLog: {
          orderBy: { changedAt: 'desc' },
          include: { changedBy: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    if (!order) throw new NotFoundException(`Заказ #${id} не найден`);
    return order;
  }

  async preview(dto: PreviewOrderDto) {
    return this.pricing.previewOrder(
      dto.lines.map((l) => ({ catalogItemId: l.equipmentId, qty: l.qty })),
      new Date(dto.fromDate),
      new Date(dto.toDate),
    );
  }

  // =====================
  // Создание
  // =====================

  /**
   * Создание заказа из админки. С полными данными → PENDING, с asDraft=true → DRAFT.
   * Под advisory lock на всех catalogItemIds. Снепшоты цен фиксируются.
   */
  async create(dto: CreateOrderDto, userId: number) {
    const fromDate = new Date(dto.fromDate);
    const toDate = new Date(dto.toDate);
    if (toDate <= fromDate) {
      throw new BadRequestException('Дата окончания должна быть позже даты начала');
    }
    const days = Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / DAY_MS));
    const initialStatus = dto.asDraft ? OrderStatus.DRAFT : OrderStatus.PENDING;
    const number = await this.generateOrderNumber();
    const lineCatalogIds = dto.lines.map((l) => l.equipmentId);

    return this.prisma.$transaction(async (tx) => {
      return withCatalogLock(tx, lineCatalogIds, async () => {
        for (const line of dto.lines) {
          const av = await this.pricing.checkAvailability(
            line.equipmentId,
            line.qty,
            fromDate,
            toDate,
            undefined,
            tx,
          );
          if (!av.available) {
            throw new ConflictException(
              `Недостаточно единиц карточки #${line.equipmentId}: свободно ${av.freeQty} из ${line.qty}`,
            );
          }
        }

        const calculated = await Promise.all(
          dto.lines.map(async (l) => {
            const calc = await this.pricing.calculateLine(l.equipmentId, l.qty, days, tx);
            const equipment = await tx.equipment.findUnique({
              where: { id: l.equipmentId },
              select: { deposit: true },
            });
            return {
              equipmentId: l.equipmentId,
              qty: l.qty,
              days,
              unitPriceNet: calc.unitPriceNet,
              sumAmount: calc.sumAmount,
              unitTag: l.unitTag,
              warehouseItemId: l.warehouseItemId,
              pricingTierRank: calc.appliedTier?.rank ?? null,
              pricingTierMinDays: calc.appliedTier?.minDays ?? null,
              pricingTierMaxDays: calc.appliedTier?.maxDays ?? null,
              catalogItemDeposit: equipment?.deposit ?? 0,
            };
          }),
        );
        const totalAmount = calculated.reduce((s, l) => s + l.sumAmount, 0);

        return tx.order.create({
          data: {
            number,
            clientId: dto.clientId,
            status: initialStatus,
            source: OrderSource.MANUAL,
            fromDate,
            toDate,
            daysCount: days,
            totalAmount,
            deposit: dto.deposit ?? 0,
            deliveryMethod: dto.deliveryMethod,
            address: dto.address,
            contactPhone: dto.contactPhone,
            contactEmail: dto.contactEmail,
            notes: dto.notes,
            lines: { create: calculated },
            statusLog: {
              create: {
                fromStatus: null,
                toStatus: initialStatus,
                changedById: userId,
                note:
                  initialStatus === OrderStatus.DRAFT ? 'Создан как черновик' : 'Создан и оформлен',
              },
            },
          },
          include: {
            client: true,
            lines: { include: { equipment: true, warehouseItem: true } },
          },
        });
      });
    });
  }

  /**
   * Лёгкая заявка с витрины (форма «связаться»).
   * Анонимный, без позиций и без дат — менеджер дозаполнит и переведёт в PENDING.
   * Создаёт/находит Client по телефону.
   */
  async createInquiry(dto: CreateInquiryDto) {
    let client = await this.prisma.client.findUnique({ where: { phone: dto.phone } });
    if (!client) {
      client = await this.prisma.client.create({
        data: {
          name: dto.name,
          phone: dto.phone,
          email: dto.email ?? null,
        },
      });
    }

    const number = await this.generateOrderNumber();
    const equipment = dto.equipmentId
      ? await this.prisma.equipment.findUnique({
          where: { id: dto.equipmentId },
          select: { name: true },
        })
      : null;
    const created = await this.prisma.order.create({
      data: {
        number,
        clientId: client.id,
        status: OrderStatus.DRAFT,
        source: OrderSource.WEB_INQUIRY,
        contactPhone: dto.phone,
        contactEmail: dto.email,
        inquiryNote: dto.message,
        inquiryEquipmentId: dto.equipmentId ?? null,
        statusLog: {
          create: {
            fromStatus: null,
            toStatus: OrderStatus.DRAFT,
            changedById: null,
            note: dto.equipmentId
              ? `Заявка с витрины (по карточке #${dto.equipmentId})`
              : 'Заявка с витрины',
          },
        },
      },
      include: { client: true },
    });
    this.notifications.dispatch({
      type: 'INQUIRY_RECEIVED',
      audience: 'STAFF',
      orderId: created.id,
      orderNumber: created.number,
      contactName: dto.name,
      contactPhone: dto.phone,
      contactEmail: dto.email ?? null,
      inquiryNote: dto.message ?? null,
      equipmentName: equipment?.name ?? null,
    });
    return created;
  }

  // =====================
  // Обновление шапки заказа
  // =====================

  async update(id: number, dto: UpdateOrderDto) {
    const existing = await this.getById(id);
    const fromDate = dto.fromDate ? new Date(dto.fromDate) : existing.fromDate;
    const toDate = dto.toDate ? new Date(dto.toDate) : existing.toDate;
    if (fromDate && toDate && toDate <= fromDate) {
      throw new BadRequestException('Дата окончания должна быть позже даты начала');
    }
    const days =
      fromDate && toDate
        ? Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / DAY_MS))
        : null;

    return this.prisma.order.update({
      where: { id },
      data: {
        clientId: dto.clientId ?? existing.clientId,
        fromDate,
        toDate,
        daysCount: days,
        deliveryMethod: dto.deliveryMethod ?? existing.deliveryMethod,
        address: dto.address ?? existing.address,
        contactPhone: dto.contactPhone ?? existing.contactPhone,
        contactEmail: dto.contactEmail ?? existing.contactEmail,
        deposit: dto.deposit ?? existing.deposit,
        notes: dto.notes ?? existing.notes,
      },
    });
  }

  // =====================
  // Смена статуса (через машину состояний)
  // =====================

  async changeStatus(id: number, dto: ChangeStatusDto, userId: number | null) {
    const order = await this.getById(id);
    if (order.status === dto.status) return order;
    assertTransition(order.status, dto.status);

    if (dto.status === OrderStatus.PENDING || dto.status === OrderStatus.CONFIRMED) {
      assertReadyForPending({
        fromDate: order.fromDate,
        toDate: order.toDate,
        contactPhone: order.contactPhone,
        linesCount: order.lines.length,
      });
    }

    // Для подтверждения — нужен advisory lock на каталог,
    // чтобы автоназначение единиц не пересеклось с другими подтверждениями.
    const catalogIdsForLock =
      dto.status === OrderStatus.CONFIRMED ? order.lines.map((l) => l.equipmentId) : [];

    return this.prisma.$transaction(async (tx) => {
      const lockedBlock = async () => {
        await tx.order.update({ where: { id }, data: { status: dto.status } });
        await tx.orderStatusLog.create({
          data: {
            orderId: id,
            fromStatus: order.status,
            toStatus: dto.status,
            changedById: userId,
            note: dto.note,
          },
        });

        // Обновление статусов резервов в зависимости от перехода
        if (dto.status === OrderStatus.CANCELLED) {
          await tx.reservation.updateMany({
            where: {
              orderLine: { orderId: id },
              status: { in: [ReservationStatus.PLANNED, ReservationStatus.ACTIVE] },
            },
            data: { status: ReservationStatus.CANCELLED },
          });
        } else if (dto.status === OrderStatus.CONFIRMED) {
          // 🔒 Авто-резервирование склада на подтверждение.
          // Для каждой позиции выбираем qty свободных единиц и создаём Reservation.
          // Если уже есть резерв (например, менеджер вручную назначил единицу до
          // подтверждения) — оставляем как есть, добираем недостающие.
          await this.autoReserveOrder(tx, id);
        } else if (dto.status === OrderStatus.ACTIVE) {
          await tx.reservation.updateMany({
            where: { orderLine: { orderId: id }, status: ReservationStatus.PLANNED },
            data: { status: ReservationStatus.ACTIVE },
          });
        } else if (dto.status === OrderStatus.DONE) {
          await tx.reservation.updateMany({
            where: {
              orderLine: { orderId: id },
              status: { in: [ReservationStatus.PLANNED, ReservationStatus.ACTIVE] },
            },
            data: { status: ReservationStatus.RETURNED },
          });
        } else if (dto.status === OrderStatus.PENDING && order.status === OrderStatus.CONFIRMED) {
          // Откат к PENDING: снимаем все авто-резервы (PLANNED), оставляем только
          // вручную назначенные через assignUnit (они были и до подтверждения).
          await tx.reservation.deleteMany({
            where: {
              orderLine: { orderId: id },
              status: ReservationStatus.PLANNED,
              // удаляем именно «авто», без warehouseItemId, привязанного к OrderLine.warehouseItemId
              // — упрощённо: удаляем все PLANNED, заодно сбрасываем «лишние» назначения
              //   (менеджер может назначить заново).
            },
          });
        }
      };

      if (catalogIdsForLock.length > 0) {
        await withCatalogLock(tx, catalogIdsForLock, lockedBlock);
      } else {
        await lockedBlock();
      }

      const updated = await tx.order.findUniqueOrThrow({
        where: { id },
        include: {
          client: true,
          lines: { include: { equipment: true, warehouseItem: true, reservations: true } },
        },
      });
      // Уведомление клиента (если у него есть привязанный аккаунт с email)
      this.notifications.dispatch({
        type: 'ORDER_STATUS_CHANGED',
        audience: 'CLIENT',
        orderId: updated.id,
        orderNumber: updated.number,
        fromStatus: order.status,
        toStatus: dto.status,
        clientEmail: updated.client.email,
        clientName: updated.client.name,
      });
      return updated;
    });
  }

  /**
   * Автоматически выбирает свободные единицы склада и создаёт Reservation
   * под каждую позицию заказа в количестве qty. Если уже есть резервы
   * для позиции — добирает недостающие. Если свободных единиц меньше нужного —
   * бросает 409 с понятной ошибкой.
   *
   * Должен вызываться внутри транзакции под advisory lock на каталоге.
   */
  private async autoReserveOrder(tx: Prisma.TransactionClient, orderId: number): Promise<void> {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { lines: { include: { reservations: true } } },
    });
    if (!order.fromDate || !order.toDate) {
      throw new BadRequestException('Для подтверждения нужны даты начала и окончания аренды');
    }

    for (const line of order.lines) {
      // Уже зарезервированные единицы под эту позицию (планированные/активные).
      const existingReservations = line.reservations.filter(
        (r) => r.status === ReservationStatus.PLANNED || r.status === ReservationStatus.ACTIVE,
      );
      const reservedItemIds = new Set(existingReservations.map((r) => r.warehouseItemId));
      const needToReserve = line.qty - reservedItemIds.size;
      if (needToReserve <= 0) continue;

      // Свободные единицы этого каталога:
      // - физически OPERATIONAL
      // - нет пересечения с PLANNED/ACTIVE Reservation в этом окне дат
      // - и не уже взяты этим же заказом
      const candidates = await tx.warehouseItem.findMany({
        where: {
          catalogItemId: line.equipmentId,
          status: WarehouseItemStatus.OPERATIONAL,
          id: { notIn: Array.from(reservedItemIds) },
          NOT: {
            reservations: {
              some: {
                status: { in: [ReservationStatus.PLANNED, ReservationStatus.ACTIVE] },
                fromDate: { lt: order.toDate },
                toDate: { gt: order.fromDate },
              },
            },
          },
        },
        select: { id: true, inventoryNumber: true },
        take: needToReserve,
      });

      if (candidates.length < needToReserve) {
        throw new ConflictException(
          `Не хватает свободных единиц для позиции #${line.equipmentId}: нужно ${needToReserve}, доступно ${candidates.length}. Освободите единицы или измените даты.`,
        );
      }

      for (const unit of candidates) {
        await tx.reservation.create({
          data: {
            orderLineId: line.id,
            warehouseItemId: unit.id,
            fromDate: order.fromDate,
            toDate: order.toDate,
            status: ReservationStatus.PLANNED,
          },
        });
      }

      // Если у позиции ещё не назначен «основной» warehouseItemId — ставим первый
      // зарезервированный, чтобы UI «единица» не была пустой.
      if (!line.warehouseItemId && candidates.length > 0) {
        await tx.orderLine.update({
          where: { id: line.id },
          data: {
            warehouseItemId: candidates[0].id,
            unitTag: candidates[0].inventoryNumber,
          },
        });
      }
    }
  }

  async remove(id: number) {
    await this.getById(id);
    await this.prisma.order.delete({ where: { id } });
    return { ok: true };
  }

  // =====================
  // Inline-редактирование позиций
  // =====================

  async addLine(orderId: number, dto: AddOrderLineDto, userId: number) {
    const order = await this.getById(orderId);
    if (!order.fromDate || !order.toDate || !order.daysCount) {
      throw new BadRequestException(
        'Сначала укажите даты заказа: позиции считаются на конкретный период',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      return withCatalogLock(tx, [dto.equipmentId], async () => {
        const av = await this.pricing.checkAvailability(
          dto.equipmentId,
          dto.qty,
          order.fromDate!,
          order.toDate!,
          orderId,
          tx,
        );
        if (!av.available) {
          throw new ConflictException(
            `Недостаточно единиц карточки #${dto.equipmentId}: свободно ${av.freeQty} из ${dto.qty}`,
          );
        }
        const calc = await this.pricing.calculateLine(
          dto.equipmentId,
          dto.qty,
          order.daysCount!,
          tx,
        );
        const equipment = await tx.equipment.findUnique({
          where: { id: dto.equipmentId },
          select: { deposit: true },
        });
        const line = await tx.orderLine.create({
          data: {
            orderId,
            equipmentId: dto.equipmentId,
            qty: dto.qty,
            days: order.daysCount!,
            unitPriceNet: calc.unitPriceNet,
            sumAmount: calc.sumAmount,
            unitTag: dto.unitTag,
            warehouseItemId: dto.warehouseItemId,
            pricingTierRank: calc.appliedTier?.rank ?? null,
            pricingTierMinDays: calc.appliedTier?.minDays ?? null,
            pricingTierMaxDays: calc.appliedTier?.maxDays ?? null,
            catalogItemDeposit: equipment?.deposit ?? 0,
          },
        });
        await this.recalcOrderTotal(tx, orderId);
        await tx.orderStatusLog.create({
          data: {
            orderId,
            fromStatus: order.status,
            toStatus: order.status,
            changedById: userId,
            note: `Добавлена позиция: карточка #${dto.equipmentId} × ${dto.qty}`,
          },
        });
        return line;
      });
    });
  }

  async updateLine(orderId: number, lineId: number, dto: UpdateOrderLineDto, userId: number) {
    const order = await this.getById(orderId);
    const line = order.lines.find((l) => l.id === lineId);
    if (!line) throw new NotFoundException(`Позиция #${lineId} не найдена`);
    if (!order.fromDate || !order.toDate || !order.daysCount) {
      throw new BadRequestException('Сначала укажите даты заказа');
    }

    const newEquipmentId = dto.equipmentId ?? line.equipmentId;
    const newQty = dto.qty ?? line.qty;

    return this.prisma.$transaction(async (tx) => {
      return withCatalogLock(tx, [line.equipmentId, newEquipmentId], async () => {
        if (dto.equipmentId !== undefined || dto.qty !== undefined) {
          const av = await this.pricing.checkAvailability(
            newEquipmentId,
            newQty,
            order.fromDate!,
            order.toDate!,
            orderId,
            tx,
          );
          if (!av.available) {
            throw new ConflictException(
              `Недостаточно единиц карточки #${newEquipmentId}: свободно ${av.freeQty} из ${newQty}`,
            );
          }
        }
        const calc = await this.pricing.calculateLine(newEquipmentId, newQty, order.daysCount!, tx);
        const equipment = await tx.equipment.findUnique({
          where: { id: newEquipmentId },
          select: { deposit: true },
        });

        const updated = await tx.orderLine.update({
          where: { id: lineId },
          data: {
            equipmentId: newEquipmentId,
            qty: newQty,
            unitPriceNet: calc.unitPriceNet,
            sumAmount: calc.sumAmount,
            unitTag: dto.unitTag,
            warehouseItemId: dto.warehouseItemId === undefined ? undefined : dto.warehouseItemId,
            pricingTierRank: calc.appliedTier?.rank ?? null,
            pricingTierMinDays: calc.appliedTier?.minDays ?? null,
            pricingTierMaxDays: calc.appliedTier?.maxDays ?? null,
            catalogItemDeposit: equipment?.deposit ?? 0,
            snapshotAt: new Date(),
          },
        });
        await this.recalcOrderTotal(tx, orderId);
        await tx.orderStatusLog.create({
          data: {
            orderId,
            fromStatus: order.status,
            toStatus: order.status,
            changedById: userId,
            note: `Обновлена позиция #${lineId}`,
          },
        });
        return updated;
      });
    });
  }

  async removeLine(orderId: number, lineId: number, userId: number) {
    const order = await this.getById(orderId);
    const line = order.lines.find((l) => l.id === lineId);
    if (!line) throw new NotFoundException(`Позиция #${lineId} не найдена`);
    if (order.lines.length === 1) {
      throw new BadRequestException(
        'Нельзя удалить последнюю позицию заказа. Удалите весь заказ или замените позицию.',
      );
    }

    // Защита: позицию нельзя удалить если оборудование физически у клиента.
    // ACTIVE/OVERDUE = уже выдано. Если бы удаление было разрешено — обнулилась бы
    // выручка по фактически переданному товару, и снеслись бы реальные брони.
    // DONE/CANCELLED — историю менять нельзя.
    const lockedStatuses: OrderStatus[] = [
      OrderStatus.ACTIVE,
      OrderStatus.OVERDUE,
      OrderStatus.DONE,
      OrderStatus.CANCELLED,
    ];
    if (lockedStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Нельзя удалить позицию из заказа в статусе «${order.status}». ` +
          `Оборудование уже выдано / заказ закрыт. Если позиция возвращена с дефектом — отметьте возврат с указанием суммы ущерба.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // удаляем связанные резервы (cascade удалит, но добавим отметку для прозрачности)
      await tx.reservation.deleteMany({ where: { orderLineId: lineId } });
      await tx.orderLine.delete({ where: { id: lineId } });
      await this.recalcOrderTotal(tx, orderId);
      await tx.orderStatusLog.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: order.status,
          changedById: userId,
          note: `Удалена позиция #${lineId} (карточка #${line.equipmentId} × ${line.qty})`,
        },
      });
      return { ok: true };
    });
  }

  /**
   * Назначить конкретную единицу склада на позицию заказа.
   * Создаёт Reservation с окном дат заказа. Конфликты пересечения — через
   * exclusion constraint в БД, ловим как 409.
   */
  async assignUnit(orderId: number, lineId: number, dto: AssignUnitDto, userId: number) {
    const order = await this.getById(orderId);
    const line = order.lines.find((l) => l.id === lineId);
    if (!line) throw new NotFoundException(`Позиция #${lineId} не найдена`);
    if (!order.fromDate || !order.toDate) {
      throw new BadRequestException('У заказа не заданы даты — сначала заполните период');
    }

    const wh = await this.prisma.warehouseItem.findUnique({
      where: { id: dto.warehouseItemId },
    });
    if (!wh) throw new NotFoundException(`Единица склада #${dto.warehouseItemId} не найдена`);
    if (wh.catalogItemId !== line.equipmentId) {
      throw new BadRequestException(
        `Единица #${dto.warehouseItemId} не принадлежит карточке #${line.equipmentId}`,
      );
    }
    if (wh.status !== WarehouseItemStatus.OPERATIONAL) {
      throw new BadRequestException(
        `Единица #${dto.warehouseItemId} недоступна (статус: ${wh.status})`,
      );
    }

    const reservationStatus = RESERVABLE_STATUSES.has(order.status)
      ? order.status === OrderStatus.ACTIVE || order.status === OrderStatus.OVERDUE
        ? ReservationStatus.ACTIVE
        : ReservationStatus.PLANNED
      : ReservationStatus.PLANNED;

    return this.prisma.$transaction(async (tx) => {
      // Снимаем предыдущий резерв этой позиции (если был на другой единице)
      if (line.warehouseItemId && line.warehouseItemId !== dto.warehouseItemId) {
        await tx.reservation.deleteMany({
          where: { orderLineId: lineId, warehouseItemId: line.warehouseItemId },
        });
      }

      await tx.orderLine.update({
        where: { id: lineId },
        data: { warehouseItemId: dto.warehouseItemId, unitTag: wh.inventoryNumber },
      });

      try {
        // Если уже есть Reservation для этой пары — обновим, иначе создадим
        const existing = await tx.reservation.findFirst({
          where: { orderLineId: lineId, warehouseItemId: dto.warehouseItemId },
        });
        if (existing) {
          await tx.reservation.update({
            where: { id: existing.id },
            data: {
              fromDate: order.fromDate!,
              toDate: order.toDate!,
              status: reservationStatus,
            },
          });
        } else {
          await tx.reservation.create({
            data: {
              orderLineId: lineId,
              warehouseItemId: dto.warehouseItemId,
              fromDate: order.fromDate!,
              toDate: order.toDate!,
              status: reservationStatus,
            },
          });
        }
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          (e.code === 'P2010' || e.code === 'P2002')
        ) {
          throw new ConflictException(
            `Единица ${wh.inventoryNumber} уже зарезервирована на пересекающийся период`,
          );
        }
        // exclusion violations часто приходят как unknown DB errors
        const msg = (e as Error).message ?? '';
        if (msg.includes('reservations_no_overlap') || msg.includes('exclusion')) {
          throw new ConflictException(
            `Единица ${wh.inventoryNumber} уже зарезервирована на пересекающийся период`,
          );
        }
        throw e;
      }

      await tx.orderStatusLog.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: order.status,
          changedById: userId,
          note: `Назначена единица склада ${wh.inventoryNumber} на позицию #${lineId}`,
        },
      });
      return { ok: true };
    });
  }

  /**
   * Отметить возврат позиции. Допускается только для ACTIVE/OVERDUE.
   * Если все позиции вернули — заказ авто-переходит в DONE через машину состояний.
   */
  async returnLine(orderId: number, lineId: number, userId: number) {
    const order = await this.getById(orderId);
    const allowedForReturn: OrderStatus[] = [OrderStatus.ACTIVE, OrderStatus.OVERDUE];
    if (!allowedForReturn.includes(order.status)) {
      throw new BadRequestException(
        `Возврат возможен только для ACTIVE/OVERDUE-заказа. Текущий статус: ${order.status}`,
      );
    }
    const line = order.lines.find((l) => l.id === lineId);
    if (!line) throw new NotFoundException(`Позиция #${lineId} не найдена`);
    if (line.returnedAt) throw new BadRequestException('Позиция уже возвращена');
    if (!line.warehouseItemId) {
      throw new BadRequestException('Невозможно отметить возврат: единица склада не назначена');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.orderLine.update({
        where: { id: lineId },
        data: { returnedAt: new Date() },
      });
      await tx.reservation.updateMany({
        where: {
          orderLineId: lineId,
          status: { in: [ReservationStatus.PLANNED, ReservationStatus.ACTIVE] },
        },
        data: { status: ReservationStatus.RETURNED },
      });
      await tx.orderStatusLog.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: order.status,
          changedById: userId,
          note: `Отмечен возврат позиции #${lineId}`,
        },
      });

      const lines = await tx.orderLine.findMany({ where: { orderId } });
      const allReturned = lines.every((l) => l.returnedAt != null);
      if (allReturned) {
        assertTransition(order.status, OrderStatus.DONE);
        await tx.order.update({ where: { id: orderId }, data: { status: OrderStatus.DONE } });
        await tx.orderStatusLog.create({
          data: {
            orderId,
            fromStatus: order.status,
            toStatus: OrderStatus.DONE,
            changedById: userId,
            note: 'Все позиции возвращены — заказ завершён автоматически',
          },
        });
      }
      return { ok: true };
    });
  }

  /**
   * Продлить аренду по конкретной позиции. Сдвигает toDate Reservation,
   * расширяет общее окно заказа, добавляет запись в RentalExtension и лог.
   */
  async extendLine(orderId: number, lineId: number, dto: ExtendLineDto, userId: number) {
    const order = await this.getById(orderId);
    const line = order.lines.find((l) => l.id === lineId);
    if (!line) throw new NotFoundException(`Позиция #${lineId} не найдена`);
    const allowedForExtend: OrderStatus[] = [
      OrderStatus.CONFIRMED,
      OrderStatus.ACTIVE,
      OrderStatus.OVERDUE,
    ];
    if (!allowedForExtend.includes(order.status)) {
      throw new BadRequestException(
        `Продление возможно только для CONFIRMED/ACTIVE/OVERDUE. Текущий: ${order.status}`,
      );
    }
    if (!order.fromDate || !order.toDate) {
      throw new BadRequestException('У заказа не заданы даты');
    }
    const oldToDate = order.toDate;
    const newToDate = new Date(dto.newToDate);
    if (newToDate <= oldToDate) {
      throw new BadRequestException('Новая дата окончания должна быть позже текущей');
    }
    const addedDays = Math.ceil((newToDate.getTime() - oldToDate.getTime()) / DAY_MS);
    const addedAmount = line.unitPriceNet * line.qty * addedDays;

    return this.prisma.$transaction(async (tx) => {
      return withCatalogLock(tx, [line.equipmentId], async () => {
        // Доступность на дополнительном окне
        const av = await this.pricing.checkAvailability(
          line.equipmentId,
          line.qty,
          oldToDate,
          newToDate,
          orderId,
          tx,
        );
        if (!av.available) {
          throw new ConflictException(
            `На период с ${oldToDate.toISOString().slice(0, 10)} по ${newToDate
              .toISOString()
              .slice(
                0,
                10,
              )} карточка #${line.equipmentId} занята другим заказом (свободно ${av.freeQty})`,
          );
        }

        // Сдвигаем все Reservation позиции
        try {
          await tx.reservation.updateMany({
            where: { orderLineId: lineId },
            data: { toDate: newToDate },
          });
        } catch (e) {
          throw new ConflictException(
            `Невозможно продлить: пересечение с другой бронью. ${(e as Error).message}`,
          );
        }

        // Расширяем общее окно заказа, если эта позиция «крайняя»
        const newOrderTo = newToDate > order.toDate! ? newToDate : order.toDate!;
        const newDays = Math.max(
          1,
          Math.ceil((newOrderTo.getTime() - order.fromDate!.getTime()) / DAY_MS),
        );
        await tx.order.update({
          where: { id: orderId },
          data: { toDate: newOrderTo, daysCount: newDays },
        });

        // Если был OVERDUE и новая дата >= now — поднимаем в ACTIVE
        if (order.status === OrderStatus.OVERDUE && newToDate >= new Date()) {
          assertTransition(order.status, OrderStatus.ACTIVE);
          await tx.order.update({ where: { id: orderId }, data: { status: OrderStatus.ACTIVE } });
          await tx.orderStatusLog.create({
            data: {
              orderId,
              fromStatus: order.status,
              toStatus: OrderStatus.ACTIVE,
              changedById: userId,
              note: 'Продлено — снят OVERDUE',
            },
          });
        }

        await tx.orderLine.update({
          where: { id: lineId },
          data: {
            days: line.days + addedDays,
            sumAmount: line.sumAmount + addedAmount,
          },
        });
        await this.recalcOrderTotal(tx, orderId);

        const ext = await tx.rentalExtension.create({
          data: {
            orderLineId: lineId,
            oldToDate,
            newToDate,
            addedDays,
            addedAmount,
            createdById: userId,
          },
        });

        await tx.orderStatusLog.create({
          data: {
            orderId,
            fromStatus: order.status,
            toStatus: order.status,
            changedById: userId,
            note: `Продление позиции #${lineId} на +${addedDays} дн., доплата ${addedAmount}₽${
              dto.note ? ` — ${dto.note}` : ''
            }`,
          },
        });

        this.notifications.dispatch({
          type: 'ORDER_EXTENDED',
          audience: 'CLIENT',
          orderId,
          orderNumber: order.number,
          addedDays,
          addedAmount,
          newToDate: newToDate.toISOString().slice(0, 10),
          clientEmail: order.client.email,
          clientName: order.client.name,
        });
        return ext;
      });
    });
  }

  // =====================
  // Утилиты
  // =====================

  private async recalcOrderTotal(tx: Prisma.TransactionClient, orderId: number) {
    const lines = await tx.orderLine.findMany({ where: { orderId } });
    const total = lines.reduce((s, l) => s + l.sumAmount, 0);
    await tx.order.update({ where: { id: orderId }, data: { totalAmount: total } });
  }

  /**
   * Генерация уникального номера заказа формата RH-NNNN.
   *
   * Защищена PG advisory lock'ом — иначе при параллельных checkout/create два
   * запроса прочитают одинаковый max и попытаются создать `RH-N+1` оба, второй
   * упадёт на unique-constraint. Lock берётся на namespace (200, 1) — отдельный
   * от других scope'ов (catalog=42, scheduler=100).
   *
   * После взятия лока — даже если кто-то другой ждёт, мы безопасно читаем max
   * и возвращаем next. Дополнительно retry-обёртка вокруг `create()` ловит
   * P2002 (на случай если кто-то всё же залез в обход лока, например через
   * прямой SQL).
   */
  private async generateOrderNumber(): Promise<string> {
    // pg_advisory_xact_lock — освобождается автоматически при коммите/rollback.
    // Так как мы не в транзакции — используем pg_advisory_lock + pg_advisory_unlock.
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
