import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, FolderTree, Loader2, Search, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LucideIcon } from '@/components/ui/LucideIcon';
import { useCategoriesTree } from '@/lib/hooks/queries';
import { cn } from '@/lib/utils/cn';
import type { CategoryTreeNode } from '@/lib/api/types';

interface Props {
  /** Текущий ID категории или null. */
  value: number | null;
  /** Колбэк выбора. Передайте null чтобы сбросить. */
  onChange: (categoryId: number | null) => void;
  /** Подсказка-плейсхолдер для пустого значения. */
  placeholder?: string;
}

/**
 * Селект категории для привязки оборудования.
 *
 * Бизнес-правило: оборудование привязывается ТОЛЬКО к листовой категории
 * (без подкатегорий). Поэтому в дереве нелистовые узлы показаны, но
 * не выбираемы — клик по ним только разворачивает/сворачивает ветку.
 *
 * Помогает менеджеру видеть полную иерархию: «Электроинструменты → Дрели →
 * Аккумуляторные», но привязать он сможет только к самому глубокому уровню.
 */
export function CategoryLeafSelect({ value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data: tree, isLoading } = useCategoriesTree(false);

  // Полный путь от корня к узлу — для отображения в кнопке-триггере и в результатах поиска.
  const pathByNode = useMemo(() => {
    const map = new Map<number, { node: CategoryTreeNode; path: string }>();
    if (!tree) return map;
    const walk = (node: CategoryTreeNode, prefix: string[]) => {
      const path = [...prefix, node.name];
      map.set(node.id, { node, path: path.join(' / ') });
      for (const c of node.children) walk(c, path);
    };
    for (const root of tree) walk(root, []);
    return map;
  }, [tree]);

  const currentPath = value != null ? (pathByNode.get(value)?.path ?? null) : null;

  // Плоский список листьев — для поиска
  const leafCandidates = useMemo(() => {
    return Array.from(pathByNode.values())
      .filter(({ node }) => node.children.length === 0)
      .sort((a, b) => a.path.localeCompare(b.path, 'ru'));
  }, [pathByNode]);

  const filteredLeaves = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return leafCandidates.filter(({ path }) => path.toLowerCase().includes(q));
  }, [leafCandidates, query]);

  const handlePick = (id: number) => {
    onChange(id);
    setOpen(false);
    setQuery('');
  };

  const handleClear = () => {
    onChange(null);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-md border bg-surface hover:bg-surface-2 transition-colors text-left"
      >
        <div className="size-9 rounded-md bg-surface-2 grid place-items-center flex-shrink-0">
          <FolderTree className="size-4 text-text-3" />
        </div>
        <div className="flex-1 min-w-0">
          {currentPath ? (
            <>
              <div className="text-sm font-medium truncate">{currentPath.split(' / ').pop()}</div>
              <div className="text-xs text-text-3 truncate">{currentPath}</div>
            </>
          ) : (
            <div className="text-sm text-text-3">{placeholder ?? 'Выбрать категорию'}</div>
          )}
        </div>
        {value != null && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="size-6 grid place-items-center text-text-3 hover:text-status-overdue rounded"
            title="Очистить"
          >
            <X className="size-3.5" />
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Выбор категории для оборудования</DialogTitle>
            <DialogDescription>
              Выбрать можно только конечную (листовую) категорию. Родительские служат для
              группировки.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-3" />
            <Input
              autoFocus
              placeholder="Поиск листовой категории по названию…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="border rounded-lg bg-surface max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="py-12 text-center">
                <Loader2 className="size-6 animate-spin mx-auto text-blue" />
              </div>
            ) : query.trim() ? (
              filteredLeaves.length === 0 ? (
                <div className="py-8 text-center text-sm text-text-3">
                  Не найдено листовых категорий по «{query}»
                </div>
              ) : (
                <ul className="divide-y">
                  {filteredLeaves.map(({ node, path }) => (
                    <li key={node.id}>
                      <button
                        type="button"
                        onClick={() => handlePick(node.id)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-2',
                          value === node.id && 'bg-blue-soft',
                        )}
                      >
                        <LucideIcon
                          name={node.icon ?? 'FolderTree'}
                          className="size-4 text-text-3 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{node.name}</div>
                          <div className="text-xs text-text-3 truncate">{path}</div>
                        </div>
                        {value === node.id && <Check className="size-4 text-blue" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : !tree || tree.length === 0 ? (
              <div className="py-8 text-center text-sm text-text-3">
                Категорий нет. Сначала создайте их в «Категориях».
              </div>
            ) : (
              <div className="py-2">
                {tree.map((root) => (
                  <TreeRow
                    key={root.id}
                    node={root}
                    depth={0}
                    selectedId={value}
                    onPick={handlePick}
                  />
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClear}>
              Без категории
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TreeRow({
  node,
  depth,
  selectedId,
  onPick,
}: {
  node: CategoryTreeNode;
  depth: number;
  selectedId: number | null;
  onPick: (id: number) => void;
}) {
  // Авто-раскрытие: если выбранная категория где-то внутри
  const containsSelected = useMemo(
    () => (selectedId != null ? containsId(node, selectedId) : false),
    [node, selectedId],
  );
  const [expanded, setExpanded] = useState(depth === 0 || containsSelected);

  const isLeaf = node.children.length === 0;
  const isSelected = node.id === selectedId;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 rounded-md transition-colors',
          isSelected && 'bg-blue-soft',
        )}
        style={{ paddingLeft: `${depth * 0.75}rem` }}
      >
        {!isLeaf ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="size-6 grid place-items-center text-text-3 hover:text-text"
            aria-label={expanded ? 'Свернуть' : 'Развернуть'}
          >
            {expanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </button>
        ) : (
          <div className="size-6 flex-shrink-0" />
        )}
        {isLeaf ? (
          <button
            type="button"
            onClick={() => onPick(node.id)}
            className="flex items-center gap-2 flex-1 min-w-0 px-2 py-1.5 text-sm text-left hover:bg-surface-2 rounded-md"
          >
            <LucideIcon
              name={node.icon ?? 'FolderTree'}
              className="size-4 text-text-3 flex-shrink-0"
            />
            <span className="truncate">{node.name}</span>
            {isSelected && <Check className="size-3.5 text-blue ml-auto flex-shrink-0" />}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 flex-1 min-w-0 px-2 py-1.5 text-sm text-left text-text-3 cursor-default"
            title="Это группа — выберите листовую подкатегорию"
          >
            <LucideIcon
              name={node.icon ?? 'FolderTree'}
              className="size-4 text-text-3 flex-shrink-0"
            />
            <span className="truncate font-medium">{node.name}</span>
            <span className="text-[10px] text-text-3 ml-auto">группа</span>
          </button>
        )}
      </div>
      {expanded && !isLeaf && (
        <div>
          {node.children.map((c) => (
            <TreeRow
              key={c.id}
              node={c}
              depth={depth + 1}
              selectedId={selectedId}
              onPick={onPick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function containsId(node: CategoryTreeNode, id: number): boolean {
  if (node.id === id) return true;
  return node.children.some((c) => containsId(c, id));
}
