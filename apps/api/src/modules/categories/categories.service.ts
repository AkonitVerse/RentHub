import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Category } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/categories.dto';

/** Hard-clamp на глубину дерева. Меньше 1 — бессмысленно, больше 6 —
 *  сильно ухудшает UX витрины и стоимость рекурсивного descendantIds(). */
const MIN_DEPTH = 1;
const MAX_ALLOWED_DEPTH = 6;
const DEFAULT_MAX_DEPTH = 4;
const SLUG_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function generateSlug(): string {
  let s = 'cat_';
  for (let i = 0; i < 8; i += 1)
    s += SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)];
  return s;
}

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
  catalogCount: number; // активные карточки в этой категории напрямую
  visibleCatalogCount: number; // активные с ≥1 AVAILABLE WarehouseItem
  unitCount: number; // физические единицы (через карточки) в категории и потомках
  catalogCountTotal: number; // активные карточки во всём поддереве
}

@Injectable()
export class CategoriesService {
  private readonly maxDepth: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const raw = Number(this.config.get<string>('CATEGORY_MAX_DEPTH') ?? DEFAULT_MAX_DEPTH);
    const safe = Number.isFinite(raw) ? Math.trunc(raw) : DEFAULT_MAX_DEPTH;
    this.maxDepth = Math.min(MAX_ALLOWED_DEPTH, Math.max(MIN_DEPTH, safe));
  }

  /** Текущий лимит глубины дерева — нужен фронту, чтобы корректно
   *  показывать подсказки и блокировать недопустимые уровни. */
  getMaxDepth(): number {
    return this.maxDepth;
  }

  /** Плоский список — для совместимости со старым клиентом. */
  list() {
    return this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { catalogItems: true, children: true } },
      },
    });
  }

  /**
   * Возвращает ID категории + всех её потомков рекурсивно.
   * Используется для фильтра витрины: «показать всё, что в ветке».
   * Выбран in-memory обход, потому что глубина дерева ≤ 3 — это 1 запрос findMany.
   */
  async descendantIds(rootId: number): Promise<number[]> {
    const all = await this.prisma.category.findMany({
      select: { id: true, parentId: true },
    });
    const childrenMap = new Map<number, number[]>();
    for (const c of all) {
      if (c.parentId == null) continue;
      const arr = childrenMap.get(c.parentId) ?? [];
      arr.push(c.id);
      childrenMap.set(c.parentId, arr);
    }
    const result: number[] = [];
    const stack: number[] = [rootId];
    while (stack.length > 0) {
      const id = stack.pop()!;
      result.push(id);
      const children = childrenMap.get(id) ?? [];
      for (const c of children) stack.push(c);
    }
    return result;
  }

  /**
   * Является ли категория листовой (без подкатегорий).
   * Используется при привязке оборудования: разрешаем только к листьям.
   */
  async isLeaf(categoryId: number): Promise<boolean> {
    const childrenCount = await this.prisma.category.count({
      where: { parentId: categoryId },
    });
    return childrenCount === 0;
  }

  /**
   * Дерево категорий с рекурсивным построением.
   * visibleOnly=true: показывает только категории, у которых есть видимая карточка
   * (active + ≥1 WarehouseItem.AVAILABLE) или видимый потомок.
   */
  async tree(visibleOnly = false): Promise<CategoryTreeNode[]> {
    const all = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { catalogItems: true, children: true } },
      },
    });

    // Подсчёт каталога по категории — активная карточка с ≥1 рабочей единицей.
    // categoryId у Equipment теперь NOT NULL — null-проверки не нужны.
    const visibleCatalogByCategory = new Map<number, number>();
    const items = await this.prisma.equipment.findMany({
      where: {
        isActive: true,
        warehouseItems: { some: { status: 'OPERATIONAL' } },
      },
      select: { categoryId: true },
    });
    for (const it of items) {
      visibleCatalogByCategory.set(
        it.categoryId,
        (visibleCatalogByCategory.get(it.categoryId) ?? 0) + 1,
      );
    }

    // Общий счёт активных карточек по категории (прямой)
    const catalogCountByCategory = new Map<number, number>();
    const allItems = await this.prisma.equipment.findMany({
      where: { isActive: true },
      select: { categoryId: true },
    });
    for (const it of allItems) {
      catalogCountByCategory.set(
        it.categoryId,
        (catalogCountByCategory.get(it.categoryId) ?? 0) + 1,
      );
    }

    // Прямой счёт физических единиц по категории — через привязку
    // WarehouseItem → Equipment → categoryId. Списанные не учитываем.
    const unitCountByCategory = new Map<number, number>();
    const allUnits = await this.prisma.warehouseItem.findMany({
      where: {
        catalogItem: { isNot: null },
        status: { in: ['OPERATIONAL', 'BROKEN'] },
      },
      select: { catalogItem: { select: { categoryId: true } } },
    });
    for (const u of allUnits) {
      const cid = u.catalogItem?.categoryId;
      if (cid == null) continue;
      unitCountByCategory.set(cid, (unitCountByCategory.get(cid) ?? 0) + 1);
    }

    const nodeMap = new Map<number, CategoryTreeNode>();
    for (const c of all) {
      nodeMap.set(c.id, {
        ...c,
        children: [],
        catalogCount: catalogCountByCategory.get(c.id) ?? 0,
        visibleCatalogCount: visibleCatalogByCategory.get(c.id) ?? 0,
        unitCount: unitCountByCategory.get(c.id) ?? 0,
        catalogCountTotal: catalogCountByCategory.get(c.id) ?? 0,
      });
    }

    const roots: CategoryTreeNode[] = [];
    for (const c of all) {
      const node = nodeMap.get(c.id)!;
      if (c.parentId == null) {
        roots.push(node);
      } else {
        nodeMap.get(c.parentId)?.children.push(node);
      }
    }

    // Накапливаем счётчики снизу вверх: catalogCountTotal и unitCount —
    // суммы по поддереву. catalogCount/visibleCatalogCount остаются прямыми.
    const accumulate = (node: CategoryTreeNode): { units: number; cards: number } => {
      let units = unitCountByCategory.get(node.id) ?? 0;
      let cards = catalogCountByCategory.get(node.id) ?? 0;
      for (const ch of node.children) {
        const sub = accumulate(ch);
        units += sub.units;
        cards += sub.cards;
      }
      node.unitCount = units;
      node.catalogCountTotal = cards;
      return { units, cards };
    };
    for (const r of roots) accumulate(r);

    if (!visibleOnly) return roots;

    // Рекурсивный фильтр: видна, если visibleCatalogCount > 0 ИЛИ хотя бы один child виден
    const isVisible = (node: CategoryTreeNode): boolean => {
      const visibleChildren = node.children.filter(isVisible);
      node.children = visibleChildren;
      return node.visibleCatalogCount > 0 || visibleChildren.length > 0;
    };
    return roots.filter(isVisible);
  }

  async getById(id: number) {
    const c = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { catalogItems: true, children: true } },
      },
    });
    if (!c) throw new NotFoundException(`Категория #${id} не найдена`);
    return c;
  }

  /**
   * Максимальная относительная глубина поддерева от данного узла.
   * Сам узел = 0, его прямые дети = 1, и т.д.
   * Используется при перемещении: чтобы убедиться, что потомки тоже
   * не вылезут за `maxDepth` после смены родителя.
   */
  private async maxRelativeSubtreeDepth(rootId: number): Promise<number> {
    const all = await this.prisma.category.findMany({ select: { id: true, parentId: true } });
    const childrenByParent = new Map<number, number[]>();
    for (const c of all) {
      if (c.parentId == null) continue;
      const arr = childrenByParent.get(c.parentId);
      if (arr) arr.push(c.id);
      else childrenByParent.set(c.parentId, [c.id]);
    }
    // BFS, считаем максимальный уровень.
    let level = 0;
    let frontier = [rootId];
    let maxLevel = 0;
    while (frontier.length > 0) {
      const next: number[] = [];
      for (const id of frontier) {
        const ch = childrenByParent.get(id);
        if (ch) next.push(...ch);
      }
      level += 1;
      if (next.length > 0) maxLevel = level;
      frontier = next;
    }
    return maxLevel;
  }

  /**
   * Возвращает глубину категории по цепочке родителей. Корень = 1.
   * depthOf(null) = 0 (виртуальный корень).
   */
  private async depthOf(categoryId: number | null | undefined): Promise<number> {
    if (!categoryId) return 0;
    let depth = 0;
    let cursor: { parentId: number | null } | null = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { parentId: true },
    });
    while (cursor) {
      depth += 1;
      if (cursor.parentId == null) break;
      cursor = await this.prisma.category.findUnique({
        where: { id: cursor.parentId },
        select: { parentId: true },
      });
    }
    return depth;
  }

  async create(dto: CreateCategoryDto) {
    const parentId = dto.parentId ?? null;
    const targetDepth = (await this.depthOf(parentId)) + 1;
    if (targetDepth > this.maxDepth) {
      throw new BadRequestException(`Превышена максимальная глубина (${this.maxDepth} уровней)`);
    }
    if (parentId) {
      const parent = await this.prisma.category.findUnique({ where: { id: parentId } });
      if (!parent) throw new NotFoundException(`Родительская категория #${parentId} не найдена`);
      // Запрет на смешивание: если в parent есть catalogItems — нельзя создавать подкатегории
      const itemsInParent = await this.prisma.equipment.count({ where: { categoryId: parentId } });
      if (itemsInParent > 0) {
        throw new BadRequestException(
          `Нельзя создавать подкатегории: в "${parent.name}" уже привязаны карточки каталога (${itemsInParent} шт.)`,
        );
      }
    }
    // имя должно быть уникально в пределах parent
    const conflict = await this.prisma.category.findFirst({
      where: { parentId, name: dto.name },
    });
    if (conflict) {
      throw new ConflictException(`Категория "${dto.name}" уже есть в этом родителе`);
    }

    return this.prisma.category.create({
      data: {
        slug: generateSlug(),
        name: dto.name,
        description: dto.description,
        icon: dto.icon,
        parentId,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: number, dto: UpdateCategoryDto) {
    const cat = await this.prisma.category.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException(`Категория #${id} не найдена`);

    if (dto.parentId !== undefined && dto.parentId !== cat.parentId) {
      // запрет на циклы (нельзя сделать категорию потомком собственного потомка)
      if (dto.parentId === id) {
        throw new BadRequestException('Категория не может быть собственным родителем');
      }
      if (dto.parentId != null) {
        // проверим, что новый parent не является потомком текущей категории
        let cursor: { id: number; parentId: number | null } | null =
          await this.prisma.category.findUnique({
            where: { id: dto.parentId },
            select: { id: true, parentId: true },
          });
        while (cursor) {
          if (cursor.id === id) {
            throw new BadRequestException('Цикл в дереве категорий');
          }
          if (cursor.parentId == null) break;
          cursor = await this.prisma.category.findUnique({
            where: { id: cursor.parentId },
            select: { id: true, parentId: true },
          });
        }
        // Проверим глубину с учётом ВСЕГО поддерева:
        // если переносимая категория сама имеет потомков, их новая глубина
        // = newDepth + относительная_глубина_потомка_от_текущего_корня.
        const newDepth = (await this.depthOf(dto.parentId)) + 1;
        const subtreeRelativeDepth = await this.maxRelativeSubtreeDepth(id);
        const deepestNewDepth = newDepth + subtreeRelativeDepth;
        if (deepestNewDepth > this.maxDepth) {
          throw new BadRequestException(
            subtreeRelativeDepth > 0
              ? `Нельзя переместить: потомки категории уехали бы на уровень ${deepestNewDepth}, а максимум — ${this.maxDepth}`
              : `Превышена максимальная глубина (${this.maxDepth} уровней)`,
          );
        }
      }
    }

    if (dto.name && dto.name !== cat.name) {
      const conflict = await this.prisma.category.findFirst({
        where: {
          parentId: dto.parentId !== undefined ? dto.parentId : cat.parentId,
          name: dto.name,
          NOT: { id },
        },
      });
      if (conflict) {
        throw new ConflictException(`Категория "${dto.name}" уже есть в этом родителе`);
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        icon: dto.icon,
        sortOrder: dto.sortOrder,
        parentId: dto.parentId === undefined ? undefined : dto.parentId,
      },
    });
  }

  async remove(id: number) {
    const cat = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: { select: { children: true, catalogItems: true } },
        catalogItems: { select: { id: true, name: true, sku: true }, take: 5 },
        children: { select: { id: true, name: true } },
      },
    });
    if (!cat) throw new NotFoundException(`Категория #${id} не найдена`);

    if (cat._count.children > 0) {
      const list = cat.children.map((c) => `«${c.name}»`).join(', ');
      throw new BadRequestException(
        `Нельзя удалить «${cat.name}»: есть подкатегории (${list}). Сначала переместите или удалите их.`,
      );
    }
    if (cat._count.catalogItems > 0) {
      const sample = cat.catalogItems.map((e) => `«${e.name}»`).join(', ');
      const more =
        cat._count.catalogItems > cat.catalogItems.length
          ? ` и ещё ${cat._count.catalogItems - cat.catalogItems.length}`
          : '';
      throw new BadRequestException(
        `Нельзя удалить «${cat.name}»: в категории ${cat._count.catalogItems} карточек (${sample}${more}). Переместите их в другую категорию или удалите.`,
      );
    }
    return this.prisma.category.delete({ where: { id } });
  }

  /**
   * Массово привязывает карточки оборудования к категории.
   * Категория должна быть листовой (без подкатегорий).
   */
  async bulkAttachEquipment(categoryId: number, equipmentIds: number[]) {
    if (equipmentIds.length === 0) {
      throw new BadRequestException('Не выбрано ни одной карточки');
    }
    const cat = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true },
    });
    if (!cat) throw new NotFoundException(`Категория #${categoryId} не найдена`);
    if (!(await this.isLeaf(categoryId))) {
      throw new BadRequestException(
        `Нельзя привязать к "${cat.name}": у неё есть подкатегории. Выберите листовую.`,
      );
    }
    const result = await this.prisma.equipment.updateMany({
      where: { id: { in: equipmentIds } },
      data: { categoryId },
    });
    return { attached: result.count };
  }

  /**
   * Массовое перемещение карточек в другую категорию.
   * Заменяет старую логику «отвязки», т.к. категория у карточки обязательна.
   */
  async bulkMoveEquipment(targetCategoryId: number, equipmentIds: number[]) {
    if (equipmentIds.length === 0) {
      throw new BadRequestException('Не выбрано ни одной карточки');
    }
    const cat = await this.prisma.category.findUnique({
      where: { id: targetCategoryId },
      select: { id: true, name: true },
    });
    if (!cat) throw new NotFoundException(`Категория #${targetCategoryId} не найдена`);
    if (!(await this.isLeaf(targetCategoryId))) {
      throw new BadRequestException(
        `Нельзя перенести в «${cat.name}»: у неё есть подкатегории. Выберите листовую.`,
      );
    }
    const result = await this.prisma.equipment.updateMany({
      where: { id: { in: equipmentIds } },
      data: { categoryId: targetCategoryId },
    });
    return { moved: result.count };
  }

  /**
   * Массовое перемещение категорий под нового родителя.
   * `targetParentId = null` — переносит на корневой уровень.
   * Для каждой категории проверяет: цикл, глубину поддерева, уникальность имени
   * в новом родителе. При любом нарушении — откат всей транзакции.
   */
  async bulkMoveCategories(targetParentId: number | null, categoryIds: number[]) {
    if (categoryIds.length === 0) {
      throw new BadRequestException('Не выбрано ни одной категории');
    }

    if (targetParentId !== null) {
      const target = await this.prisma.category.findUnique({
        where: { id: targetParentId },
        select: { id: true },
      });
      if (!target) {
        throw new NotFoundException(`Целевая категория #${targetParentId} не найдена`);
      }
    }

    const targetParentDepth = await this.depthOf(targetParentId);

    return this.prisma.$transaction(async (tx) => {
      let moved = 0;
      for (const id of categoryIds) {
        const cat = await tx.category.findUnique({ where: { id } });
        if (!cat) {
          throw new NotFoundException(`Категория #${id} не найдена`);
        }
        // Идемпотентность: если уже под нужным родителем — пропускаем без ошибки.
        if (cat.parentId === targetParentId) continue;

        // Запрет циклов и self-parent.
        if (targetParentId === id) {
          throw new BadRequestException(
            `Категория «${cat.name}» не может быть собственным родителем`,
          );
        }
        if (targetParentId !== null) {
          let cursor: { id: number; parentId: number | null } | null = await tx.category.findUnique(
            {
              where: { id: targetParentId },
              select: { id: true, parentId: true },
            },
          );
          while (cursor) {
            if (cursor.id === id) {
              throw new BadRequestException(
                `Цикл в дереве: «${cat.name}» нельзя переместить в собственного потомка`,
              );
            }
            if (cursor.parentId == null) break;
            cursor = await tx.category.findUnique({
              where: { id: cursor.parentId },
              select: { id: true, parentId: true },
            });
          }
        }

        // Проверка глубины с учётом всего поддерева категории.
        const subtreeRelativeDepth = await this.maxRelativeSubtreeDepth(id);
        const newDepth = targetParentDepth + 1;
        const deepestNewDepth = newDepth + subtreeRelativeDepth;
        if (deepestNewDepth > this.maxDepth) {
          throw new BadRequestException(
            subtreeRelativeDepth > 0
              ? `Нельзя переместить «${cat.name}»: потомки уехали бы на уровень ${deepestNewDepth}, максимум — ${this.maxDepth}`
              : `Нельзя переместить «${cat.name}»: превышен лимит глубины (${this.maxDepth})`,
          );
        }

        // Уникальность имени в новом родителе.
        const conflict = await tx.category.findFirst({
          where: { parentId: targetParentId, name: cat.name, NOT: { id } },
        });
        if (conflict) {
          throw new ConflictException(
            `В целевой категории уже есть «${cat.name}» — переименуйте перед перемещением`,
          );
        }

        await tx.category.update({
          where: { id },
          data: { parentId: targetParentId },
        });
        moved += 1;
      }
      return { moved };
    });
  }
}
