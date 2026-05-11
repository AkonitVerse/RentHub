import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Inbox,
  PackageCheck,
  PackageOpen,
  CalendarPlus,
  Activity,
  ShoppingBag,
  ChevronRight,
  UserPlus,
  CircleDot,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { OrderStatusBadge, OrderSourceBadge } from '@/components/shared/StatusBadge';
import { useAuthStore } from '@/lib/stores/auth-store';
import {
  useOverdueOrders,
  useTodayPickups,
  useTodayReturns,
  useUpcomingReturns,
  useOrdersList,
  useActivityFeed,
} from '@/lib/hooks/queries';
import { fmtDateTime, fmtRub } from '@/lib/utils/format';
import { ORDER_STATUS_LABELS } from '@/lib/utils/order-status';
import { WidgetCard } from '@/components/today/WidgetCard';
import { OrderRow } from '@/components/today/OrderRow';

const PREVIEW_LIMIT = 4;

export function TodayPage() {
  const user = useAuthStore((s) => s.user);

  const { data: overdue, isLoading: overdueLoading } = useOverdueOrders();
  const { data: pickups, isLoading: pickupsLoading } = useTodayPickups();
  const { data: returns, isLoading: returnsLoading } = useTodayReturns();
  const { data: upcoming, isLoading: upcomingLoading } = useUpcomingReturns(3);
  const { data: inquiriesPage, isLoading: inquiriesLoading } = useOrdersList({
    source: 'WEB_INQUIRY',
    limit: 20,
  });
  const { data: activity, isLoading: activityLoading } = useActivityFeed(24);

  // Берём только не-отменённые DRAFT/PENDING заявки
  const inquiries = useMemo(
    () =>
      (inquiriesPage?.items ?? []).filter((o) => o.status === 'DRAFT' || o.status === 'PENDING'),
    [inquiriesPage],
  );

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return 'Доброй ночи';
    if (h < 12) return 'Доброе утро';
    if (h < 18) return 'Добрый день';
    return 'Добрый вечер';
  }, []);

  const today = useMemo(
    () =>
      new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }),
    [],
  );

  return (
    <>
      <PageHeader
        title={`${greeting}${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
        description={`Сегодня ${today}. Вот что важно сделать.`}
        action={
          <Button asChild>
            <Link to="/admin/orders/new">
              <ShoppingBag className="size-4" /> Новый заказ
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* === ПРОСРОЧЕНО === */}
        <WidgetCard
          title="Просрочено"
          Icon={AlertCircle}
          tone="red"
          count={overdue?.length}
          isLoading={overdueLoading}
          emptyText="Просроченных нет 🎉"
          href="/admin/orders?tab=overdue"
        >
          {overdue?.slice(0, PREVIEW_LIMIT).map((o) => (
            <OrderRow key={o.id} order={o} dateField="toDate" emphasize />
          ))}
        </WidgetCard>

        {/* === НОВЫЕ ЗАЯВКИ === */}
        <WidgetCard
          title="Новые заявки с витрины"
          Icon={Inbox}
          tone="amber"
          count={inquiries.length}
          isLoading={inquiriesLoading}
          emptyText="Нет новых заявок"
          href="/admin/orders?tab=inbox"
        >
          {inquiries.slice(0, PREVIEW_LIMIT).map((o) => (
            <div
              key={o.id}
              className="rounded-lg border px-3 py-2.5 hover:bg-surface-2 transition-colors"
            >
              <Link to={`/admin/orders/${o.id}`} className="block min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs text-text-3">{o.number}</span>
                  <OrderSourceBadge source={o.source} />
                </div>
                <div className="font-medium text-sm truncate">
                  {o.client?.name ?? '— без клиента'}
                </div>
                {o.contactPhone && (
                  <div className="font-mono text-xs text-text-3 mt-0.5">{o.contactPhone}</div>
                )}
                {o.inquiryNote && (
                  <div className="text-xs text-text-2 mt-1.5 line-clamp-2 italic">
                    «{o.inquiryNote}»
                  </div>
                )}
              </Link>
            </div>
          ))}
        </WidgetCard>

        {/* === СЕГОДНЯ ВЫДАТЬ === */}
        <WidgetCard
          title="Сегодня выдать"
          Icon={PackageOpen}
          tone="blue"
          count={pickups?.length}
          isLoading={pickupsLoading}
          emptyText="На сегодня выдач нет"
          href="/admin/orders?tab=active"
        >
          {pickups?.slice(0, PREVIEW_LIMIT).map((o) => (
            <OrderRow key={o.id} order={o} dateField="fromDate" />
          ))}
        </WidgetCard>

        {/* === СЕГОДНЯ ВЕРНУТЬ === */}
        <WidgetCard
          title="Сегодня принять возврат"
          Icon={PackageCheck}
          tone="green"
          count={returns?.length}
          isLoading={returnsLoading}
          emptyText="На сегодня возвратов нет"
          href="/admin/orders?tab=active"
        >
          {returns?.slice(0, PREVIEW_LIMIT).map((o) => (
            <OrderRow key={o.id} order={o} dateField="toDate" />
          ))}
        </WidgetCard>

        {/* === СКОРО ВОЗВРАТ === */}
        <WidgetCard
          title="Скоро возврат"
          Icon={CalendarPlus}
          tone="violet"
          count={upcoming?.length}
          isLoading={upcomingLoading}
          emptyText="Возвратов в ближайшие 3 дня нет"
          href="/admin/orders?tab=active"
        >
          {upcoming?.slice(0, PREVIEW_LIMIT).map((o) => (
            <OrderRow key={o.id} order={o} dateField="toDate" />
          ))}
        </WidgetCard>

        {/* === АКТИВНОСТЬ === */}
        <ActivityWidget data={activity} isLoading={activityLoading} />
      </div>
    </>
  );
}

function ActivityWidget({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useActivityFeed>['data'];
  isLoading: boolean;
}) {
  const totalCount =
    (data?.newOrders?.length ?? 0) +
    (data?.statusChanges?.length ?? 0) +
    (data?.newClients?.length ?? 0);

  // Объединяем три списка в один timeline и сортируем по времени.
  const items = useMemo(() => {
    if (!data) return [];
    const merged = [
      ...data.newOrders.map((o) => ({
        kind: 'new-order' as const,
        ts: o.createdAt,
        order: o,
      })),
      ...data.statusChanges.map((s) => ({
        kind: 'status' as const,
        ts: s.changedAt,
        change: s,
      })),
      ...data.newClients.map((c) => ({
        kind: 'client' as const,
        ts: c.createdAt,
        client: c,
      })),
    ];
    merged.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    return merged.slice(0, 6);
  }, [data]);

  return (
    <WidgetCard
      title="Активность за 24 часа"
      Icon={Activity}
      tone="slate"
      count={totalCount}
      isLoading={isLoading}
      emptyText="Активности за сутки не было"
      delay={0.1}
    >
      <div className="space-y-2">
        {items.map((it, idx) => (
          <div key={idx} className="flex items-start gap-2 text-sm">
            <div className="mt-1.5 flex-shrink-0">
              <ActivityIcon kind={it.kind} />
            </div>
            <div className="flex-1 min-w-0">
              {it.kind === 'new-order' && (
                <Link
                  to={`/admin/orders/${it.order.id}`}
                  className="hover:text-blue transition-colors"
                >
                  <div className="text-sm">
                    Новый заказ <span className="font-mono text-xs">{it.order.number}</span>
                  </div>
                  <div className="text-xs text-text-3 truncate">
                    {it.order.client?.name ?? 'без клиента'} · {fmtRub(it.order.totalAmount)}
                  </div>
                </Link>
              )}
              {it.kind === 'status' && (
                <Link
                  to={`/admin/orders/${it.change.orderId}`}
                  className="hover:text-blue transition-colors"
                >
                  <div className="text-sm flex items-center gap-1.5">
                    <span className="font-mono text-xs">{it.change.order.number}</span>
                    <ChevronRight className="size-3" />
                    <OrderStatusBadge status={it.change.toStatus} />
                  </div>
                  <div className="text-xs text-text-3 truncate">
                    {it.change.fromStatus
                      ? `из ${ORDER_STATUS_LABELS[it.change.fromStatus]}`
                      : 'создан'}
                    {it.change.changedBy && ` · ${it.change.changedBy.name}`}
                  </div>
                </Link>
              )}
              {it.kind === 'client' && (
                <div>
                  <div className="text-sm">Новый клиент {it.client.name}</div>
                  {it.client.phone && (
                    <div className="font-mono text-xs text-text-3">{it.client.phone}</div>
                  )}
                </div>
              )}
              <div className="text-xs text-text-3 mt-0.5">{fmtDateTime(it.ts)}</div>
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}

function ActivityIcon({ kind }: { kind: 'new-order' | 'status' | 'client' }) {
  if (kind === 'new-order') return <ShoppingBag className="size-3.5 text-blue" />;
  if (kind === 'client') return <UserPlus className="size-3.5 text-status-active" />;
  return <CircleDot className="size-3.5 text-status-pending" />;
}
