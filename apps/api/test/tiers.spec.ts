import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TiersService } from '../src/modules/pricing/tiers.service';
import type { PrismaService } from '../src/common/prisma/prisma.service';

const makeMockPrisma = () => {
  const tiers: any[] = [];
  const prices: any[] = [];

  const prisma: any = {
    pricingTier: {
      findMany: vi
        .fn()
        .mockImplementation(() => Promise.resolve([...tiers].sort((a, b) => a.rank - b.rank))),
      create: vi.fn().mockImplementation(({ data }: any) => {
        const t = { id: tiers.length + 1, ...data };
        tiers.push(t);
        return Promise.resolve(t);
      }),
      update: vi.fn().mockImplementation(({ where, data }: any) => {
        const t = tiers.find((x) => x.id === where.id);
        Object.assign(t, data);
        return Promise.resolve(t);
      }),
      delete: vi.fn().mockImplementation(({ where }: any) => {
        const idx = tiers.findIndex((x) => x.id === where.id);
        const [removed] = tiers.splice(idx, 1);
        return Promise.resolve(removed);
      }),
    },
    catalogItemPrice: {
      findMany: vi.fn().mockImplementation(({ where }: any) => {
        return Promise.resolve(prices.filter((p) => p.tierId === where.tierId));
      }),
      create: vi.fn().mockImplementation(({ data }: any) => {
        const row = { id: prices.length + 1, ...data };
        prices.push(row);
        return Promise.resolve(row);
      }),
      upsert: vi.fn().mockImplementation(({ where, update, create }: any) => {
        const existing = prices.find(
          (p) =>
            p.catalogItemId === where.catalogItemId_tierId.catalogItemId &&
            p.tierId === where.catalogItemId_tierId.tierId,
        );
        if (existing) {
          Object.assign(existing, update);
          return Promise.resolve(existing);
        }
        const row = { id: prices.length + 1, ...create };
        prices.push(row);
        return Promise.resolve(row);
      }),
      deleteMany: vi.fn().mockImplementation(({ where }: any) => {
        for (let i = prices.length - 1; i >= 0; i -= 1) {
          if (prices[i].tierId === where.tierId) prices.splice(i, 1);
        }
        return Promise.resolve();
      }),
    },
    $transaction: vi.fn().mockImplementation((fn: any) => fn(prisma)),
  };
  return { prisma, tiers, prices };
};

describe('TiersService', () => {
  let mock: ReturnType<typeof makeMockPrisma>;
  let service: TiersService;

  beforeEach(() => {
    mock = makeMockPrisma();
    service = new TiersService(mock.prisma as unknown as PrismaService);
  });

  it('создаёт первый тир без расчёта цен', async () => {
    const t = await service.addTier(7, 0);
    expect(t.rank).toBe(1);
    expect(t.maxDays).toBeNull();
    expect(mock.tiers).toHaveLength(1);
  });

  it('добавляет второй тир и пересчитывает цены через скидку', async () => {
    // Bootstrap: 1 тир + 2 карточки с базовой ценой
    await service.addTier(1, 0); // создаём 1-й тир
    mock.prices.push({ catalogItemId: 1, tierId: 1, pricePerDay: 1000 });
    mock.prices.push({ catalogItemId: 2, tierId: 1, pricePerDay: 500 });

    const t2 = await service.addTier(7, 10); // закрываем тир 1 на 7 сут, тир 2 со скидкой 10%
    expect(t2.rank).toBe(2);
    expect(mock.tiers[0].maxDays).toBe(7);

    // У карточки 1 цена тира 2 = ceil(1000 * 0.9) = 900
    const p1 = mock.prices.find((p) => p.catalogItemId === 1 && p.tierId === t2.id);
    const p2 = mock.prices.find((p) => p.catalogItemId === 2 && p.tierId === t2.id);
    expect(p1!.pricePerDay).toBe(900);
    expect(p2!.pricePerDay).toBe(450);
  });

  it('Math.ceil: 333 × (100-15)/100 = 283.05 → 284', async () => {
    await service.addTier(1, 0);
    mock.prices.push({ catalogItemId: 1, tierId: 1, pricePerDay: 333 });
    const t2 = await service.addTier(7, 15);
    const p = mock.prices.find((x) => x.catalogItemId === 1 && x.tierId === t2.id);
    expect(p!.pricePerDay).toBe(284);
  });

  it('updateBoundary: меняет границу не-последнего тира и подвигает minDays следующего', async () => {
    await service.addTier(1, 0);
    mock.prices.push({ catalogItemId: 1, tierId: 1, pricePerDay: 1000 });
    await service.addTier(7, 10);

    await service.updateBoundary(mock.tiers[0].id, 5);
    expect(mock.tiers[0].maxDays).toBe(5);
    expect(mock.tiers[1].minDays).toBe(6);
  });

  it('updateBoundary запрещён для последнего тира', async () => {
    await service.addTier(1, 0);
    await expect(service.updateBoundary(mock.tiers[0].id, 5)).rejects.toThrow('последнего');
  });

  it('deleteLast превращает предпоследний в открытый', async () => {
    await service.addTier(1, 0);
    mock.prices.push({ catalogItemId: 1, tierId: 1, pricePerDay: 1000 });
    await service.addTier(7, 10);
    expect(mock.tiers).toHaveLength(2);

    await service.deleteLast();
    expect(mock.tiers).toHaveLength(1);
    expect(mock.tiers[0].maxDays).toBeNull();
  });

  it('deleteLast запрещён если остался один тир', async () => {
    await service.addTier(1, 0);
    await expect(service.deleteLast()).rejects.toThrow('минимум');
  });

  it('recalculate: пересчитывает цены тира 2 со скидкой 20%', async () => {
    await service.addTier(1, 0);
    mock.prices.push({ catalogItemId: 1, tierId: 1, pricePerDay: 1000 });
    const t2 = await service.addTier(7, 10);
    // у карточки 1 цена тира 2 = 900

    const r = await service.recalculate(t2.id, 20);
    expect(r.updated).toBe(1);
    const p = mock.prices.find((x) => x.catalogItemId === 1 && x.tierId === t2.id);
    expect(p!.pricePerDay).toBe(800); // ceil(1000 * 0.8)
  });

  it('recalculate тира 1 запрещён', async () => {
    await service.addTier(1, 0);
    await expect(service.recalculate(mock.tiers[0].id, 5)).rejects.toThrow('базовый');
  });

  it('addTier запрещает > 5 тиров', async () => {
    await service.addTier(1, 0);
    mock.prices.push({ catalogItemId: 1, tierId: 1, pricePerDay: 1000 });
    await service.addTier(3, 5);
    await service.addTier(7, 10);
    await service.addTier(14, 15);
    await service.addTier(30, 20);
    await expect(service.addTier(60, 25)).rejects.toThrow('Максимум 5');
  });
});
