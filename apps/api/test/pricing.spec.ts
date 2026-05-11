import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PricingService } from '../src/modules/pricing/pricing.service';
import type { PrismaService } from '../src/common/prisma/prisma.service';

const TIERS = [
  { id: 1, rank: 1, minDays: 1, maxDays: 3, note: null },
  { id: 2, rank: 2, minDays: 4, maxDays: 7, note: null },
  { id: 3, rank: 3, minDays: 8, maxDays: null, note: null },
];

const PRICES = new Map<string, { catalogItemId: number; tierId: number; pricePerDay: number }>([
  ['1:1', { catalogItemId: 1, tierId: 1, pricePerDay: 650 }],
  ['1:2', { catalogItemId: 1, tierId: 2, pricePerDay: 585 }],
  ['1:3', { catalogItemId: 1, tierId: 3, pricePerDay: 520 }],
]);

const makeMockPrisma = () => ({
  equipment: { findUnique: vi.fn() },
  pricingTier: { findMany: vi.fn() },
  catalogItemPrice: { findUnique: vi.fn() },
  warehouseItem: { count: vi.fn() },
  reservation: { findMany: vi.fn() },
  orderLine: { aggregate: vi.fn(), findMany: vi.fn() },
});

describe('PricingService', () => {
  let prisma: ReturnType<typeof makeMockPrisma>;
  let service: PricingService;

  beforeEach(() => {
    prisma = makeMockPrisma();
    prisma.pricingTier.findMany.mockResolvedValue(TIERS);
    prisma.catalogItemPrice.findUnique.mockImplementation(
      ({
        where: {
          catalogItemId_tierId: { catalogItemId, tierId },
        },
      }: any) => Promise.resolve(PRICES.get(`${catalogItemId}:${tierId}`) ?? null),
    );
    service = new PricingService(prisma as unknown as PrismaService);
  });

  describe('resolveDailyPrice', () => {
    it('применяет тир 1 для 1 дня', async () => {
      const r = await service.resolveDailyPrice(1, 1);
      expect(r.price).toBe(650);
      expect(r.tier?.rank).toBe(1);
    });

    it('применяет тир 2 для 5 дней', async () => {
      const r = await service.resolveDailyPrice(1, 5);
      expect(r.price).toBe(585);
      expect(r.tier?.rank).toBe(2);
    });

    it('применяет последний тир для 30 дней', async () => {
      const r = await service.resolveDailyPrice(1, 30);
      expect(r.price).toBe(520);
      expect(r.tier?.rank).toBe(3);
    });

    it('падает с 400 при days < 1', async () => {
      await expect(service.resolveDailyPrice(1, 0)).rejects.toThrow('Срок аренды');
    });

    it('падает если у карточки нет цены тира', async () => {
      prisma.catalogItemPrice.findUnique.mockResolvedValue(null);
      await expect(service.resolveDailyPrice(999, 5)).rejects.toThrow('не настроена');
    });
  });

  describe('calculateLine', () => {
    it('правильно считает сумму: цена × кол-во × дни', async () => {
      const r = await service.calculateLine(1, 2, 7);
      // 585 × 2 × 7 = 8190
      expect(r.unitPriceNet).toBe(585);
      expect(r.sumAmount).toBe(8190);
    });

    it('падает с 400 для qty < 1', async () => {
      await expect(service.calculateLine(1, 0, 5)).rejects.toThrow('Количество');
    });
  });

  describe('checkAvailability', () => {
    it('available=true если свободных единиц достаточно', async () => {
      prisma.equipment.findUnique.mockResolvedValue({ id: 1, isActive: true });
      // 1-й вызов count — totalUnits, 2-й вызов — busyUnits
      prisma.warehouseItem.count.mockResolvedValueOnce(5).mockResolvedValueOnce(2);
      const r = await service.checkAvailability(
        1,
        2,
        new Date('2026-05-10'),
        new Date('2026-05-15'),
      );
      expect(r.available).toBe(true);
      expect(r.freeQty).toBe(3);
    });

    it('available=false если не хватает свободных единиц', async () => {
      prisma.equipment.findUnique.mockResolvedValue({ id: 1, isActive: true });
      prisma.warehouseItem.count.mockResolvedValueOnce(5).mockResolvedValueOnce(4);
      const r = await service.checkAvailability(
        1,
        2,
        new Date('2026-05-10'),
        new Date('2026-05-15'),
      );
      expect(r.available).toBe(false);
      expect(r.freeQty).toBe(1);
    });

    it('available=false если карточка деактивирована', async () => {
      prisma.equipment.findUnique.mockResolvedValue({ id: 1, isActive: false });
      const r = await service.checkAvailability(
        1,
        1,
        new Date('2026-05-10'),
        new Date('2026-05-15'),
      );
      expect(r.available).toBe(false);
    });
  });

  describe('previewOrder', () => {
    it('считает суммарную стоимость по нескольким позициям', async () => {
      const r = await service.previewOrder(
        [
          { catalogItemId: 1, qty: 2 },
          { catalogItemId: 1, qty: 1 },
        ],
        new Date('2026-05-10'),
        new Date('2026-05-17'),
      );
      // 7 дней → тир 2 = 585; (585×2×7) + (585×1×7) = 8190 + 4095 = 12285
      expect(r.days).toBe(7);
      expect(r.totalAmount).toBe(12285);
    });
  });
});
