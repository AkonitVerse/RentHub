import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CategoriesService } from '../src/modules/categories/categories.service';
import type { PrismaService } from '../src/common/prisma/prisma.service';
import type { ConfigService } from '@nestjs/config';

interface CatRow {
  id: number;
  parentId: number | null;
  name: string;
  slug: string;
  sortOrder: number;
}

const makeMockPrisma = () => {
  const cats: CatRow[] = [];
  let nextId = 1;
  let nextEquipId = 1;
  const equipment: Array<{ id: number; categoryId: number | null; isActive: boolean }> = [];
  const warehouseItems: Array<{ id: number; catalogItemId: number | null; status: string }> = [];

  const prisma: any = {
    category: {
      findMany: vi.fn().mockImplementation(({ orderBy, include }: any = {}) => {
        const sorted = [...cats].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
        );
        if (include?._count) {
          return Promise.resolve(
            sorted.map((c) => ({
              ...c,
              _count: {
                catalogItems: equipment.filter((e) => e.categoryId === c.id).length,
                children: cats.filter((x) => x.parentId === c.id).length,
              },
            })),
          );
        }
        return Promise.resolve(sorted);
      }),
      findUnique: vi.fn().mockImplementation(({ where, select }: any) => {
        const c = cats.find((x) => x.id === where.id);
        if (!c) return Promise.resolve(null);
        if (select?.parentId && !select?.id) {
          return Promise.resolve({ parentId: c.parentId });
        }
        return Promise.resolve(c);
      }),
      findFirst: vi.fn().mockImplementation(({ where }: any) => {
        const found = cats.find((c) => {
          if (where.parentId !== undefined && c.parentId !== where.parentId) return false;
          if (where.name && c.name !== where.name) return false;
          if (where.NOT?.id && c.id === where.NOT.id) return false;
          return true;
        });
        return Promise.resolve(found ?? null);
      }),
      create: vi.fn().mockImplementation(({ data }: any) => {
        const c: CatRow = {
          id: nextId++,
          parentId: data.parentId ?? null,
          name: data.name,
          slug: data.slug,
          sortOrder: data.sortOrder ?? 0,
        };
        cats.push(c);
        return Promise.resolve(c);
      }),
      update: vi.fn().mockImplementation(({ where, data }: any) => {
        const c = cats.find((x) => x.id === where.id);
        if (!c) return Promise.resolve(null);
        Object.assign(c, data);
        return Promise.resolve(c);
      }),
      delete: vi.fn().mockImplementation(({ where }: any) => {
        const idx = cats.findIndex((x) => x.id === where.id);
        const [removed] = cats.splice(idx, 1);
        return Promise.resolve(removed);
      }),
    },
    equipment: {
      count: vi.fn().mockImplementation(({ where }: any) => {
        return Promise.resolve(equipment.filter((e) => e.categoryId === where.categoryId).length);
      }),
      findMany: vi.fn().mockImplementation(({ where }: any) => {
        return Promise.resolve(
          equipment.filter((e) => {
            if (where.isActive != null && e.isActive !== where.isActive) return false;
            if (where.warehouseItems?.some) {
              const has = warehouseItems.some(
                (w) => w.catalogItemId === e.id && w.status === where.warehouseItems.some.status,
              );
              if (!has) return false;
            }
            if (where.categoryId?.not !== undefined && e.categoryId === where.categoryId.not) {
              return false;
            }
            return true;
          }),
        );
      }),
      updateMany: vi.fn().mockImplementation(() => Promise.resolve()),
    },
    warehouseItem: {
      updateMany: vi.fn().mockImplementation(() => Promise.resolve()),
      findMany: vi.fn().mockImplementation(({ where }: any = {}) => {
        return Promise.resolve(
          warehouseItems.filter((w) => {
            if (where?.status && w.status !== where.status) return false;
            if (where?.catalogItem?.isNot !== undefined && w.catalogItemId === null) return false;
            return true;
          }),
        );
      }),
    },
  };

  const seed = {
    addEquipment(categoryId: number | null, isActive = true) {
      const e = { id: nextEquipId++, categoryId, isActive };
      equipment.push(e);
      return e;
    },
    addWarehouseItem(catalogItemId: number, status = 'OPERATIONAL') {
      warehouseItems.push({ id: warehouseItems.length + 1, catalogItemId, status });
    },
  };

  return { prisma, cats, equipment, warehouseItems, seed };
};

