import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRevenue, useTopEquipment, useUtilization } from '@/lib/hooks/queries';
import { fmtRub, fmtDate } from '@/lib/utils/format';

type Period = '7' | '30' | '90';

/** Стабильный диапазон дат (обрезан до дня) — не мутирует между ре-рендерами. */
function usePeriodRange(period: Period) {
  return useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - Number(period));
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    };
  }, [period]);
}

export function ReportsPage() {
  const [period, setPeriod] = useState<Period>('30');
  const range = usePeriodRange(period);

  const { data: revenue, isLoading: revLoading } = useRevenue(range.from, range.to);
  const { data: top, isLoading: topLoading } = useTopEquipment(10, range.from, range.to);
  const { data: util, isLoading: utilLoading } = useUtilization(range.from, range.to);

  const downloadCsv = (filename: string, content: string) => {
    const bom = '\uFEFF';
    const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportRevenueCsv = () => {
    if (!revenue) return;
    const csv = ['Дата;Выручка', ...revenue.map((r) => `${r.date};${r.value}`)].join('\n');
    downloadCsv(`revenue-${period}d.csv`, csv);
  };

  const exportUtilizationCsv = () => {
    if (!util) return;
    const csv = [
      'Дата;Занято единиц;Утилизация %',
      ...util.map((u) => `${u.date};${u.busy};${u.utilization}`),
    ].join('\n');
    downloadCsv(`utilization-${period}d.csv`, csv);
  };

  const exportTopEquipmentCsv = () => {
    if (!top) return;
    const csv = [
      '№;Оборудование;Выручка;Утилизация %',
      ...top.map((item, idx) => `${idx + 1};${item.name};${item.revenue};${item.util}`),
    ].join('\n');
    downloadCsv(`top-equipment-${period}d.csv`, csv);
  };

  const exportAllCsv = () => {
    exportRevenueCsv();
    exportUtilizationCsv();
    exportTopEquipmentCsv();
  };

  const totalRevenue = (revenue ?? []).reduce((s, r) => s + r.value, 0);
  const avgRevenue = totalRevenue / Math.max(1, revenue?.length ?? 1);
  const avgUtil =
    (util ?? []).reduce((s, u) => s + u.utilization, 0) / Math.max(1, util?.length ?? 1);

  return (
    <>
      <PageHeader
        title="Отчёты"
        description="Выручка, утилизация, топ оборудования"
        action={
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 дней</SelectItem>
                <SelectItem value="30">30 дней</SelectItem>
                <SelectItem value="90">90 дней</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportAllCsv}>
              <Download className="size-4" /> CSV
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div className="rounded-xl border bg-surface p-5">
          <div className="text-xs text-text-3 uppercase">Выручка за период</div>
          <div className="font-display font-bold text-3xl mt-1 price">{fmtRub(totalRevenue)}</div>
        </div>
        <div className="rounded-xl border bg-surface p-5">
          <div className="text-xs text-text-3 uppercase">Средняя в день</div>
          <div className="font-display font-bold text-3xl mt-1 price">
            {fmtRub(Math.round(avgRevenue))}
          </div>
        </div>
        <div className="rounded-xl border bg-surface p-5">
          <div className="text-xs text-text-3 uppercase">Средняя загрузка</div>
          <div className="font-display font-bold text-3xl mt-1">{Math.round(avgUtil)}%</div>
        </div>
      </div>

      {/* === REVENUE === */}
      <div className="rounded-xl border bg-surface p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold">Выручка по дням</h3>
          <Button variant="ghost" size="sm" onClick={exportRevenueCsv} disabled={!revenue}>
            <Download className="size-3.5" /> CSV
          </Button>
        </div>
        <div className="h-72">
          {revLoading ? (
            <Skeleton className="h-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenue?.map((r) => ({ date: fmtDate(r.date), value: r.value }))}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-blue)" stopOpacity={0.4} />
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
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--color-text-3)"
                  fontSize={10}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  tickLine={false}
                  axisLine={false}
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
                  fill="url(#rev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* === UTILIZATION === */}
      <div className="rounded-xl border bg-surface p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold">Утилизация парка по дням</h3>
          <Button variant="ghost" size="sm" onClick={exportUtilizationCsv} disabled={!util}>
            <Download className="size-3.5" /> CSV
          </Button>
        </div>
        <div className="h-64">
          {utilLoading ? (
            <Skeleton className="h-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={util?.map((u) => ({ date: fmtDate(u.date), util: u.utilization }))}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  stroke="var(--color-text-3)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--color-text-3)"
                  fontSize={10}
                  tickFormatter={(v) => `${v}%`}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(v) => `${Number(v ?? 0)}%`}
                  contentStyle={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="util" fill="var(--color-blue)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* === TOP === */}
      <div className="rounded-xl border bg-surface overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between">
          <h3 className="font-display font-semibold">Топ оборудование</h3>
          <Button variant="ghost" size="sm" onClick={exportTopEquipmentCsv} disabled={!top}>
            <Download className="size-3.5" /> CSV
          </Button>
        </div>
        {topLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-text-3 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">#</th>
                <th className="text-left px-4 py-2.5 font-medium">Оборудование</th>
                <th className="text-right px-4 py-2.5 font-medium">Выручка</th>
                <th className="text-right px-4 py-2.5 font-medium">Утилизация</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {top?.map((item, idx) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-mono">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    {fmtRub(item.revenue)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                        <div className="h-full bg-blue" style={{ width: `${item.util}%` }} />
                      </div>
                      <span className="font-mono text-xs w-10 text-right">{item.util}%</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
