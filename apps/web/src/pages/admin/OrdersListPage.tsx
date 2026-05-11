import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  LayoutGrid,
  List as ListIcon,
  AlertCircle,
  GripVertical,
  Trash2,
  Loader2,
  MoreHorizontal,
  ArrowUpRight,
  Copy,
  Eye,
  Download,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  OrderSourceBadge,
  orderStatusLabel,
} from '@/components/shared/StatusBadge';
import { InlineStatusEditor } from '@/components/orders/InlineStatusEditor';
import { OrderPeek } from '@/components/orders/OrderPeek';
import { BulkActionBar } from '@/components/shared/BulkActionBar';
import { Checkbox } from '@/components/ui/checkbox';
import { usePeekStore } from '@/lib/stores/peek-store';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useChangeOrderStatus, useDeleteOrder, useOrdersList } from '@/lib/hooks/queries';
import { useIsAdmin } from '@/lib/hooks/auth';
import { fmtRub, fmtDate, fmtDays } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { apiErrorMessage } from '@/lib/api/client';
import type { Order, OrderSource, OrderStatus } from '@/lib/api/types';
import { canTransition } from '@/lib/utils/order-status';

// Колонки канбана. CANCELLED скрыт по умолчанию — отменённые показываем только в табличном режиме / по фильтру.
const KANBAN_STATUSES: OrderStatus[] = [
  'DRAFT',
  'PENDING',
  'CONFIRMED',
  'ACTIVE',
  'OVERDUE',
  'DONE',
];
const ALL_STATUSES: OrderStatus[] = [
  'DRAFT',
  'PENDING',
  'CONFIRMED',
  'ACTIVE',
  'OVERDUE',
  'DONE',
  'CANCELLED',
];

const STATUS_ACCENT: Record<OrderStatus, string> = {
  DRAFT: 'bg-slate-400',
  PENDING: 'bg-amber-400',
  CONFIRMED: 'bg-blue-400',
  ACTIVE: 'bg-emerald-500',
  OVERDUE: 'bg-red-500',
  DONE: 'bg-slate-500',
  CANCELLED: 'bg-slate-300',
};

type Tab = 'active' | 'inbox' | 'overdue' | 'archive' | 'all';

const TABS: { value: Tab; label: string; description: string }[] = [
  { value: 'active', label: 'В работе', description: 'Все незавершённые заказы' },
  { value: 'inbox', label: 'Входящие', description: 'Заявки с витрины' },
  { value: 'overdue', label: 'Просроченные', description: 'Срок аренды истёк' },
  { value: 'archive', label: 'Архив', description: 'Завершённые и отменённые' },
  { value: 'all', label: 'Все', description: 'Без фильтра' },
];

const ACTIVE_STATUSES: OrderStatus[] = ['DRAFT', 'PENDING', 'CONFIRMED', 'ACTIVE', 'OVERDUE'];
const ARCHIVE_STATUSES: OrderStatus[] = ['DONE', 'CANCELLED'];

function tabFromParams(params: URLSearchParams): Tab {
  const tab = params.get('tab') as Tab | null;
  if (tab && ['active', 'inbox', 'overdue', 'archive', 'all'].includes(tab)) {
    return tab;
  }
  // Обратная совместимость: ?source=WEB_INQUIRY → tab=inbox
  if (params.get('source') === 'WEB_INQUIRY') return 'inbox';
  return 'active';
}

