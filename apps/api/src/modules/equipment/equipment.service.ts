import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma, ReservationStatus, WarehouseItemStatus } from '@prisma/client';
import { randomInt } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { TiersService } from '../pricing/tiers.service';
import { CategoriesService } from '../categories/categories.service';
import {
  CreateEquipmentDto,
  ListEquipmentDto,
  StartMaintenanceDto,
  UpdateEquipmentDto,
} from './dto/equipment.dto';

@Injectable()
export class EquipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly tiers: TiersService,
    private readonly categories: CategoriesService,
  ) {}

  async list(query: ListEquipmentDto) {
    const where: Prisma.EquipmentWhereInput = {};
    if (query.categoryId) {
      // Если категория не лист — фильтруем по всему поддереву.
      // Так клик «Электроинструменты» показывает товары всех Дрелей/Перфораторов и их подвидов.
      const ids = await this.categories.descendantIds(Number(query.categoryId));
      where.categoryId = { in: ids };
    }
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.isFeatured !== undefined) where.isFeatured = query.isFeatured;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 24, 200);

    // Сортировка: name | rating | new | price (тир 1) — последняя считается клиентски,
    // потому что цена тира хранится в отдельной таблице и не подходит под orderBy Prisma напрямую.
    const orderBy: Prisma.EquipmentOrderByWithRelationInput = (() => {
      const raw = query.sort?.trim();
      if (!raw) return { name: 'asc' };
      const desc = raw.startsWith('-');
      const key = desc ? raw.slice(1) : raw;
      switch (key) {
        case 'name':
          return { name: desc ? 'desc' : 'asc' };
        case 'rating':
          return { rating: desc ? 'desc' : 'asc' };
        case 'new':
        case 'createdAt':
          return { createdAt: desc ? 'desc' : 'asc' };
        default:
          return { name: 'asc' };
      }
    })();

    const [items, total] = await Promise.all([
      this.prisma.equipment.findMany({
        where,
        include: {
          category: true,
          prices: { include: { tier: true } },
          _count: { select: { warehouseItems: true } },
        },
        orderBy,
        skip: query.sort === 'price' || query.sort === '-price' ? 0 : (page - 1) * limit,
        take: query.sort === 'price' || query.sort === '-price' ? undefined : limit,
      }),
      this.prisma.equipment.count({ where }),
    ]);

    // Сортировка по цене тира 1 — клиентская
    let ordered = items;
    if (query.sort === 'price' || query.sort === '-price') {
      const desc = query.sort === '-price';
      ordered = [...items].sort((a, b) => {
        const ap = a.prices.find((p) => p.tier?.rank === 1)?.pricePerDay ?? 0;
        const bp = b.prices.find((p) => p.tier?.rank === 1)?.pricePerDay ?? 0;
        return desc ? bp - ap : ap - bp;
      });
      ordered = ordered.slice((page - 1) * limit, page * limit);
    }

    // Доступность: считаем OPERATIONAL единицы для каждой карточки.
    // Если задан availableFrom/availableTo — вычитаем занятые на этом окне.
    const ids = ordered.map((i) => i.id);
    const availableMap = new Map<number, number>();
    const totalMap = new Map<number, number>();
    if (ids.length > 0) {
      const grouped = await this.prisma.warehouseItem.groupBy({
        by: ['catalogItemId'],
        where: {
          catalogItemId: { in: ids },
          status: WarehouseItemStatus.OPERATIONAL,
        },
        _count: { id: true },
      });
      for (const g of grouped) {
        if (g.catalogItemId != null) {
          totalMap.set(g.catalogItemId, g._count.id);
          availableMap.set(g.catalogItemId, g._count.id);
        }
      }

      if (query.availableFrom && query.availableTo) {
        const from = new Date(query.availableFrom);
        const to = new Date(query.availableTo);
        if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to > from) {
          const busyGrouped = await this.prisma.warehouseItem.groupBy({
            by: ['catalogItemId'],
            where: {
              catalogItemId: { in: ids },
              status: WarehouseItemStatus.OPERATIONAL,
              reservations: {
                some: {
                  status: { in: [ReservationStatus.PLANNED, ReservationStatus.ACTIVE] },
                  fromDate: { lt: to },
                  toDate: { gt: from },
                },
              },
            },
            _count: { id: true },
          });
          for (const g of busyGrouped) {
            if (g.catalogItemId != null) {
              const total = totalMap.get(g.catalogItemId) ?? 0;
              availableMap.set(g.catalogItemId, Math.max(0, total - g._count.id));
            }
          }
        }
      }
    }

    let withAvailability = ordered.map((it) => ({
      ...it,
      availableUnits: availableMap.get(it.id) ?? 0,
      totalUnits: totalMap.get(it.id) ?? 0,
    }));

    // Если задан availableFrom/availableTo, фильтруем по доступности > 0
    if (query.availableFrom && query.availableTo) {
      withAvailability = withAvailability.filter((it) => it.availableUnits > 0);
    }

    return {
      items: withAvailability,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async getById(id: number) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { id },
      include: {
        category: true,
        prices: { include: { tier: true }, orderBy: { tier: { rank: 'asc' } } },
        warehouseItems: { orderBy: { inventoryNumber: 'asc' } },
      },
    });
    if (!equipment) throw new NotFoundException(`Карточка #${id} не найдена`);

    const totalUnits = equipment.warehouseItems.length;
    const availableUnits = equipment.warehouseItems.filter(
      (w) => w.status === WarehouseItemStatus.OPERATIONAL,
    ).length;

    return { ...equipment, totalUnits, availableUnits };
  }

  async create(dto: CreateEquipmentDto) {
    const { basePrice, ...data } = dto;
    if (!data.categoryId) {
      throw new BadRequestException(
        'Категория обязательна — каждая карточка каталога должна быть в листовой категории',
      );
    }
    await this.assertLeafCategory(data.categoryId);
    // SKU: если не задан — генерируем уникальный «EQ-NNNNNN». Если задан — используем как есть.
    const sku = data.sku?.trim() ? data.sku.trim() : await this.generateSku();
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.equipment.create({
        data: {
          sku,
          name: data.name,
          categoryId: data.categoryId,
          description: data.description,
          fullDesc: data.fullDesc,
          deposit: data.deposit ?? 0,
          isActive: data.isActive ?? true,
          specs: data.specs ?? undefined,
          photos: [],
        },
      });
      // Сохраняем цену тира 1
      const tiers = await tx.pricingTier.findMany({ orderBy: { rank: 'asc' } });
      if (tiers.length === 0) {
        throw new BadRequestException(
          'Нет ни одного ценового тира — создайте тир перед добавлением карточки',
        );
      }
      await tx.catalogItemPrice.create({
        data: { catalogItemId: created.id, tierId: tiers[0].id, pricePerDay: basePrice },
      });
      return created;
    });
  }

  async update(id: number, dto: UpdateEquipmentDto) {
    await this.ensureExists(id);
    const { basePrice, ...rest } = dto;
    if (rest.categoryId) {
      await this.assertLeafCategory(rest.categoryId);
    }
    if (rest.isActive === true) {
      await this.assertCanActivate(id, basePrice);
    }
    const updated = await this.prisma.equipment.update({
      where: { id },
      data: {
        sku: rest.sku,
        name: rest.name,
        categoryId: rest.categoryId === undefined ? undefined : rest.categoryId,
        description: rest.description,
        fullDesc: rest.fullDesc,
        deposit: rest.deposit,
        isActive: rest.isActive,
        specs: rest.specs ?? undefined,
      },
    });
    if (basePrice !== undefined) {
      await this.tiers.setBasePrice(id, basePrice);
    }
    return updated;
  }

  /**
   * Возвращает статус готовности карточки к активации.
   * Используется UI чек-листом и проверкой при `update({ isActive: true })`.
   */
  async getActivationStatus(id: number) {
    await this.ensureExists(id);
    const [tiersTotal, prices, operationalUnits] = await Promise.all([
      this.prisma.pricingTier.count(),
      this.prisma.catalogItemPrice.findMany({
        where: { catalogItemId: id },
        select: { tierId: true, pricePerDay: true },
      }),
      this.prisma.warehouseItem.count({
        where: { catalogItemId: id, status: WarehouseItemStatus.OPERATIONAL },
      }),
    ]);
    const tiersFilled = prices.filter((p) => p.pricePerDay > 0).length;
    const tiersMissing = Math.max(0, tiersTotal - tiersFilled);
    const canActivate = tiersTotal > 0 && tiersMissing === 0 && operationalUnits >= 1;
    return {
      canActivate,
      tiersTotal,
      tiersFilled,
      tiersMissing,
      operationalUnits,
    };
  }

  /**
   * Бизнес-правило: активировать карточку нельзя, если
   * (а) не заполнены все ценовые тиры, или
   * (б) нет ни одной OPERATIONAL единицы на складе.
   * Если в текущем апдейте передаётся `basePrice` — учитываем его как заполнение тира 1.
   */
  private async assertCanActivate(id: number, pendingBasePrice?: number): Promise<void> {
    const status = await this.getActivationStatus(id);
    let { tiersFilled, tiersMissing, operationalUnits, tiersTotal } = status;
    if (pendingBasePrice !== undefined && pendingBasePrice > 0) {
      const tier1 = await this.prisma.pricingTier.findFirst({
        where: { rank: 1 },
        select: { id: true },
      });
      const hasTier1Price = await this.prisma.catalogItemPrice.findFirst({
        where: { catalogItemId: id, tierId: tier1?.id ?? -1 },
        select: { pricePerDay: true },
      });
      if (tier1 && (!hasTier1Price || hasTier1Price.pricePerDay <= 0)) {
        tiersFilled += 1;
        tiersMissing = Math.max(0, tiersMissing - 1);
      }
    }
    if (tiersTotal === 0) {
      throw new BadRequestException(
        'Нет ни одного ценового тира — создайте тир перед активацией карточки',
      );
    }
    if (tiersMissing > 0) {
      throw new BadRequestException(
        `Нельзя активировать: не заполнены ${tiersMissing} из ${tiersTotal} ценовых тиров`,
      );
    }
    if (operationalUnits < 1) {
      throw new BadRequestException(
        'Нельзя активировать: нет ни одной рабочей (OPERATIONAL) единицы на складе',
      );
    }
  }

  async setTierPrice(id: number, tierId: number, pricePerDay: number) {
    await this.ensureExists(id);
    await this.tiers.setTierPrice(id, tierId, pricePerDay);
    return { ok: true };
  }

  async addPhoto(id: number, photoPath: string) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { id },
      select: { photos: true },
    });
    if (!equipment) throw new NotFoundException(`Карточка #${id} не найдена`);
    const current = (equipment.photos as string[] | null) ?? [];
    const updated = [...current, photoPath];
    return this.prisma.equipment.update({
      where: { id },
      data: { photos: updated },
    });
  }

  async setPhotos(id: number, photos: string[]) {
    await this.ensureExists(id);
    return this.prisma.equipment.update({
      where: { id },
      data: { photos },
    });
  }

  async getAvailability(id: number, fromStr: string, toStr: string) {
    const from = new Date(fromStr);
    const to = new Date(toStr);
    const busyDates = await this.pricing.getBusyDates(id, from, to);
    return { catalogItemId: id, from, to, busyDates };
  }

  async startMaintenance(dto: StartMaintenanceDto) {
    const wh = await this.prisma.warehouseItem.findUnique({
      where: { id: dto.warehouseItemId },
    });
    if (!wh) throw new NotFoundException(`Единица склада #${dto.warehouseItemId} не найдена`);

    const log = await this.prisma.maintenanceLog.create({
      data: {
        warehouseItemId: dto.warehouseItemId,
        startedAt: new Date(),
        reason: dto.reason,
        cost: dto.cost,
      },
    });
    await this.prisma.warehouseItem.update({
      where: { id: dto.warehouseItemId },
      data: { status: WarehouseItemStatus.BROKEN },
    });
    return log;
  }

  async endMaintenance(maintenanceId: number) {
    const log = await this.prisma.maintenanceLog.findUnique({
      where: { id: maintenanceId },
    });
    if (!log) throw new NotFoundException(`Запись обслуживания #${maintenanceId} не найдена`);

    const updated = await this.prisma.maintenanceLog.update({
      where: { id: maintenanceId },
      data: { endedAt: new Date() },
    });
    await this.prisma.warehouseItem.update({
      where: { id: log.warehouseItemId },
      data: { status: WarehouseItemStatus.OPERATIONAL },
    });
    return updated;
  }

  /**
   * Архивация карточки (soft-delete). Карточка пропадает с витрины,
   * история заказов сохраняется. Привязки единиц склада сохраняются —
   * можно восстановить из архива в один клик.
   *
   * Блокируется, если есть НЕЗАВЕРШЁННЫЕ заказы (любой статус кроме DONE/CANCELLED).
   */
  async archive(id: number) {
    await this.ensureExists(id);
    const blockingNumbers = await this.findActiveOrderNumbers(id);
    if (blockingNumbers.length > 0) {
      throw new BadRequestException(
        `Нельзя архивировать: карточка участвует в незавершённых заказах: ${blockingNumbers.join(', ')}. Сначала закройте или отмените их.`,
      );
    }
    return this.prisma.equipment.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Восстановление из архива. Требует выполнения условий активации
   * (есть тиры, есть рабочие единицы) — те же, что для обычной активации.
   */
  async unarchive(id: number) {
    await this.ensureExists(id);
    await this.assertCanActivate(id);
    return this.prisma.equipment.update({
      where: { id },
      data: { isActive: true },
    });
  }

  /**
   * Жёсткое удаление. Разрешено только для архивированной карточки
   * без какой-либо истории заказов (FK с OrderLine это и так гарантирует —
   * мы лишь даём чёткое сообщение вместо сырой ошибки БД).
   * Все привязанные единицы автоматически отвязываются.
   */
  async remove(id: number) {
    const card = await this.prisma.equipment.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true },
    });
    if (!card) throw new NotFoundException(`Карточка #${id} не найдена`);

    if (card.isActive) {
      throw new BadRequestException(
        `Нельзя удалить активную карточку «${card.name}». Сначала архивируйте её.`,
      );
    }

    // Полная история — даже завершённые заказы блокируют hard-delete,
    // чтобы аналитика и отчёты не теряли ссылку на карточку.
    const anyLines = await this.prisma.orderLine.count({ where: { equipmentId: id } });
    if (anyLines > 0) {
      throw new BadRequestException(
        `Нельзя удалить: у карточки есть история заказов (${anyLines} позиций). Карточка останется в архиве для сохранности отчётов.`,
      );
    }
    const inquiries = await this.prisma.order.count({ where: { inquiryEquipmentId: id } });
    if (inquiries > 0) {
      throw new BadRequestException(
        `Нельзя удалить: к карточке привязаны ${inquiries} инквайри-заявок.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.warehouseItem.updateMany({
        where: { catalogItemId: id },
        data: { catalogItemId: null },
      });
      await tx.equipment.delete({ where: { id } });
      return { ok: true };
    });
  }

  /**
   * Возвращает номера незавершённых заказов (DRAFT/PENDING/CONFIRMED/ACTIVE/OVERDUE),
   * которые включают эту карточку. Используется для блокирующих сообщений.
   */
  private async findActiveOrderNumbers(equipmentId: number): Promise<string[]> {
    const lines = await this.prisma.orderLine.findMany({
      where: {
        equipmentId,
        order: {
          status: {
            in: [
              OrderStatus.DRAFT,
              OrderStatus.PENDING,
              OrderStatus.CONFIRMED,
              OrderStatus.ACTIVE,
              OrderStatus.OVERDUE,
            ],
          },
        },
      },
      select: { order: { select: { number: true } } },
      distinct: ['orderId'],
    });
    return Array.from(new Set(lines.map((l) => l.order.number)));
  }

  private async ensureExists(id: number): Promise<void> {
    const exists = await this.prisma.equipment.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(`Карточка #${id} не найдена`);
  }

  /**
   * Генерация уникального автоматического SKU — 8-значный случайный код
   * в диапазоне 10000000–99999999 (без ведущего нуля). Например "47382951".
   *
   * Пространство значений 9·10^7 = 90 млн. Даже при 10к существующих карточек
   * вероятность коллизии ≈ 0.011% за один вызов — практически промахов нет.
   * На случай редкой коллизии (или гонки параллельных запросов) делаем до
   * 10 повторов с проверкой уникальности; при провале всех попыток уникальный
   * constraint в БД всё равно отобьёт дубль (P2002 → 409 наружу).
   */
  private async generateSku(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const sku = String(randomInt(10_000_000, 100_000_000));
      const exists = await this.prisma.equipment.findUnique({
        where: { sku },
        select: { id: true },
      });
      if (!exists) return sku;
    }
    throw new Error('Не удалось сгенерировать уникальный артикул за 10 попыток');
  }

  /**
   * Бизнес-правило: оборудование привязывается ТОЛЬКО к листовой категории
   * (без подкатегорий). Это позволяет на витрине корректно фильтровать
   * товары по любой ветке — родитель показывает всё, что в его поддереве.
   */
  private async assertLeafCategory(categoryId: number): Promise<void> {
    const isLeaf = await this.categories.isLeaf(categoryId);
    if (!isLeaf) {
      const cat = await this.prisma.category.findUnique({
        where: { id: categoryId },
        select: { name: true },
      });
      throw new BadRequestException(
        `Нельзя привязать оборудование к категории "${cat?.name ?? `#${categoryId}`}": ` +
          'у неё есть подкатегории. Выберите конечную (листовую) категорию.',
      );
    }
  }
}
