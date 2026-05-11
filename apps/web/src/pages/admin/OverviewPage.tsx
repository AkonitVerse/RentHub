import { Link } from 'react-router-dom';
import {
  ShoppingBag,
  TrendingUp,
  Activity,
  Package,
  AlertCircle,
  Clock,
  Users as UsersIcon,
  CalendarHeart,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { OrderStatusBadge } from '@/components/shared/StatusBadge';
import {
  useDashboard,
  useOverdueOrders,
  useRevenue,
  useTopEquipment,
  useUpcomingReturns,
} from '@/lib/hooks/queries';
import { fmtRub, fmtDate } from '@/lib/utils/format';

/**
 * Overview — стартовая страница администратора.
 * Бизнес-метрики и графики, без операционных виджетов (это в /admin/today).
 */
export function OverviewPage() {
  const { data: dashboard, isLoading: dashLoading } = useDashboard();
  const { data: revenue } = useRevenue();
  const { data: top } = useTopEquipment(6);
  const { data: upcoming } = useUpcomingReturns(3);
  const { data: overdue } = useOverdueOrders();

  const chartData = (revenue ?? []).map((p) => ({
    date: new Date(p.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
    value: p.value,
  }));

  return (
    <>
      <PageHeader
        title="Обзор"
        description="Бизнес-метрики, выручка и состояние парка"
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/admin/today">
                <CalendarHeart className="size-4" /> Открыть Сегодня
              </Link>
            </Button>
            <Button asChild>
              <Link to="/admin/orders/new">
                <ShoppingBag className="size-4" /> Новый заказ
              </Link>
            </Button>
          </div>
        }
      />

      {/* === KPI === */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {dashLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32" />)
        ) : (
          <>
            <StatCard
              label="Выручка за 30 дней"
              value={fmtRub(dashboard?.monthRevenue ?? 0)}
              Icon={TrendingUp}
              accent="green"
            />
            <StatCard
              label="Ожидаемый доход"
              value={fmtRub(dashboard?.pendingRevenue ?? 0)}
              Icon={Activity}
              accent="blue"
            />
            <StatCard
              label="Активные аренды"
              value={dashboard?.activeOrders ?? 0}
              Icon={ShoppingBag}
              accent="orange"
            />
            <StatCard
              label="Загруженность"
              value={`${dashboard?.utilization ?? 0}%`}
              Icon={Package}
              accent={dashboard && dashboard.utilization > 70 ? 'red' : 'blue'}
            />
            <StatCard
              label="Просрочено"
              value={dashboard?.overdueOrders ?? overdue?.length ?? 0}
              Icon={UsersIcon}
              accent={(dashboard?.overdueOrders ?? overdue?.length ?? 0) > 0 ? 'red' : 'green'}
            />
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        {/* === REVENUE CHART === */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 rounded-xl border bg-surface p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold">Выручка за 30 дней</h3>
              <p className="text-xs text-text-3 mt-0.5">Завершённые заказы (без залога)</p>
            </div>
          </div>
          <div className="h-72">
            {chartData.length === 0 ? (
              <div className="h-full grid place-items-center text-text-3 text-sm">Нет данных</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-blue)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--color-blue)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    stroke="var(--color-text-3)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--color-text-3)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(v) => fmtRub(Number(v ?? 0))}
                    contentStyle={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-blue)"
                    strokeWidth={2}
                    fill="url(#revColor)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        {/* === UPCOMING RETURNS === */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl border bg-surface p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold flex items-center gap-2">
              <Clock className="size-4 text-status-pending" />
              Скоро возврат
            </h3>
            <span className="text-xs text-text-3">3 дня</span>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto -mr-2 pr-2">
            {!upcoming || upcoming.length === 0 ? (
              <div className="text-sm text-text-3 text-center py-8">Нет ожидаемых возвратов</div>
            ) : (
              upcoming.map((order) => (
                <Link
                  key={order.id}
                  to={`/admin/orders/${order.id}`}
                  className="block p-3 rounded-lg border hover:bg-surface-2 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-text-3">{order.number}</div>
                      <div className="font-medium text-sm truncate mt-0.5">
                        {order.client?.name}
                      </div>
                    </div>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-text-3">до {fmtDate(order.toDate)}</span>
                    <span className="font-mono">{fmtRub(order.totalAmount)}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* === TOP EQUIPMENT === */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border bg-surface p-5"
        >
          <h3 className="font-display font-semibold mb-4">Топ-6 по выручке</h3>
          <div className="space-y-3">
            {top?.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="size-8 rounded-md bg-blue-soft text-blue grid place-items-center font-display font-bold text-sm">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{item.name}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue rounded-full"
                        style={{ width: `${item.util}%` }}
                      />
                    </div>
                    <span className="text-xs text-text-3 w-9 text-right">{item.util}%</span>
                  </div>
                </div>
                <div className="font-mono text-sm font-semibold">{fmtRub(item.revenue)}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* === OVERDUE === */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl border bg-surface p-5"
        >
          <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
            <AlertCircle className="size-4 text-status-overdue" />
            Просроченные
          </h3>
          <div className="space-y-2">
            {!overdue || overdue.length === 0 ? (
              <div className="text-sm text-text-3 text-center py-8">Просроченных нет 🎉</div>
            ) : (
              overdue.slice(0, 5).map((order) => (
                <Link
                  key={order.id}
                  to={`/admin/orders/${order.id}`}
                  className="block p-3 rounded-lg border hover:bg-surface-2 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-mono text-xs text-text-3">{order.number}</div>
                      <div className="font-medium text-sm">{order.client?.name}</div>
                      <div className="text-xs text-status-overdue mt-0.5">
                        срок: {fmtDate(order.toDate)}
                      </div>
                    </div>
                    <span className="font-mono text-sm font-semibold">
                      {fmtRub(order.totalAmount)}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </>
  );
}