export function OrdersListPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const tab = tabFromParams(params);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const initialView = (
    tab === 'inbox' || tab === 'archive' || tab === 'overdue' ? 'table' : 'kanban'
  ) as 'kanban' | 'table';
  const [view, setView] = useState<'kanban' | 'table'>(initialView);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState<Order | null>(null);

  // Фильтры для запроса в зависимости от таба
  const queryFilter = useMemo(() => {
    if (tab === 'inbox') return { source: 'WEB_INQUIRY' as OrderSource };
    if (tab === 'overdue') return { status: 'OVERDUE' as OrderStatus };
    return {};
  }, [tab]);

  const setTab = (next: Tab) => {
    const nextParams = new URLSearchParams(params);
    if (next === 'active') {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', next);
    }
    nextParams.delete('source'); // legacy очищаем
    setParams(nextParams);
    // Принудительно переключаем view: для inbox/archive/overdue — таблица.
    if (next === 'inbox' || next === 'archive' || next === 'overdue') setView('table');
  };

  const { data, isLoading } = useOrdersList({
    ...queryFilter,
    status: queryFilter.status ?? (statusFilter === 'ALL' ? undefined : statusFilter),
    search: search || undefined,
    limit: 100,
  });
  const changeStatus = useChangeOrderStatus();
  const remove = useDeleteOrder();
  const isAdmin = useIsAdmin();
  const openPeek = usePeekStore((s) => s.open);

  // === Bulk-выделение (только в табличном режиме) ===
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const clearSelection = () => setSelected(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }, // не реагировать на простой клик
    }),
  );

  // Доп. клиентская фильтрация по табу archive (бэк не поддерживает множественный статус)
  const filteredItems = useMemo(() => {
    const items = data?.items ?? [];
    if (tab === 'archive') return items.filter((o) => ARCHIVE_STATUSES.includes(o.status));
    if (tab === 'active') return items.filter((o) => !ARCHIVE_STATUSES.includes(o.status));
    return items;
  }, [data, tab]);

  const grouped = useMemo(() => {
    const out: Record<OrderStatus, Order[]> = {
      DRAFT: [],
      PENDING: [],
      CONFIRMED: [],
      ACTIVE: [],
      OVERDUE: [],
      DONE: [],
      CANCELLED: [],
    };
    for (const o of filteredItems) {
      out[o.status].push(o);
    }
    return out;
  }, [filteredItems]);

  // Показываемые статусы (колонки канбана) зависят от таба
  const visibleKanbanStatuses = useMemo<OrderStatus[]>(() => {
    if (tab === 'archive') return ['DONE', 'CANCELLED'];
    if (tab === 'overdue') return ['OVERDUE'];
    return ACTIVE_STATUSES;
  }, [tab]);

  const columnSums = useMemo(() => {
    const out: Record<OrderStatus, number> = {
      DRAFT: 0,
      PENDING: 0,
      CONFIRMED: 0,
      ACTIVE: 0,
      OVERDUE: 0,
      DONE: 0,
      CANCELLED: 0,
    };
    for (const s of ALL_STATUSES) {
      out[s] = grouped[s].reduce((sum, o) => sum + o.totalAmount, 0);
    }
    return out;
  }, [grouped]);

  const handleDragStart = (e: DragStartEvent) => {
    const order = data?.items.find((o) => o.id === e.active.id);
    if (order) setActiveOrder(order);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveOrder(null);
    const orderId = e.active.id as number;
    const newStatus = e.over?.id as OrderStatus | undefined;
    if (!newStatus || !ALL_STATUSES.includes(newStatus)) return;

    const order = filteredItems.find((o) => o.id === orderId);
    if (!order || order.status === newStatus) return;

    if (!canTransition(order.status, newStatus)) {
      toast.error(`Нельзя ${order.status} → ${newStatus}. Проверьте workflow заказа.`);
      return;
    }

    try {
      await changeStatus.mutateAsync({ id: orderId, status: newStatus });
      toast.success(`${order.number} → ${orderStatusLabel(newStatus)}`);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Не удалось обновить статус'));
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      toast.success(`Заказ ${deleting.number} удалён`);
      setDeleting(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось удалить'));
    }
  };

  return (
    <>
      <PageHeader
        title="Заказы"
        description={TABS.find((t) => t.value === tab)?.description ?? ''}
        action={
          <Button asChild>
            <Link to="/admin/orders/new">
              <Plus className="size-4" /> Новый заказ
            </Link>
          </Button>
        }
      />

      <nav className="flex gap-1 border-b mb-4 -mx-1 px-1 overflow-x-auto">
        {TABS.map((t) => {
          const isActive = t.value === tab;
          const count =
            t.value === 'inbox'
              ? (data?.items ?? []).filter(
                  (o) =>
                    o.source === 'WEB_INQUIRY' && (o.status === 'DRAFT' || o.status === 'PENDING'),
                ).length
              : t.value === 'overdue'
                ? (data?.items ?? []).filter((o) => o.status === 'OVERDUE').length
                : null;
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                'flex items-center gap-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-blue text-blue'
                  : 'border-transparent text-text-2 hover:text-text hover:border-border-2',
              )}
            >
              {t.label}
              {count != null && count > 0 && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0 text-[10px] font-semibold',
                    t.value === 'overdue'
                      ? 'bg-status-overdue text-white'
                      : 'bg-status-pending text-white',
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-3" />
          <Input
            placeholder="Поиск по номеру, клиенту, телефону…"
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center rounded-lg border bg-surface p-1">
          <button
            onClick={() => setView('kanban')}
            className={cn(
              'px-3 py-1.5 rounded text-xs font-medium transition-colors',
              view === 'kanban' ? 'bg-blue text-white' : 'text-text-2',
            )}
          >
            <LayoutGrid className="size-3.5 inline mr-1" /> Канбан
          </button>
          <button
            onClick={() => setView('table')}
            className={cn(
              'px-3 py-1.5 rounded text-xs font-medium transition-colors',
              view === 'table' ? 'bg-blue text-white' : 'text-text-2',
            )}
          >
            <ListIcon className="size-3.5 inline mr-1" /> Список
          </button>
        </div>
      </div>

      {/* status pills (фильтр) — только в режиме таблицы */}
      {view === 'table' && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              statusFilter === 'ALL'
                ? 'bg-text text-bg'
                : 'bg-surface text-text-2 hover:bg-surface-2',
            )}
          >
            Все
          </button>
          {KANBAN_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                statusFilter === s
                  ? 'bg-text text-bg'
                  : 'bg-surface text-text-2 hover:bg-surface-2',
              )}
            >
              {orderStatusLabel(s)}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : !filteredItems.length ? (
        <EmptyState
          title={
            tab === 'inbox'
              ? 'Новых заявок нет'
              : tab === 'overdue'
                ? 'Просроченных нет 🎉'
                : tab === 'archive'
                  ? 'Архив пуст'
                  : 'Заказов нет'
          }
          description={
            tab === 'active'
              ? 'Создайте первый заказ, чтобы начать работу'
              : 'Попробуйте изменить фильтр или таб выше'
          }
          action={
            tab === 'active' || tab === 'all' ? (
              <Button asChild>
                <Link to="/admin/orders/new">
                  <Plus className="size-4" /> Новый заказ
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : view === 'kanban' ? (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveOrder(null)}
        >
          <div
            className={cn(
              'grid gap-3 items-start',
              visibleKanbanStatuses.length <= 2
                ? 'grid-cols-1 md:grid-cols-2'
                : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5',
            )}
          >
            {visibleKanbanStatuses.map((s) => (
              <KanbanColumn
                key={s}
                status={s}
                orders={grouped[s]}
                sumAmount={columnSums[s]}
                isAdmin={isAdmin}
                onDelete={(o) => setDeleting(o)}
                onPeek={(o) => openPeek({ type: 'order', id: o.id })}
              />
            ))}
          </div>
          <DragOverlay>
            {activeOrder ? (
              <div className="rotate-3 opacity-95 w-[260px]">
                <KanbanCard order={activeOrder} dragging />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="rounded-xl border bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-text-3 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-3 w-8">
                    <Checkbox
                      checked={
                        filteredItems.length > 0 && filteredItems.every((o) => selected.has(o.id))
                      }
                      onCheckedChange={(v) => {
                        if (v) setSelected(new Set(filteredItems.map((o) => o.id)));
                        else clearSelection();
                      }}
                      aria-label="Выделить все"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-medium">Номер</th>
                  <th className="text-left px-4 py-3 font-medium">Клиент</th>
                  <th className="text-left px-4 py-3 font-medium">Период</th>
                  <th className="text-left px-4 py-3 font-medium">Дней</th>
                  <th className="text-left px-4 py-3 font-medium">Позиций</th>
                  <th className="text-right px-4 py-3 font-medium">Сумма</th>
                  <th className="text-left px-4 py-3 font-medium">Статус</th>
                  <th className="text-right px-4 py-3 font-medium w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredItems.map((order) => {
                  const isSelected = selected.has(order.id);
                  return (
                    <tr
                      key={order.id}
                      className={cn(
                        'hover:bg-surface-2 transition-colors cursor-pointer',
                        isSelected && 'bg-blue-soft/40',
                      )}
                      onClick={() => openPeek({ type: 'order', id: order.id })}
                    >
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(order.id)}
                          aria-label={`Выделить заказ ${order.number}`}
                        />
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <Link to={`/admin/orders/${order.id}`} className="font-mono text-blue">
                          {order.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {order.client?.name}
                        {order.source !== 'MANUAL' && (
                          <OrderSourceBadge source={order.source} className="ml-2" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-2 text-xs whitespace-nowrap">
                        {fmtDate(order.fromDate)} → {fmtDate(order.toDate)}
                      </td>
                      <td className="px-4 py-3 font-mono">{fmtDays(order.daysCount)}</td>
                      <td className="px-4 py-3 font-mono">{order._count?.lines ?? 0}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">
                        {fmtRub(order.totalAmount)}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <InlineStatusEditor
                          orderId={order.id}
                          orderNumber={order.number}
                          status={order.status}
                        />
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" title="Действия">
                              <MoreHorizontal className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => openPeek({ type: 'order', id: order.id })}
                            >
                              <Eye className="size-3.5" /> Превью
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to={`/admin/orders/${order.id}`}>
                                <ArrowUpRight className="size-3.5" /> Открыть полностью
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to={`/admin/orders/new?duplicateFrom=${order.id}`}>
                                <Copy className="size-3.5" /> Повторить
                              </Link>
                            </DropdownMenuItem>
                            {isAdmin && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-status-overdue focus:text-status-overdue"
                                  onClick={() => setDeleting(order)}
                                >
                                  <Trash2 className="size-3.5" /> Удалить
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* === Bulk Action Bar === */}
      <BulkActionBar
        count={selected.size}
        onClear={clearSelection}
        meta={
          <>
            ·{' '}
            {fmtRub(
              filteredItems
                .filter((o) => selected.has(o.id))
                .reduce((sum, o) => sum + o.totalAmount, 0),
            )}
          </>
        }
      >
        <Button
          size="sm"
          variant="ghost"
          className="text-bg hover:bg-white/10 rounded-full"
          onClick={() => {
            const ids = Array.from(selected).join(',');
            const csvBlob = new Blob(
              [
                'number,client,from,to,total,status\n' +
                  filteredItems
                    .filter((o) => selected.has(o.id))
                    .map(
                      (o) =>
                        `${o.number},${o.client?.name ?? ''},${o.fromDate ?? ''},${o.toDate ?? ''},${o.totalAmount},${o.status}`,
                    )
                    .join('\n'),
              ],
              { type: 'text/csv' },
            );
            const url = URL.createObjectURL(csvBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `orders-${ids.slice(0, 60)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success(`Экспортировано ${selected.size} заказов`);
          }}
        >
          <Download className="size-3.5" /> Экспорт CSV
        </Button>
        {isAdmin && (
          <Button
            size="sm"
            variant="ghost"
            className="text-status-overdue hover:bg-white/10 rounded-full"
            onClick={() => {
              const arr = filteredItems.filter((o) => selected.has(o.id));
              if (arr.length === 1) setDeleting(arr[0]);
              else toast.info('Массовое удаление пока не поддержано — удаляйте по одному');
            }}
          >
            <Trash2 className="size-3.5" /> Удалить
          </Button>
        )}
      </BulkActionBar>

      <OrderPeek />

      {/* === Удаление === */}
      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Удалить заказ {deleting?.number}?</DialogTitle>
            <DialogDescription>
              Действие нельзя отменить. История смены статусов и позиции будут удалены.
            </DialogDescription>
          </DialogHeader>
          {deleting && (
            <div className="rounded-md border bg-surface-2 p-3 text-sm space-y-1">
              <div>
                <span className="text-text-3">Клиент:</span> {deleting.client?.name}
              </div>
              <div>
                <span className="text-text-3">Период:</span> {fmtDate(deleting.fromDate)} →{' '}
                {fmtDate(deleting.toDate)}
              </div>
              <div>
                <span className="text-text-3">Сумма:</span>{' '}
                <span className="font-mono">{fmtRub(deleting.totalAmount)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={remove.isPending}>
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
    </>
  );
}

// === Колонка канбана (droppable) ===
function KanbanColumn({
  status,
  orders,
  sumAmount,
  isAdmin,
  onDelete,
  onPeek,
}: {
  status: OrderStatus;
  orders: Order[];
  sumAmount: number;
  isAdmin: boolean;
  onDelete: (o: Order) => void;
  onPeek: (o: Order) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-xl border bg-surface-2/40 transition-colors min-h-[320px] flex flex-col',
        isOver && 'bg-blue-soft border-blue/40',
      )}
    >
      {/* шапка колонки */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span className={cn('size-2 rounded-full flex-shrink-0', STATUS_ACCENT[status])} />
          <span className="text-xs font-semibold uppercase tracking-wider text-text-2 truncate">
            {orderStatusLabel(status)}
          </span>
          <span className="ml-auto text-xs font-mono text-text-3 bg-surface rounded px-1.5 py-0.5 border border-border">
            {orders.length}
          </span>
        </div>
        {sumAmount > 0 && (
          <div className="text-[10px] text-text-3 mt-1 font-mono">{fmtRub(sumAmount)}</div>
        )}
      </div>

      {/* карточки */}
      <div className="flex-1 px-2 pb-2 space-y-2 overflow-y-auto">
        {orders.length === 0 ? (
          <div
            className={cn(
              'h-24 grid place-items-center text-xs text-text-4 border-2 border-dashed border-border-2 rounded-lg transition-colors',
              isOver && 'border-blue/60 text-blue bg-surface',
            )}
          >
            {isOver ? 'Отпустите' : 'Пусто'}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {orders.map((order) => (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
              >
                <KanbanDraggable
                  order={order}
                  isAdmin={isAdmin}
                  onDelete={onDelete}
                  onPeek={onPeek}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

// === Обёртка карточки с draggable ===
function KanbanDraggable({
  order,
  isAdmin,
  onDelete,
  onPeek,
}: {
  order: Order;
  isAdmin: boolean;
  onDelete: (o: Order) => void;
  onPeek: (o: Order) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: order.id });

  return (
    <div ref={setNodeRef} className={cn(isDragging && 'opacity-30')}>
      <KanbanCard
        order={order}
        isAdmin={isAdmin}
        onDelete={onDelete}
        onPeek={onPeek}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

// === Карточка ===
type DragHandleProps = Record<string, unknown>;

function KanbanCard({
  order,
  dragging,
  isAdmin,
  onDelete,
  onPeek,
  dragHandleProps,
}: {
  order: Order;
  dragging?: boolean;
  isAdmin?: boolean;
  onDelete?: (o: Order) => void;
  onPeek?: (o: Order) => void;
  dragHandleProps?: DragHandleProps;
}) {
  const isOverdue = order.status === 'OVERDUE';
  const changeStatus = useChangeOrderStatus();

  const handleAcceptReturn = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await changeStatus.mutateAsync({ id: order.id, status: 'DONE' });
      toast.success(`${order.number} → завершён`);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Не удалось обновить'));
    }
  };

  return (
    <div
      className={cn(
        'group relative bg-surface rounded-lg border border-border shadow-sm transition-all',
        !dragging && 'hover:shadow-card hover:-translate-y-0.5 hover:border-border-2',
        dragging && 'shadow-card-hover',
      )}
    >
      {/* drag-handle полоса слева */}
      <div
        {...dragHandleProps}
        className="absolute left-0 top-0 bottom-0 w-6 cursor-grab active:cursor-grabbing flex items-center justify-center opacity-0 group-hover:opacity-60 transition-opacity"
        title="Перетащить"
      >
        <GripVertical className="size-3.5 text-text-3" />
      </div>

      <div className="pl-6 pr-2 pt-2.5 pb-2.5">
        <div className="flex items-start justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <Link
              to={`/admin/orders/${order.id}`}
              className="font-mono text-[11px] text-text-3 hover:text-text"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {order.number}
            </Link>
            {order.source !== 'MANUAL' && <OrderSourceBadge source={order.source} />}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="size-5 grid place-items-center text-text-3 hover:text-text rounded hover:bg-surface-3"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {onPeek && (
                <DropdownMenuItem onClick={() => onPeek(order)} className="cursor-pointer">
                  <Eye className="size-3.5" /> Превью
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link to={`/admin/orders/${order.id}`} className="cursor-pointer">
                  <ArrowUpRight className="size-3.5" /> Открыть полностью
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={`/admin/orders/new?duplicateFrom=${order.id}`} className="cursor-pointer">
                  <Copy className="size-3.5" /> Повторить
                </Link>
              </DropdownMenuItem>
              {isAdmin && onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer text-status-overdue focus:text-status-overdue"
                    onClick={() => onDelete(order)}
                  >
                    <Trash2 className="size-3.5" /> Удалить
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <button
          type="button"
          className="block w-full text-left"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onPeek?.(order);
          }}
        >
          <div className="font-medium text-sm leading-snug mt-1 line-clamp-2">
            {order.client?.name}
          </div>
          {order.source === 'WEB_INQUIRY' && order.inquiryNote && (
            <div className="text-xs text-text-3 italic mt-1 line-clamp-2">
              «{order.inquiryNote}»
            </div>
          )}
          <div className="mt-2 flex items-center justify-between text-[10px] text-text-3 font-mono">
            <span>
              {order.fromDate ? fmtDate(order.fromDate) : 'без дат'}
              {order.toDate ? ` → ${fmtDate(order.toDate)}` : ''}
            </span>
            <span className="font-semibold text-text-2">{order._count?.lines ?? 0} поз.</span>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-border flex items-center justify-between">
            {isOverdue && (
              <span className="text-xs text-status-overdue inline-flex items-center gap-1">
                <AlertCircle className="size-3" /> Просрочено
              </span>
            )}
            <span className="ml-auto font-mono text-sm font-semibold price">
              {fmtRub(order.totalAmount)}
            </span>
          </div>
        </button>

        {/* Inline-действия для OVERDUE */}
        {isOverdue && (
          <div
            className="mt-2 -mx-2 -mb-2 px-2 py-1.5 bg-status-overdue-bg/40 rounded-b-lg flex gap-1"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleAcceptReturn}
              disabled={changeStatus.isPending}
              className="flex-1 px-2 py-1 rounded text-xs font-medium bg-status-active text-white hover:bg-status-active/90 transition-colors disabled:opacity-50"
            >
              {changeStatus.isPending ? '...' : 'Принять возврат'}
            </button>
            <Link
              to={`/admin/orders/${order.id}`}
              className="px-2 py-1 rounded text-xs font-medium bg-surface text-text-2 border border-border hover:bg-surface-3 transition-colors"
            >
              Продлить
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
