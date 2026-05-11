import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReservationStatus, WarehouseItemStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  BulkCreateWarehouseItemsDto,
  CreateWarehouseItemDto,
  ListWarehouseQueryDto,
  UpdateWarehouseItemDto,
} from './dto/warehouse.dto';

/** Производный статус единицы для UI: «занята сейчас или нет». */
export type WarehouseAvailability = 'AVAILABLE' | 'RESERVED' | 'RENTED' | 'BROKEN' | 'RETIRED';

@Injectable()
export class WarehouseService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListWarehouseQueryDto) {
    const where: Prisma.WarehouseItemWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.catalogItemId) where.catalogItemId = query.catalogItemId;
    if (query.unlinkedOnly) where.catalogItemId = null;

    // Категория единицы выводится ТОЛЬКО через привязанную карточку.
    // Фильтр «по категории» собирает все единицы карточек, которые лежат
    // в этой категории или её потомках.
    if (query.categoryId) {
      const descendantIds = await this.collectCategoryDescendants(query.categoryId);
      where.catalogItem = { categoryId: { in: descendantIds } };
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { inventoryNumber: { contains: query.search, mode: 'insensitive' } },
        { serialNumber: { contains: query.search, mode: 'insensitive' } },
        { catalogItem: { name: { contains: query.search, mode: 'insensitive' } } },
        { catalogItem: { sku: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const [items, total] = await Promise.all([
      this.prisma.warehouseItem.findMany({
        where,
        orderBy: [{ status: 'asc' }, { inventoryNumber: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          catalogItem: {
            select: {
              id: true,
              sku: true,
              name: true,
              categoryId: true,
              category: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      }),
      this.prisma.warehouseItem.count({ where }),
    ]);

    // Производный статус «доступна сейчас» для каждой единицы
    const now = new Date();
    const itemIds = items.map((i) => i.id);
    const activeReservations = itemIds.length
      ? await this.prisma.reservation.findMany({
          where: {
            warehouseItemId: { in: itemIds },
            status: { in: [ReservationStatus.PLANNED, ReservationStatus.ACTIVE] },
            fromDate: { lte: now },
            toDate: { gte: now },
          },
          select: { warehouseItemId: true, status: true },
        })
      : [];
    const reservationByItem = new Map<number, ReservationStatus>(
      activeReservations.map((r) => [r.warehouseItemId, r.status]),
    );

    const enriched = items.map((it) => {
      // Категория единицы = категория её карточки (или null, если без карточки).
      const inheritedCategory = it.catalogItem?.category ?? null;
      return {
        ...it,
        category: inheritedCategory,
        categoryId: it.catalogItem?.categoryId ?? null,
        availability: deriveAvailability(it.status, reservationByItem.get(it.id) ?? null),
      };
    });

    return { items: enriched, total, page, limit };
  }

  async getById(id: number) {
    const item = await this.prisma.warehouseItem.findUnique({
      where: { id },
      include: {
        catalogItem: {
          select: {
            id: true,
            sku: true,
            name: true,
            categoryId: true,
            category: { select: { id: true, name: true, slug: true } },
          },
        },
        maintenanceLog: { orderBy: { startedAt: 'desc' } },
        reservations: {
          orderBy: { fromDate: 'desc' },
          take: 20,
          include: {
            orderLine: {
              include: {
                order: { select: { id: true, number: true, status: true, clientId: true } },
              },
            },
          },
        },
      },
    });
    if (!item) throw new NotFoundException(`Единица инвентаря #${id} не найдена`);
    return {
      ...item,
      category: item.catalogItem?.category ?? null,
      categoryId: item.catalogItem?.categoryId ?? null,
    };
  }

  async create(dto: CreateWarehouseItemDto) {
    const exists = await this.prisma.warehouseItem.findUnique({
      where: { inventoryNumber: dto.inventoryNumber },
    });
    if (exists) {
      throw new ConflictException(`Инвентарный номер "${dto.inventoryNumber}" уже занят`);
    }
    if (dto.catalogItemId) {
      await this.assertCatalogItemExists(dto.catalogItemId);
    }
    return this.prisma.warehouseItem.create({
      data: {
        name: dto.name,
        inventoryNumber: dto.inventoryNumber,
        serialNumber: dto.serialNumber,
        status: dto.status ?? WarehouseItemStatus.OPERATIONAL,
        catalogItemId: dto.catalogItemId ?? null,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
        purchasePrice: dto.purchasePrice ?? null,
        warrantyUntil: dto.warrantyUntil ? new Date(dto.warrantyUntil) : null,
        notes: dto.notes ?? null,
      },
    });
  }

  async update(id: number, dto: UpdateWarehouseItemDto) {
    const item = await this.prisma.warehouseItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Единица инвентаря #${id} не найдена`);

    if (dto.inventoryNumber && dto.inventoryNumber !== item.inventoryNumber) {
      const conflict = await this.prisma.warehouseItem.findUnique({
        where: { inventoryNumber: dto.inventoryNumber },
      });
      if (conflict) {
        throw new ConflictException(`Инвентарный номер "${dto.inventoryNumber}" уже занят`);
      }
    }

    // При попытке вывести единицу из строя (BROKEN/RETIRED) — проверим резервы.
    if (
      dto.status &&
      dto.status !== WarehouseItemStatus.OPERATIONAL &&
      item.status === WarehouseItemStatus.OPERATIONAL
    ) {
      await this.assertNoActiveReservations(id, 'смены статуса');
    }

    if (dto.catalogItemId !== undefined && dto.catalogItemId !== null) {
      await this.assertCatalogItemExists(dto.catalogItemId);
    }
    // Отвязка от карточки (catalogItemId = null) при активных резервах — запрет.
    if (dto.catalogItemId === null && item.catalogItemId !== null) {
      await this.assertNoActiveReservations(id, 'отвязки от карточки');
    }

    return this.prisma.warehouseItem.update({
      where: { id },
      data: {
        name: dto.name,
        inventoryNumber: dto.inventoryNumber,
        serialNumber: dto.serialNumber,
        status: dto.status,
        catalogItemId: dto.catalogItemId === undefined ? undefined : dto.catalogItemId,
        purchaseDate:
          dto.purchaseDate === undefined
            ? undefined
            : dto.purchaseDate === null
              ? null
              : new Date(dto.purchaseDate),
        purchasePrice: dto.purchasePrice === undefined ? undefined : dto.purchasePrice,
        warrantyUntil:
          dto.warrantyUntil === undefined
            ? undefined
            : dto.warrantyUntil === null
              ? null
              : new Date(dto.warrantyUntil),
        notes: dto.notes === undefined ? undefined : dto.notes,
      },
    });
  }

  async remove(id: number) {
    const item = await this.prisma.warehouseItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Единица инвентаря #${id} не найдена`);
    await this.assertNoActiveReservations(id, 'удаления');
    return this.prisma.warehouseItem.delete({ where: { id } });
  }

  async link(id: number, catalogItemId: number) {
    await this.assertCatalogItemExists(catalogItemId);
    return this.prisma.warehouseItem.update({
      where: { id },
      data: { catalogItemId },
    });
  }

  async unlink(id: number) {
    await this.assertNoActiveReservations(id, 'отвязки от карточки');
    return this.prisma.warehouseItem.update({
      where: { id },
      data: { catalogItemId: null },
    });
  }

  /**
   * Массовая привязка единиц склада к карточке каталога.
   * Транзакция: проверка существования карточки + updateMany.
   */
  async bulkLink(catalogItemId: number, warehouseItemIds: number[]) {
    if (warehouseItemIds.length === 0) {
      throw new BadRequestException('Не выбрано ни одной единицы');
    }
    await this.assertCatalogItemExists(catalogItemId);

    const result = await this.prisma.warehouseItem.updateMany({
      where: { id: { in: warehouseItemIds } },
      data: { catalogItemId },
    });
    return { linked: result.count };
  }

  /** Массово открепляет единицы от карточки. Запрещено для единиц с активными резервами. */
  async bulkUnlink(warehouseItemIds: number[]) {
    if (warehouseItemIds.length === 0) {
      throw new BadRequestException('Не выбрано ни одной единицы');
    }
    const blocked = await this.prisma.reservation.findMany({
      where: {
        warehouseItemId: { in: warehouseItemIds },
        status: { in: [ReservationStatus.PLANNED, ReservationStatus.ACTIVE] },
      },
      include: {
        orderLine: { include: { order: { select: { number: true } } } },
        warehouseItem: { select: { inventoryNumber: true } },
      },
    });
    if (blocked.length > 0) {
      const detail = blocked
        .map((r) => `${r.warehouseItem.inventoryNumber} (заказ ${r.orderLine.order.number})`)
        .join(', ');
      throw new BadRequestException(`Нельзя отвязать единицы с активными резервами: ${detail}`);
    }
    const result = await this.prisma.warehouseItem.updateMany({
      where: { id: { in: warehouseItemIds } },
      data: { catalogItemId: null },
    });
    return { unlinked: result.count };
  }

  /** Массовая смена физического статуса. Защищает от вывода из строя единиц с активными резервами. */
  async bulkUpdateStatus(warehouseItemIds: number[], status: WarehouseItemStatus) {
    if (warehouseItemIds.length === 0) {
      throw new BadRequestException('Не выбрано ни одной единицы');
    }
    if (status !== WarehouseItemStatus.OPERATIONAL) {
      const blocked = await this.prisma.reservation.findMany({
        where: {
          warehouseItemId: { in: warehouseItemIds },
          status: { in: [ReservationStatus.PLANNED, ReservationStatus.ACTIVE] },
        },
        include: {
          orderLine: { include: { order: { select: { number: true } } } },
          warehouseItem: { select: { inventoryNumber: true } },
        },
      });
      if (blocked.length > 0) {
        const detail = blocked
          .map((r) => `${r.warehouseItem.inventoryNumber} (${r.orderLine.order.number})`)
          .join(', ');
        throw new BadRequestException(
          `Нельзя вывести из строя единицы с активными резервами: ${detail}`,
        );
      }
    }
    const result = await this.prisma.warehouseItem.updateMany({
      where: { id: { in: warehouseItemIds } },
      data: { status },
    });
    return { updated: result.count };
  }

  /** Массовое создание единиц с авто-нумерацией. Опционально — сразу к карточке. */
  async bulkCreate(dto: BulkCreateWarehouseItemsDto) {
    if (dto.count < 1 || dto.count > 50) {
      throw new BadRequestException('Можно создать от 1 до 50 единиц за раз');
    }
    if (dto.catalogItemId) {
      await this.assertCatalogItemExists(dto.catalogItemId);
    }

    const padWidth = dto.padWidth && dto.padWidth >= 1 && dto.padWidth <= 6 ? dto.padWidth : 0;
    const numbers: string[] = [];
    for (let i = 0; i < dto.count; i++) {
      const n = (dto.startNumber + i).toString();
      const padded = padWidth > 0 ? n.padStart(padWidth, '0') : n;
      numbers.push(`${dto.prefix}${padded}`);
    }

    // Проверяем на коллизии до создания.
    const existing = await this.prisma.warehouseItem.findMany({
      where: { inventoryNumber: { in: numbers } },
      select: { inventoryNumber: true },
    });
    if (existing.length > 0) {
      throw new ConflictException(
        `Уже заняты инв.номера: ${existing.map((e) => e.inventoryNumber).join(', ')}`,
      );
    }

    const data = numbers.map((inventoryNumber) => ({
      name: dto.name,
      inventoryNumber,
      status: dto.status ?? WarehouseItemStatus.OPERATIONAL,
      catalogItemId: dto.catalogItemId ?? null,
    }));
    const result = await this.prisma.warehouseItem.createMany({ data });
    return { created: result.count, inventoryNumbers: numbers };
  }

  // -------------------- helpers --------------------

  private async assertCatalogItemExists(catalogItemId: number) {
    const exists = await this.prisma.equipment.findUnique({
      where: { id: catalogItemId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(`Карточка каталога #${catalogItemId} не найдена`);
  }

  private async assertNoActiveReservations(warehouseItemId: number, action: string) {
    const active = await this.prisma.reservation.findMany({
      where: {
        warehouseItemId,
        status: { in: [ReservationStatus.PLANNED, ReservationStatus.ACTIVE] },
      },
      include: { orderLine: { include: { order: { select: { number: true } } } } },
    });
    if (active.length > 0) {
      const orderNumbers = Array.from(new Set(active.map((r) => r.orderLine.order.number))).join(
        ', ',
      );
      throw new BadRequestException(
        `Нельзя выполнить операцию (${action}): единица назначена в активных заказах: ${orderNumbers}`,
      );
    }
  }

  /**
   * Возвращает id категории + всех её потомков (для фильтрации единиц «по категории»
   * через привязанные карточки на любой глубине дерева).
   */
  private async collectCategoryDescendants(rootId: number): Promise<number[]> {
    const all = await this.prisma.category.findMany({ select: { id: true, parentId: true } });
    const childrenByParent = new Map<number, number[]>();
    for (const c of all) {
      if (c.parentId !== null) {
        if (!childrenByParent.has(c.parentId)) childrenByParent.set(c.parentId, []);
        childrenByParent.get(c.parentId)!.push(c.id);
      }
    }
    const result: number[] = [];
    const stack = [rootId];
    while (stack.length) {
      const id = stack.pop()!;
      result.push(id);
      const ch = childrenByParent.get(id);
      if (ch) stack.push(...ch);
    }
    return result;
  }
}

function deriveAvailability(
  physicalStatus: WarehouseItemStatus,
  activeReservation: ReservationStatus | null,
): WarehouseAvailability {
  if (physicalStatus === WarehouseItemStatus.BROKEN) return 'BROKEN';
  if (physicalStatus === WarehouseItemStatus.RETIRED) return 'RETIRED';
  if (activeReservation === ReservationStatus.ACTIVE) return 'RENTED';
  if (activeReservation === ReservationStatus.PLANNED) return 'RESERVED';
  return 'AVAILABLE';
}
