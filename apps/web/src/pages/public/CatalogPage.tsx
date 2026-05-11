import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useParams, Link } from 'react-router-dom';
import {
  Search,
  X,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  FolderTree,
  Calendar,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { EquipmentCard } from '@/components/catalog/EquipmentCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCategoriesTree, useEquipmentList } from '@/lib/hooks/queries';
import { cn } from '@/lib/utils/cn';
import type { CategoryTreeNode } from '@/lib/api/types';

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'name', label: 'По названию (А → Я)' },
  { value: '-name', label: 'По названию (Я → А)' },
  { value: 'price', label: 'По цене (дешевле)' },
  { value: '-price', label: 'По цене (дороже)' },
  { value: '-rating', label: 'По рейтингу' },
  { value: '-new', label: 'Сначала новые' },
];

const PAGE_SIZE = 24;

/**
 * Аккордеон категорий: на каждом уровне раскрыт максимум один раздел.
 * Состояние хранится на уровне списка-родителя (CategoryList) — клик
 * по соседней ветке закрывает предыдущую открытую.
 */
interface ListProps {
  nodes: CategoryTreeNode[];
  depth: number;
  selectedSlug?: string;
}

function CategoryList({ nodes, depth, selectedSlug }: ListProps) {
  // Какой узел этого уровня сейчас раскрыт.
  // Изначально — тот, внутри которого находится выбранный slug (для контекста).
  const initialOpen = useMemo(() => {
    if (!selectedSlug) return null;
    return nodes.find((n) => containsSlug(n, selectedSlug))?.slug ?? null;
  }, [nodes, selectedSlug]);

  const [openSlug, setOpenSlug] = useState<string | null>(initialOpen);

  // Если selectedSlug меняется снаружи (навигация), синхронизируем раскрытую ветку.
  // Когда пользователь жмёт «Все категории» (slug=undefined), initialOpen=null —
  // схлопываем все раскрытые ветки текущего уровня.
  useEffect(() => {
    setOpenSlug(initialOpen);
  }, [initialOpen]);

  return (
    <>
      {nodes.map((node) => (
        <CategoryNodeView
          key={node.id}
          node={node}
          depth={depth}
          selectedSlug={selectedSlug}
          isOpen={openSlug === node.slug}
          onToggle={() => setOpenSlug((prev) => (prev === node.slug ? null : node.slug))}
          onOpen={() => setOpenSlug(node.slug)}
        />
      ))}
    </>
  );
}

interface NodeProps {
  node: CategoryTreeNode;
  depth: number;
  selectedSlug?: string;
  isOpen: boolean;
  onToggle: () => void;
  onOpen: () => void;
}

