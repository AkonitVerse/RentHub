import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  Edit,
  FolderTree,
  Loader2,
  Move,
  Package,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { LucideIcon } from '@/components/ui/LucideIcon';
import { IconPicker } from '@/components/admin/IconPicker';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { LinkEquipmentToCategoryDialog } from '@/components/admin/LinkEquipmentToCategoryDialog';
import {
  useBulkMoveCategories,
  useCategoriesConfig,
  useCategoriesTree,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from '@/lib/hooks/queries';
import { apiErrorMessage } from '@/lib/api/client';
import type { CategoryTreeNode } from '@/lib/api/types';

interface NodeProps {
  node: CategoryTreeNode;
  depth: number;
  /** Максимальная глубина дерева (с бэка). Контролирует кнопку «+ подкатегория». */
  maxDepth: number;
  /** Для каждого предка: был ли он последним ребёнком своего родителя.
   *  Используется, чтобы не тянуть линию ниже последней ветви. */
  ancestorIsLast: boolean[];
  /** Является ли узел последним среди своих сиблингов. */
  isLast: boolean;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onEdit: (node: CategoryTreeNode) => void;
  onAddChild: (parent: CategoryTreeNode) => void;
  onDelete: (node: CategoryTreeNode) => void;
  onManageItems: (node: CategoryTreeNode) => void;
}

const RAIL_STEP_REM = 1.75;
const RAIL_BASE_REM = 1.1;

function CategoryNode({
  node,
  depth,
  maxDepth,
  ancestorIsLast,
  isLast,
  selectedIds,
  onToggleSelect,
  onEdit,
  onAddChild,
  onDelete,
  onManageItems,
}: NodeProps) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.children.length > 0;
  // depth 0 — корень. У ребёнка глубина = depth + 1 (нумерация с 1 на бэке).
  // Кнопку «+» показываем только если ребёнок впишется в текущий лимит maxDepth.
  // Корневой узел сам = depth 1, его прямой ребёнок = 2, итого: depth + 2 <= maxDepth.
  const canAddChild = depth + 2 <= maxDepth && (node._count?.catalogItems ?? 0) === 0;
  const isSelected = selectedIds.has(node.id);
  // Карточки можно привязывать только к листовым категориям (без подкатегорий).
  const canManageItems = !hasChildren;

  const ownRailLeft = `${RAIL_BASE_REM + (depth - 1) * RAIL_STEP_REM}rem`;
  const stubWidth = `${RAIL_STEP_REM - 0.4}rem`;

  const toggleExpanded = () => hasChildren && setExpanded((v) => !v);

  return (
    <div>
      <div
        role={hasChildren ? 'button' : undefined}
        tabIndex={hasChildren ? 0 : undefined}
        onClick={toggleExpanded}
        onKeyDown={(e) => {
          if (hasChildren && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            toggleExpanded();
          }
        }}
        className={`relative flex items-center gap-2 py-2 pr-3 rounded-lg transition-colors ${
          isSelected ? 'bg-blue/10 hover:bg-blue/15' : 'hover:bg-surface-2'
        } ${hasChildren ? 'cursor-pointer select-none' : ''}`}
        style={{ paddingLeft: `${0.75 + depth * RAIL_STEP_REM}rem` }}
      >
        {/* Чекбокс выбора — клик по нему НЕ должен раскрывать узел */}
        <span className="relative z-10" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            className="size-4 cursor-pointer"
            checked={isSelected}
            onChange={() => onToggleSelect(node.id)}
            aria-label={`Выбрать «${node.name}»`}
          />
        </span>
        {/* Сквозные rail-ы предков. Index 0 — корень (без своего rail-а),
            пропускаем. Дальше каждый следующий индекс i отвечает за колонку (i-1)
            и рисуется только если предок НЕ последний — иначе линия тянулась бы
            ниже его последнего ребёнка. */}
        {ancestorIsLast
          .slice(1)
          .map((wasLast, k) =>
            wasLast ? null : (
              <span
                key={k}
                aria-hidden
                className="absolute top-0 bottom-0 bg-text-3/50"
                style={{ left: `${RAIL_BASE_REM + k * RAIL_STEP_REM}rem`, width: '1.5px' }}
              />
            ),
          )}

        {/* Свой коннектор: L-уголок (последний ребёнок) или T-перекрёсток */}
        {depth > 0 &&
          (isLast ? (
            <span
              aria-hidden
              className="absolute pointer-events-none rounded-bl-lg"
              style={{
                left: ownRailLeft,
                top: 0,
                width: stubWidth,
                height: '50%',
                borderLeft: '1.5px solid var(--color-text-3, #94a3b8)',
                borderBottom: '1.5px solid var(--color-text-3, #94a3b8)',
                opacity: 0.5,
              }}
            />
          ) : (
            <>
              <span
                aria-hidden
                className="absolute top-0 bottom-0 bg-text-3/50"
                style={{ left: ownRailLeft, width: '1.5px' }}
              />
              <span
                aria-hidden
                className="absolute bg-text-3/50"
                style={{
                  left: ownRailLeft,
                  top: '50%',
                  width: stubWidth,
                  height: '1.5px',
                }}
              />
            </>
          ))}

        {hasChildren ? (
          <span
            aria-hidden
            className="size-5 grid place-items-center text-text-3 relative z-10 bg-surface rounded transition-transform duration-200"
            style={{ transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          >
            <ChevronDown className="size-4" />
          </span>
        ) : (
          <div className="size-5 relative z-10" />
        )}
        <LucideIcon
          name={node.icon ?? 'FolderTree'}
          className="size-4 text-blue relative z-10"
          strokeWidth={1.8}
        />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate flex items-center gap-2">
            {node.name}
            {hasChildren ? (
              <span className="text-[10px] uppercase tracking-wide text-text-3 px-1.5 py-0.5 rounded bg-surface-2">
                раздел
              </span>
            ) : (
              <span className="text-[10px] uppercase tracking-wide text-emerald-700 px-1.5 py-0.5 rounded bg-emerald-50">
                лист
              </span>
            )}
          </div>
          <div className="text-xs text-text-3 truncate">
            {node._count?.children ?? 0} подкат. · {node.catalogCount} карточек прямо
            {node.catalogCountTotal > node.catalogCount && (
              <> ({node.catalogCountTotal} всего)</>
            )} · {node.unitCount} ед. · <span className="font-mono">{node.slug}</span>
          </div>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {canManageItems && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onManageItems(node)}
              title="Управление карточками в категории"
            >
              <Package className="size-4" />
            </Button>
          )}
          {canAddChild && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onAddChild(node)}
              title="Добавить подкатегорию"
            >
              <Plus className="size-4" />
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={() => onEdit(node)} title="Редактировать">
            <Edit className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onDelete(node)} title="Удалить">
            <Trash2 className="size-4 text-status-overdue" />
          </Button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {expanded && hasChildren && (
          <motion.div
            key="children"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            {node.children.map((c, idx) => (
              <CategoryNode
                key={c.id}
                node={c}
                depth={depth + 1}
                maxDepth={maxDepth}
                ancestorIsLast={[...ancestorIsLast, isLast]}
                isLast={idx === node.children.length - 1}
                selectedIds={selectedIds}
                onToggleSelect={onToggleSelect}
                onEdit={onEdit}
                onAddChild={onAddChild}
                onDelete={onDelete}
                onManageItems={onManageItems}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface FormState {
  id: number | null;
  parentId: number | null;
  name: string;
  description: string;
  icon: string;
}

export function CategoriesPage() {
  const { data: tree, isLoading } = useCategoriesTree(false);
  const { data: config } = useCategoriesConfig();
  const maxDepth = config?.maxDepth ?? 4;
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const remove = useDeleteCategory();
  const bulkMove = useBulkMoveCategories();

  const [form, setForm] = useState<FormState | null>(null);
  const [deleteNode, setDeleteNode] = useState<CategoryTreeNode | null>(null);
  const [linkNode, setLinkNode] = useState<CategoryTreeNode | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);

  // Плоский список всех категорий для селекторов «Родитель» и «Куда переместить».
  // Глубина вычисляется при обходе дерева, добавляется как prefix-индикатор.
  const flatList = useMemo(() => {
    const out: { id: number; name: string; depth: number; parentId: number | null }[] = [];
    const walk = (n: CategoryTreeNode, d: number) => {
      out.push({ id: n.id, name: n.name, depth: d, parentId: n.parentId });
      for (const c of n.children) walk(c, d + 1);
    };
    for (const r of tree ?? []) walk(r, 0);
    return out;
  }, [tree]);

  const toggleSelect = (id: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const clearSelection = () => setSelectedIds(new Set());

  const handleSave = async () => {
    if (!form) return;
    if (!form.name || form.name.trim().length < 2) {
      toast.error('Название должно быть не короче 2 символов');
      return;
    }
    try {
      if (form.id == null) {
        await create.mutateAsync({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          icon: form.icon.trim() || undefined,
          parentId: form.parentId,
        });
        toast.success('Категория создана');
      } else {
        await update.mutateAsync({
          id: form.id,
          data: {
            name: form.name.trim(),
            description: form.description.trim() || undefined,
            icon: form.icon.trim() || undefined,
            parentId: form.parentId,
          },
        });
        toast.success('Категория обновлена');
      }
      setForm(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось сохранить'));
    }
  };

  /** Список потомков для исключения из селектора родителя при редактировании. */
  const descendantIdsOf = (rootId: number): Set<number> => {
    const out = new Set<number>();
    const stack = [rootId];
    while (stack.length) {
      const id = stack.pop()!;
      for (const c of flatList) {
        if (c.parentId === id && !out.has(c.id)) {
          out.add(c.id);
          stack.push(c.id);
        }
      }
    }
    return out;
  };

  const handleBulkMove = async (targetParentId: number | null) => {
    try {
      const res = await bulkMove.mutateAsync({
        targetParentId,
        categoryIds: Array.from(selectedIds),
      });
      toast.success(`Перемещено: ${res.moved}`);
      clearSelection();
      setBulkMoveOpen(false);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось переместить'));
    }
  };

  const handleDelete = async () => {
    if (!deleteNode) return;
    try {
      await remove.mutateAsync(deleteNode.id);
      toast.success('Категория удалена');
      setDeleteNode(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось удалить'));
    }
  };

  return (
    <>
      <PageHeader
        title="Категории"
        description={`Иерархия каталога (до ${maxDepth} уровней)`}
        action={
          <Button
            onClick={() =>
              setForm({ id: null, parentId: null, name: '', description: '', icon: '' })
            }
          >
            <Plus className="size-4" /> Раздел
          </Button>
        }
      />

      {selectedIds.size > 0 && (
        <div className="sticky top-2 z-10 mb-3 rounded-xl border bg-surface shadow-md p-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium px-2">
            Выбрано: <span className="font-mono">{selectedIds.size}</span>
          </span>
          <Button size="sm" variant="outline" onClick={() => setBulkMoveOpen(true)}>
            <Move className="size-4" /> Переместить в…
          </Button>
          <div className="ml-auto">
            <Button size="sm" variant="ghost" onClick={clearSelection}>
              <X className="size-4" /> Снять выделение
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-surface overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center">
            <Loader2 className="size-8 animate-spin mx-auto text-blue" />
          </div>
        ) : !tree || tree.length === 0 ? (
          <EmptyState
            title="Категорий нет"
            description="Создайте первый раздел"
            icon={<FolderTree className="size-7" />}
            action={
              <Button
                onClick={() =>
                  setForm({ id: null, parentId: null, name: '', description: '', icon: '' })
                }
              >
                <Plus className="size-4" /> Раздел
              </Button>
            }
          />
        ) : (
          <div className="py-2">
            {tree.map((root, idx) => (
              <CategoryNode
                key={root.id}
                node={root}
                depth={0}
                maxDepth={maxDepth}
                ancestorIsLast={[]}
                isLast={idx === tree.length - 1}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onEdit={(n) =>
                  setForm({
                    id: n.id,
                    parentId: n.parentId,
                    name: n.name,
                    description: n.description ?? '',
                    icon: n.icon ?? '',
                  })
                }
                onAddChild={(parent) =>
                  setForm({
                    id: null,
                    parentId: parent.id,
                    name: '',
                    description: '',
                    icon: '',
                  })
                }
                onDelete={(n) => setDeleteNode(n)}
                onManageItems={(n) => setLinkNode(n)}
              />
            ))}
          </div>
        )}
      </div>

      {linkNode && (
        <LinkEquipmentToCategoryDialog
          open={linkNode !== null}
          onClose={() => setLinkNode(null)}
          categoryId={linkNode.id}
          categoryName={linkNode.name}
        />
      )}

      <Dialog open={form !== null} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {form?.id == null ? 'Создать категорию' : 'Редактировать категорию'}
            </DialogTitle>
            <DialogDescription>Максимальная глубина дерева: {maxDepth} уровней.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="cat-name">Название *</Label>
              <Input
                id="cat-name"
                value={form?.name ?? ''}
                onChange={(e) => form && setForm({ ...form, name: e.target.value })}
                className="mt-1.5"
                placeholder="Аккумуляторные дрели"
              />
            </div>
            <div>
              <Label htmlFor="cat-parent">Родитель</Label>
              <Select
                value={form?.parentId == null ? '__root__' : String(form.parentId)}
                onValueChange={(v) =>
                  form && setForm({ ...form, parentId: v === '__root__' ? null : Number(v) })
                }
              >
                <SelectTrigger id="cat-parent" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__root__">— Корневой уровень (раздел) —</SelectItem>
                  {flatList
                    .filter((c) => {
                      // При редактировании нельзя выбрать саму категорию или её потомка.
                      if (form?.id == null) return true;
                      if (c.id === form.id) return false;
                      const desc = descendantIdsOf(form.id);
                      return !desc.has(c.id);
                    })
                    .map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {'— '.repeat(c.depth)}
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-text-3 mt-1">
                Можно перевесить категорию в другой раздел. При перемещении проверяется лимит
                глубины ({maxDepth}) и отсутствие циклов.
              </p>
            </div>
            <div>
              <Label htmlFor="cat-desc">Описание</Label>
              <Textarea
                id="cat-desc"
                value={form?.description ?? ''}
                onChange={(e) => form && setForm({ ...form, description: e.target.value })}
                className="mt-1.5"
                rows={3}
              />
            </div>
            <div>
              <Label>Иконка</Label>
              <div className="mt-1.5">
                <IconPicker
                  value={form?.icon || null}
                  onChange={(name) => form && setForm({ ...form, icon: name ?? '' })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
              {(create.isPending || update.isPending) && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteNode !== null} onOpenChange={(o) => !o && setDeleteNode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить категорию «{deleteNode?.name}»?</DialogTitle>
            <DialogDescription>
              {deleteNode && (deleteNode._count?.children ?? 0) > 0 ? (
                <>
                  В этой категории {deleteNode._count?.children} подкатегорий. Удаление
                  заблокировано — сначала переместите или удалите их.
                </>
              ) : deleteNode && deleteNode.catalogCount > 0 ? (
                <>
                  В категории {deleteNode.catalogCount} карточек каталога. Удаление заблокировано —
                  сначала переместите их в другую категорию или архивируйте.
                </>
              ) : (
                <>Категория пуста — можно удалять без последствий.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteNode(null)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={
                remove.isPending ||
                (deleteNode != null &&
                  ((deleteNode._count?.children ?? 0) > 0 || deleteNode.catalogCount > 0))
              }
            >
              {remove.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkMoveCategoriesDialog
        open={bulkMoveOpen}
        onClose={() => setBulkMoveOpen(false)}
        onPick={handleBulkMove}
        pending={bulkMove.isPending}
        flatList={flatList}
        excludeIds={(() => {
          // Исключаем сами выбранные + всех их потомков (нельзя перенести в самого себя или внутрь себя).
          const ids = new Set<number>(selectedIds);
          for (const id of selectedIds) {
            for (const d of descendantIdsOf(id)) ids.add(d);
          }
          return ids;
        })()}
        selectedCount={selectedIds.size}
      />
    </>
  );
}

interface BulkMoveCategoriesDialogProps {
  open: boolean;
  onClose: () => void;
  onPick: (targetParentId: number | null) => void;
  pending: boolean;
  flatList: { id: number; name: string; depth: number; parentId: number | null }[];
  excludeIds: Set<number>;
  selectedCount: number;
}

function BulkMoveCategoriesDialog({
  open,
  onClose,
  onPick,
  pending,
  flatList,
  excludeIds,
  selectedCount,
}: BulkMoveCategoriesDialogProps) {
  const [target, setTarget] = useState<string>('__root__');

  const candidates = flatList.filter((c) => !excludeIds.has(c.id));

  const handleConfirm = () => {
    onPick(target === '__root__' ? null : Number(target));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setTarget('__root__');
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Переместить {selectedCount} категорий</DialogTitle>
          <DialogDescription>
            Выберите нового родителя. Перенос в собственного потомка или превышение лимита глубины —
            будут заблокированы бэком с конкретным сообщением.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="bulk-target">Новый родитель</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger id="bulk-target" className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__root__">— Корневой уровень (раздел) —</SelectItem>
              {candidates.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {'— '.repeat(c.depth)}
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleConfirm} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Переместить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
