import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PricingTier } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

const MAX_TIERS = 5;
const MIN_TIERS = 1;

function tierPrice(basePrice: number, discountPercent: number): number {
  if (discountPercent < 0 || discountPercent > 100) {
    throw new BadRequestException('Скидка должна быть в диапазоне 0..100');
  }
  return Math.ceil((basePrice * (100 - discountPercent)) / 100);
}

@Injectable()
export class TiersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Список тиров по rank. */
  async list(): Promise<PricingTier[]> {
    return this.prisma.pricingTier.findMany({ orderBy: { rank: 'asc' } });
  }

  /**
   * Добавить новый последний тир.
   * Закрывает предыдущий открытый тир на closeAtDays и создаёт новый открытый тир.
   * Для всех карточек считает цену нового тира как Math.ceil(price1 × (100 - discount) / 100).
   */
  async addTier(closeAtDays: number, discountPercent: number): Promise<PricingTier> {
    if (closeAtDays < 1) throw new BadRequestException('closeAtDays должен быть ≥ 1');

    const tiers = await this.list();
    if (tiers.length >= MAX_TIERS) {
      throw new BadRequestException(`Максимум ${MAX_TIERS} тиров`);
    }
    if (tiers.length === 0) {
      // первый тир — создаётся открытым с rank=1, без расчёта цен
      return this.prisma.pricingTier.create({
        data: { rank: 1, minDays: 1, maxDays: null, note: 'до ∞ — базовая ставка' },
      });
    }

    const lastTier = tiers[tiers.length - 1];
    if (lastTier.maxDays != null) {
      throw new BadRequestException('Последний тир уже закрыт — нечего расширять');
    }
    if (closeAtDays < lastTier.minDays) {
      throw new BadRequestException(
        `closeAtDays (${closeAtDays}) должен быть ≥ minDays последнего тира (${lastTier.minDays})`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Закрываем последний тир
      await tx.pricingTier.update({
        where: { id: lastTier.id },
        data: { maxDays: closeAtDays, note: `от ${lastTier.minDays} до ${closeAtDays} суток` },
      });

      // 2. Создаём новый открытый тир
      const newRank = lastTier.rank + 1;
      const newTier = await tx.pricingTier.create({
        data: {
          rank: newRank,
          minDays: closeAtDays + 1,
          maxDays: null,
          note: `от ${closeAtDays + 1} суток (−${discountPercent}%)`,
        },
      });

      // 3. Для каждой карточки рассчитываем цену нового тира на основе цены тира 1
      const tierOne = tiers[0];
      const tierOnePrices = await tx.catalogItemPrice.findMany({
        where: { tierId: tierOne.id },
      });
      for (const p of tierOnePrices) {
        await tx.catalogItemPrice.create({
          data: {
            catalogItemId: p.catalogItemId,
            tierId: newTier.id,
            pricePerDay: tierPrice(p.pricePerDay, discountPercent),
          },
        });
      }

      return newTier;
    });
  }

  /**
   * Изменить верхнюю границу не-последнего тира.
   * Цены не меняются. Перепроверяет монотонность.
   */
  async updateBoundary(tierId: number, maxDays: number): Promise<PricingTier> {
    if (maxDays < 1) throw new BadRequestException('maxDays должен быть ≥ 1');

    const tiers = await this.list();
    const idx = tiers.findIndex((t) => t.id === tierId);
    if (idx === -1) throw new NotFoundException(`Тир #${tierId} не найден`);
    if (idx === tiers.length - 1) {
      throw new BadRequestException('Нельзя менять границу последнего (открытого) тира');
    }

    const tier = tiers[idx];
    const next = tiers[idx + 1];

    if (maxDays < tier.minDays) {
      throw new BadRequestException(`maxDays (${maxDays}) должен быть ≥ minDays (${tier.minDays})`);
    }
    if (next.maxDays != null && maxDays >= next.maxDays) {
      throw new BadRequestException(
        `maxDays (${maxDays}) должен быть < maxDays следующего тира (${next.maxDays})`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.pricingTier.update({
        where: { id: tier.id },
        data: { maxDays, note: `от ${tier.minDays} до ${maxDays} суток` },
      });
      // подвинуть minDays следующего тира
      await tx.pricingTier.update({
        where: { id: next.id },
        data: {
          minDays: maxDays + 1,
          note:
            next.maxDays != null
              ? `от ${maxDays + 1} до ${next.maxDays} суток`
              : `от ${maxDays + 1} суток`,
        },
      });
      return updated;
    });
  }

  /**
   * Удалить последний тир. Предпоследний становится открытым.
   */
  async deleteLast(): Promise<{ deletedId: number }> {
    const tiers = await this.list();
    if (tiers.length <= MIN_TIERS) {
      throw new BadRequestException(`Должен остаться минимум ${MIN_TIERS} тир`);
    }
    const last = tiers[tiers.length - 1];
    const prev = tiers[tiers.length - 2];

    return this.prisma.$transaction(async (tx) => {
      // удалить цены последнего тира (cascade в схеме, но удалим явно)
      await tx.catalogItemPrice.deleteMany({ where: { tierId: last.id } });
      await tx.pricingTier.delete({ where: { id: last.id } });
      await tx.pricingTier.update({
        where: { id: prev.id },
        data: { maxDays: null, note: `от ${prev.minDays} суток` },
      });
      return { deletedId: last.id };
    });
  }

  /**
   * Превью пересчёта тира: возвращает diff по каждой карточке без записи в БД.
   * Поле `changed` true, если новая цена отличается от текущей.
   * Используется в UI для подтверждения массовой операции.
   */
  async previewRecalculate(
    tierId: number,
    discountPercent: number,
  ): Promise<{
    tierId: number;
    discountPercent: number;
    items: Array<{
      catalogItemId: number;
      catalogItemName: string;
      sku: string;
      tierOnePrice: number;
      currentPrice: number | null;
      newPrice: number;
      changed: boolean;
    }>;
    summary: { total: number; willChange: number; willCreate: number; unchanged: number };
  }> {
    if (discountPercent < 0 || discountPercent > 100) {
      throw new BadRequestException('Скидка должна быть в диапазоне 0..100');
    }
    const tiers = await this.list();
    const tier = tiers.find((t) => t.id === tierId);
    if (!tier) throw new NotFoundException(`Тир #${tierId} не найден`);
    const tierOne = tiers[0];
    if (tierOne.id === tierId) {
      throw new BadRequestException('Тир 1 — базовый, его нельзя пересчитывать через скидку');
    }

    const tierOnePrices = await this.prisma.catalogItemPrice.findMany({
      where: { tierId: tierOne.id },
      include: { catalogItem: { select: { id: true, name: true, sku: true } } },
    });
    const currentTierPrices = await this.prisma.catalogItemPrice.findMany({
      where: { tierId },
    });
    const currentByItem = new Map(currentTierPrices.map((p) => [p.catalogItemId, p.pricePerDay]));

    const items = tierOnePrices.map((p) => {
      const newPrice = tierPrice(p.pricePerDay, discountPercent);
      const currentPrice = currentByItem.get(p.catalogItemId) ?? null;
      return {
        catalogItemId: p.catalogItemId,
        catalogItemName: p.catalogItem.name,
        sku: p.catalogItem.sku,
        tierOnePrice: p.pricePerDay,
        currentPrice,
        newPrice,
        changed: currentPrice !== newPrice,
      };
    });
    const willCreate = items.filter((i) => i.currentPrice == null).length;
    const willChange = items.filter((i) => i.currentPrice != null && i.changed).length;
    return {
      tierId,
      discountPercent,
      items: items.sort((a, b) => a.catalogItemName.localeCompare(b.catalogItemName, 'ru')),
      summary: {
        total: items.length,
        willChange,
        willCreate,
        unchanged: items.length - willChange - willCreate,
      },
    };
  }

  /**
   * Пересчитать цены тира для всех карточек на основе цены тира 1 и заданной скидки.
   */
  async recalculate(
    tierId: number,
    discountPercent: number,
  ): Promise<{ updated: number; skipped: number }> {
    if (discountPercent < 0 || discountPercent > 100) {
      throw new BadRequestException('Скидка должна быть в диапазоне 0..100');
    }
    const tiers = await this.list();
    const tier = tiers.find((t) => t.id === tierId);
    if (!tier) throw new NotFoundException(`Тир #${tierId} не найден`);
    const tierOne = tiers[0];
    if (tierOne.id === tierId) {
      throw new BadRequestException('Тир 1 — базовый, его нельзя пересчитывать через скидку');
    }

    const tierOnePrices = await this.prisma.catalogItemPrice.findMany({
      where: { tierId: tierOne.id },
    });

    let updated = 0;
    let skipped = 0;
    for (const p of tierOnePrices) {
      const newPrice = tierPrice(p.pricePerDay, discountPercent);
      try {
        await this.prisma.catalogItemPrice.upsert({
          where: { catalogItemId_tierId: { catalogItemId: p.catalogItemId, tierId } },
          update: { pricePerDay: newPrice },
          create: {
            catalogItemId: p.catalogItemId,
            tierId,
            pricePerDay: newPrice,
          },
        });
        updated += 1;
      } catch {
        skipped += 1;
      }
    }

    await this.prisma.pricingTier.update({
      where: { id: tierId },
      data: {
        note:
          tier.maxDays != null
            ? `от ${tier.minDays} до ${tier.maxDays} суток (−${discountPercent}%)`
            : `от ${tier.minDays} суток (−${discountPercent}%)`,
      },
    });

    return { updated, skipped };
  }

  /**
   * Установить цену тира 1 для конкретной карточки.
   * Используется при создании/обновлении карточки каталога. Не меняет другие тиры —
   * админ запускает recalculate отдельно.
   */
  async setBasePrice(catalogItemId: number, pricePerDay: number): Promise<void> {
    if (pricePerDay < 0) throw new BadRequestException('Цена не может быть отрицательной');
    const tiers = await this.list();
    if (tiers.length === 0) {
      throw new BadRequestException('Сначала создайте хотя бы один тир');
    }
    await this.prisma.catalogItemPrice.upsert({
      where: { catalogItemId_tierId: { catalogItemId, tierId: tiers[0].id } },
      update: { pricePerDay },
      create: {
        catalogItemId,
        tierId: tiers[0].id,
        pricePerDay,
      },
    });
  }

  /**
   * Установить цену конкретного тира для карточки (admin override).
   */
  async setTierPrice(catalogItemId: number, tierId: number, pricePerDay: number): Promise<void> {
    if (pricePerDay < 0) throw new BadRequestException('Цена не может быть отрицательной');
    await this.prisma.catalogItemPrice.upsert({
      where: { catalogItemId_tierId: { catalogItemId, tierId } },
      update: { pricePerDay },
      create: { catalogItemId, tierId, pricePerDay },
    });
  }
}
