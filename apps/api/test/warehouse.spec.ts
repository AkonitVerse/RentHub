import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WarehouseService } from '../src/modules/warehouse/warehouse.service';
import type { PrismaService } from '../src/common/prisma/prisma.service';

const makeMockPrisma = () => {
  const items: any[] = [];
  let nextId = 1;
  let activeLineCount = 0;

  const prisma: any = {
    warehouseItem: {
      findUnique: vi.fn().mockImplementation(({ where }: any) => {
        return Promise.resolve(
          items.find((i) =>
            where.id !== undefined
              ? i.id === where.id
              : i.inventoryNumber === where.inventoryNumber,
          ) ?? null,
        );
      }),
      findMany: vi.fn().mockImplementation(() => Promise.resolve([...items])),
      count: vi.fn().mockImplementation(() => Promise.resolve(items.length)),
      create: vi.fn().mockImplementation(({ data }: any) => {
        const i = { id: nextId++, ...data };
        items.push(i);
        return Promise.resolve(i);
      }),
      update: vi.fn().mockImplementation(({ where, data }: any) => {
        const i = items.find((x) => x.id === where.id);
        Object.assign(i, data);
        return Promise.resolve(i);
      }),
      delete: vi.fn().mockImplementation(({ where }: any) => {
        const idx = items.findIndex((x) => x.id === where.id);
        const [removed] = items.splice(idx, 1);
        return Promise.resolve(removed);
      }),
    },
    orderLine: {
      count: vi.fn().mockImplementation(() => Promise.resolve(activeLineCount)),
    },
    reservation: {
      findMany: vi.fn().mockImplementation(() =>
        Promise.resolve(
          activeLineCount > 0
            ? Array.from({ length: activeLineCount }, (_, i) => ({
                id: i + 1,
                orderLine: { order: { id: 100 + i, number: `RH-100${i}` } },
              }))
            : [],
        ),
      ),
    },
    equipment: {
      findUnique: vi
        .fn()
        .mockImplementation(({ where }: any) => Promise.resolve({ id: where.id, isActive: true })),
    },
  };

  const seed = {
    setActiveLines(n: number) {
      activeLineCount = n;
    },
  };

  return { prisma, items, seed };
};

describe('WarehouseService', () => {
  let mock: ReturnType<typeof makeMockPrisma>;
  let service: WarehouseService;

  beforeEach(() => {
    mock = makeMockPrisma();
    service = new WarehouseService(mock.prisma as unknown as PrismaService);
  });

  it('создаёт единицу с уникальным инв. номером', async () => {
    const i = await service.create({
      name: 'Дрель',
      inventoryNumber: 'INV-001',
    });
    expect(i.id).toBe(1);
    expect(i.inventoryNumber).toBe('INV-001');
  });

  it('запрещает дубликат инв. номера', async () => {
    await service.create({ name: 'A', inventoryNumber: 'INV-001' });
    await expect(service.create({ name: 'B', inventoryNumber: 'INV-001' })).rejects.toThrow(
      'уже занят',
    );
  });

  it('запрещает удаление, если назначена в активный заказ', async () => {
    await service.create({ name: 'A', inventoryNumber: 'INV-001' });
    mock.seed.setActiveLines(2);
    await expect(service.remove(1)).rejects.toThrow('активных');
  });

  it('разрешает удаление, если активных заказов нет', async () => {
    await service.create({ name: 'A', inventoryNumber: 'INV-001' });
    mock.seed.setActiveLines(0);
    const r = await service.remove(1);
    expect(r.id).toBe(1);
    expect(mock.items).toHaveLength(0);
  });

  it('link/unlink меняют catalogItemId', async () => {
    await service.create({ name: 'A', inventoryNumber: 'INV-001' });
    await service.link(1, 42);
    expect(mock.items[0].catalogItemId).toBe(42);
    await service.unlink(1);
    expect(mock.items[0].catalogItemId).toBeNull();
  });
});