function CategoryNodeView({ node, depth, selectedSlug, isOpen, onToggle, onOpen }: NodeProps) {
  const hasChildren = node.children.length > 0;
  const isSelected = node.slug === selectedSlug;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 rounded-md transition-colors',
          // Иерархия по нашей шкале: 16 / 14 / 12. Без произвольных 13/15 px.
          depth === 0 && 'font-semibold text-base',
          depth === 1 && 'text-sm',
          depth >= 2 && 'text-xs text-text-2',
          isSelected ? 'bg-blue text-white' : 'hover:bg-surface-3',
        )}
      >
        {hasChildren ? (
          <button
            onClick={onToggle}
            className={cn(
              'size-6 grid place-items-center flex-shrink-0',
              isSelected ? 'text-white' : 'text-text-3',
            )}
            aria-label={isOpen ? 'Свернуть' : 'Развернуть'}
          >
            {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        ) : (
          <div className="size-6 flex-shrink-0" />
        )}
        <Link
          to={`/catalog/${node.slug}`}
          onClick={() => {
            // Клик по тексту категории сразу раскрывает её (и закрывает соседей).
            if (hasChildren) onOpen();
          }}
          className="flex items-center justify-between gap-2 flex-1 min-w-0 px-2 py-1.5"
        >
          <span className="truncate">{node.name}</span>
          <span
            className={cn(
              'text-xs font-mono font-normal',
              isSelected ? 'opacity-90' : 'text-text-3',
            )}
          >
            {node.visibleCatalogCount > 0 ? node.visibleCatalogCount : ''}
          </span>
        </Link>
      </div>
      <AnimatePresence initial={false}>
        {isOpen && hasChildren && (
          <motion.div
            key="children"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="ml-3 mt-0.5 border-l border-border-2 pl-2">
              <CategoryList nodes={node.children} depth={depth + 1} selectedSlug={selectedSlug} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function containsSlug(node: CategoryTreeNode, slug: string): boolean {
  if (node.slug === slug) return true;
  return node.children.some((c) => containsSlug(c, slug));
}

function findNodeBySlug(nodes: CategoryTreeNode[], slug: string): CategoryTreeNode | null {
  for (const n of nodes) {
    if (n.slug === slug) return n;
    const child = findNodeBySlug(n.children, slug);
    if (child) return child;
  }
  return null;
}

export function CatalogPage() {
  const { categorySlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const sort = searchParams.get('sort') ?? 'name';
  const availFrom = searchParams.get('availableFrom') ?? '';
  const availTo = searchParams.get('availableTo') ?? '';
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));

  const { data: tree } = useCategoriesTree(true);

  const currentNode = useMemo(
    () => (categorySlug && tree ? findNodeBySlug(tree, categorySlug) : null),
    [tree, categorySlug],
  );

  const { data, isLoading, isFetching } = useEquipmentList({
    // Бэк сам разворачивает категорию в поддерево (categories.service.descendantIds).
    // Клик по корневой ветке вернёт все товары внутри неё рекурсивно.
    categoryId: currentNode?.id,
    search: search || undefined,
    isActive: true,
    sort,
    availableFrom: availFrom || undefined,
    availableTo: availTo || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const displayedItems = data?.items ?? [];

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page'); // сброс пагинации при смене фильтров
    setSearchParams(next);
  };

  const handleSearchChange = (v: string) => {
    setSearch(v);
    updateParam('search', v || null);
  };

  // Дебаунс поиска
  useEffect(() => {
    const t = setTimeout(() => {
      const current = searchParams.get('search') ?? '';
      if (current !== search) updateParam('search', search || null);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const goToPage = (p: number) => {
    const next = new URLSearchParams(searchParams);
    if (p > 1) next.set('page', String(p));
    else next.delete('page');
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalPages = data?.pages ?? 1;
  const total = data?.total ?? 0;
  const hasAvailFilter = !!(availFrom && availTo);

  // Дефолтные даты для фильтра доступности (сегодня + 1 день)
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title={currentNode?.name ?? 'Каталог оборудования'}
        description={
          isLoading
            ? 'Загрузка…'
            : `${total} ${total === 1 ? 'позиция' : total >= 2 && total <= 4 ? 'позиции' : 'позиций'}${
                hasAvailFilter ? ' доступно на выбранные даты' : ''
              }`
        }
      />

      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        {/* === SIDEBAR === */}
        <aside className="space-y-4">
          <div className="rounded-xl border bg-surface p-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
              <SlidersHorizontal className="size-4" />
              Категории
            </div>
            <Link
              to="/catalog"
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors',
                !categorySlug ? 'bg-blue text-white' : 'hover:bg-surface-3',
              )}
            >
              <span>Все категории</span>
            </Link>
            <div className="mt-2 space-y-0.5">
              {tree && tree.length > 0 ? (
                <CategoryList nodes={tree} depth={0} selectedSlug={categorySlug} />
              ) : (
                <div className="text-xs text-text-3 px-3 py-2 flex items-center gap-2">
                  <FolderTree className="size-4" />
                  Нет видимых категорий
                </div>
              )}
            </div>
          </div>

          {/* === Доступность на даты === */}
          <div className="rounded-xl border bg-surface p-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
              <Calendar className="size-4" />
              Доступно на даты
            </div>
            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-text-3 uppercase tracking-wide">С</label>
                <Input
                  type="date"
                  value={availFrom}
                  min={today}
                  onChange={(e) => updateParam('availableFrom', e.target.value || null)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-[11px] text-text-3 uppercase tracking-wide">По</label>
                <Input
                  type="date"
                  value={availTo}
                  min={availFrom || tomorrow}
                  onChange={(e) => updateParam('availableTo', e.target.value || null)}
                  className="mt-1"
                />
              </div>
              {(availFrom || availTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.delete('availableFrom');
                    next.delete('availableTo');
                    next.delete('page');
                    setSearchParams(next);
                  }}
                >
                  Сбросить даты
                </Button>
              )}
              {hasAvailFilter && (
                <p className="text-xs text-text-3 mt-1">
                  Скрыты карточки, у которых на этом окне нет свободных единиц.
                </p>
              )}
            </div>
          </div>
        </aside>

        {/* === MAIN === */}
        <div>
          <div className="mb-4 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-3" />
              <Input
                placeholder="Поиск по каталогу…"
                className="pl-10 pr-10 h-12"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => handleSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 hover:text-text"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <Select
              value={sort}
              onValueChange={(v) => updateParam('sort', v === 'name' ? null : v)}
            >
              <SelectTrigger className="w-full sm:w-56 h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4]" />
              ))}
            </div>
          ) : displayedItems.length === 0 ? (
            <EmptyState
              title="Ничего не найдено"
              description={
                hasAvailFilter
                  ? 'На выбранные даты нет свободных карточек. Попробуйте сместить даты или сбросить фильтр.'
                  : 'Попробуйте изменить категорию или поисковый запрос.'
              }
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch('');
                    setSearchParams({});
                  }}
                >
                  Сбросить фильтры
                </Button>
              }
            />
          ) : (
            <>
              <motion.div
                layout
                className={cn(
                  'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4',
                  isFetching && 'opacity-60',
                )}
              >
                {displayedItems.map((eq, idx) => (
                  <motion.div
                    key={eq.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                  >
                    <EquipmentCard equipment={eq} />
                  </motion.div>
                ))}
              </motion.div>

              {/* === Pagination === */}
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={page <= 1}
                    onClick={() => goToPage(page - 1)}
                    aria-label="Предыдущая"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  {buildPageRange(page, totalPages).map((p, i) =>
                    p === '…' ? (
                      <span key={`gap-${i}`} className="px-2 text-text-3">
                        …
                      </span>
                    ) : (
                      <Button
                        key={p}
                        variant={p === page ? 'default' : 'outline'}
                        size="icon"
                        onClick={() => goToPage(p as number)}
                        className="w-9"
                      >
                        {p}
                      </Button>
                    ),
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={page >= totalPages}
                    onClick={() => goToPage(page + 1)}
                    aria-label="Следующая"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Возвращает массив [1, ..., current-1, current, current+1, ..., last] с эллипсисами.
 */
function buildPageRange(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const first = 1;
  const last = total;
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  const result: Array<number | '…'> = [first];
  if (left > 2) result.push('…');
  for (let i = left; i <= right; i++) result.push(i);
  if (right < total - 1) result.push('…');
  result.push(last);
  return result;
}