describe('CategoriesService', () => {
  let mock: ReturnType<typeof makeMockPrisma>;
  let service: CategoriesService;

  beforeEach(() => {
    mock = makeMockPrisma();
    // Минимальный мок ConfigService — возвращает дефолтную глубину 3.
    // CategoriesService использует config.get<string>('CATEGORY_MAX_DEPTH') в конструкторе.
    const config = {
      get: vi.fn().mockReturnValue('3'),
    } as unknown as ConfigService;
    service = new CategoriesService(mock.prisma as unknown as PrismaService, config);
  });

  describe('create', () => {
    it('создаёт корневую категорию', async () => {
      const c = await service.create({ name: 'Электроинструменты' });
      expect(c.id).toBe(1);
      expect(c.parentId).toBeNull();
      expect(c.slug).toMatch(/^cat_/);
    });

    it('запрещает 4-й уровень', async () => {
      const root = await service.create({ name: 'L1' });
      const l2 = await service.create({ name: 'L2', parentId: root.id });
      const l3 = await service.create({ name: 'L3', parentId: l2.id });
      await expect(service.create({ name: 'L4', parentId: l3.id })).rejects.toThrow('глубина');
    });

    it('запрещает дубликат имени в одном родителе', async () => {
      const root = await service.create({ name: 'Электроинструменты' });
      await service.create({ name: 'Дрели', parentId: root.id });
      await expect(service.create({ name: 'Дрели', parentId: root.id })).rejects.toThrow(
        'уже есть',
      );
    });

    it('разрешает одинаковое имя в разных родителях', async () => {
      const r1 = await service.create({ name: 'Электроинструменты' });
      const r2 = await service.create({ name: 'Ручной инструмент' });
      await service.create({ name: 'Дрели', parentId: r1.id });
      // вторая дрель в другом родителе — ок
      const c = await service.create({ name: 'Дрели', parentId: r2.id });
      expect(c.name).toBe('Дрели');
    });

    it('запрещает подкатегорию, если в родителе есть карточки', async () => {
      const root = await service.create({ name: 'L1' });
      mock.seed.addEquipment(root.id);
      await expect(service.create({ name: 'L2', parentId: root.id })).rejects.toThrow(
        'привязаны карточки',
      );
    });
  });

  describe('tree visibility', () => {
    it('показывает только видимые категории при visibleOnly=true', async () => {
      const r1 = await service.create({ name: 'Видимый раздел' });
      const r2 = await service.create({ name: 'Пустой раздел' });
      const eq = mock.seed.addEquipment(r1.id);
      mock.seed.addWarehouseItem(eq.id, 'OPERATIONAL');

      const tree = await service.tree(true);
      const names = tree.map((n) => n.name);
      expect(names).toContain('Видимый раздел');
      expect(names).not.toContain('Пустой раздел');
    });

    it('родительская категория видна, если виден потомок', async () => {
      const root = await service.create({ name: 'Электроинструменты' });
      const sub = await service.create({ name: 'Дрели', parentId: root.id });
      const eq = mock.seed.addEquipment(sub.id);
      mock.seed.addWarehouseItem(eq.id, 'OPERATIONAL');

      const tree = await service.tree(true);
      expect(tree.length).toBe(1);
      expect(tree[0].name).toBe('Электроинструменты');
      expect(tree[0].children.length).toBe(1);
      expect(tree[0].children[0].name).toBe('Дрели');
    });
  });
});
