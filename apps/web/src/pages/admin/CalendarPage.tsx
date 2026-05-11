import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Box,
  AlertTriangle,
  ShoppingBag,
  CalendarDays,
  Rows3,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PageHeader } from '@/components/shared/PageHeader';
import { useTimeline, useCategories, useUtilization } from '@/lib/hooks/queries';
import { fmtDateLong } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { TimelineUnit, TimelineReservation } from '@/lib/api/endpoints';

const DAY_MS = 86_400_000;
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const WEEKDAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

type ViewMode = 'month' | 'timeline';

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

/**
 * Календарь с двумя режимами:
 *   - **Месяц** — компактная месячная сетка с подсветкой загрузки парка по дням.
 *     Удобен для общего обзора («где у нас плотные дни»).
 *   - **Timeline** — горизонтальная диаграмма Ганта по каждой единице инвентаря.
 *     Удобен для оперативной работы («когда свободна именно эта единица»).
 */
export function CalendarPage() {
  const [view, setView] = useState<ViewMode>('month');

  return (
    <>
      <PageHeader
        title="Календарь"
        description={
          view === 'month'
            ? 'Загрузка парка по дням за месяц'
            : 'Свободные и занятые единицы инвентаря по дням'
        }
        action={
          <div className="inline-flex rounded-md border bg-surface p-0.5">
            <Button
              size="sm"
              variant={view === 'month' ? 'default' : 'ghost'}
              onClick={() => setView('month')}
              className="h-8"
            >
              <CalendarDays className="size-4" />
              Месяц
            </Button>
            <Button
              size="sm"
              variant={view === 'timeline' ? 'default' : 'ghost'}
              onClick={() => setView('timeline')}
              className="h-8"
            >
              <Rows3 className="size-4" />
              Timeline
            </Button>
          </div>
        }
      />

      {view === 'month' ? <MonthView /> : <TimelineView />}
    </>
  );
}

// =====================================================================
// === МЕСЯЧНАЯ СЕТКА (старый режим) ===================================
// =====================================================================

function MonthView() {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const monthStart = cursor;
  const monthEnd = useMemo(
    () => new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0),
    [cursor],
  );

  const { data: utilization, isLoading } = useUtilization(
    monthStart.toISOString(),
    monthEnd.toISOString(),
  );

  const utilByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of utilization ?? []) map.set(u.date, u.utilization);
    return map;
  }, [utilization]);

  const grid = useMemo(() => {
    const out: Array<{ date: Date; isCurMonth: boolean }> = [];
    const startOffset = (monthStart.getDay() + 6) % 7;
    const start = new Date(monthStart);
    start.setDate(start.getDate() - startOffset);
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push({ date: d, isCurMonth: d.getMonth() === monthStart.getMonth() });
    }
    return out;
  }, [monthStart]);

  const utilColor = (u: number): string => {
    if (u === 0) return '';
    if (u < 25) return 'bg-status-active-bg/40';
    if (u < 50) return 'bg-status-active-bg';
    if (u < 75) return 'bg-status-pending-bg';
    return 'bg-status-overdue-bg';
  };

  return (
    <div className="rounded-xl border bg-surface p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold text-xl">
          {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            aria-label="Раньше"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const d = new Date();
              setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
            }}
          >
            Сегодня
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            aria-label="Позже"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-text-3 uppercase">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map(({ date, isCurMonth }, idx) => {
              const key = date.toISOString().slice(0, 10);
              const u = utilByDate.get(key) ?? 0;
              const today = startOfDay(new Date());
              const isToday = date.getTime() === today.getTime();
              const fromIso = key;
              const toDate = new Date(date);
              toDate.setDate(toDate.getDate() + 3);
              const toIso = toDate.toISOString().slice(0, 10);
              return (
                <Popover key={idx}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        'aspect-square rounded-md border p-2 flex flex-col text-xs text-left transition-all',
                        'hover:border-blue/50 hover:shadow-sm hover:-translate-y-px',
                        !isCurMonth && 'opacity-40',
                        isToday && 'border-blue ring-2 ring-blue/20',
                        utilColor(u),
                      )}
                    >
                      <div className="font-mono font-semibold">{date.getDate()}</div>
                      {u > 0 && (
                        <div className="mt-auto font-mono text-[10px] text-text-2">{u}%</div>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-0" align="start">
                    <div className="px-4 pt-3 pb-2 border-b">
                      <div className="text-xs uppercase tracking-wider text-text-3 font-medium">
                        {WEEKDAYS[(date.getDay() + 6) % 7]}
                      </div>
                      <div className="font-display font-semibold">{fmtDateLong(date)}</div>
                      <div className="text-xs text-text-2 mt-0.5">Загрузка: {u}%</div>
                    </div>
                    <div className="p-2 space-y-1">
                      <Button asChild variant="ghost" className="w-full justify-start" size="sm">
                        <Link to={`/admin/orders/new?fromDate=${fromIso}&toDate=${toIso}`}>
                          <Plus className="size-4" /> Создать заказ
                        </Link>
                      </Button>
                      <Button asChild variant="ghost" className="w-full justify-start" size="sm">
                        <Link to={`/admin/orders?tab=active&from=${fromIso}&to=${fromIso}`}>
                          <ShoppingBag className="size-4" /> Заказы на этот день
                        </Link>
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs text-text-3 flex-wrap">
            <span>Загруженность парка:</span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-status-active-bg/40 border" /> 0–25%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-status-active-bg border" /> 25–50%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-status-pending-bg border" /> 50–75%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-status-overdue-bg border" /> 75–100%
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// =====================================================================
// === TIMELINE ПО ЕДИНИЦАМ (новый режим) ==============================
// =====================================================================

const DAYS_TO_SHOW = 21;
const LEFT_COL_PX = 260;
const DAY_MIN_WIDTH_PX = 38;

function reservationColor(status: TimelineReservation['status']): string {
  switch (status) {
    case 'PLANNED':
      return 'bg-blue-400 hover:bg-blue-500';
    case 'ACTIVE':
      return 'bg-emerald-500 hover:bg-emerald-600';
    case 'RETURNED':
      return 'bg-slate-400 hover:bg-slate-500';
  }
}

function TimelineView() {
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);

  const fromDate = cursor;
  const toDate = useMemo(() => new Date(cursor.getTime() + (DAYS_TO_SHOW - 1) * DAY_MS), [cursor]);

  const { data, isLoading } = useTimeline(fromDate.toISOString(), toDate.toISOString(), categoryId);
  const { data: categories } = useCategories();

  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < DAYS_TO_SHOW; i++) {
      out.push(new Date(cursor.getTime() + i * DAY_MS));
    }
    return out;
  }, [cursor]);

  const today = startOfDay(new Date());
  const goPrev = () => setCursor(new Date(cursor.getTime() - DAYS_TO_SHOW * DAY_MS));
  const goNext = () => setCursor(new Date(cursor.getTime() + DAYS_TO_SHOW * DAY_MS));
  const goToday = () => setCursor(startOfDay(new Date()));

  const stats = useMemo(() => {
    if (!data) return { totalUnits: 0, busyUnits: 0 };
    let total = 0;
    let busy = 0;
    for (const g of data.items ?? []) {
      total += g.units.length;
      busy += g.units.filter((u) => u.reservations.length > 0).length;
    }
    total += (data.unassigned ?? []).length;
    busy += (data.unassigned ?? []).filter((u) => u.reservations.length > 0).length;
    return { totalUnits: total, busyUnits: busy };
  }, [data]);

  const isEmpty = !!data && (data.items ?? []).length === 0 && (data.unassigned ?? []).length === 0;

  return (
    <div className="rounded-xl border bg-surface overflow-hidden">
      {/* === ПАНЕЛЬ УПРАВЛЕНИЯ === */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={goPrev} aria-label="Раньше">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            Сегодня
          </Button>
          <Button variant="outline" size="icon-sm" onClick={goNext} aria-label="Позже">
            <ChevronRight className="size-4" />
          </Button>
          <span className="ml-3 text-sm text-text-2 font-medium">
            {fmtDateLong(fromDate)} — {fmtDateLong(toDate)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-text-3" />
            <Select
              value={categoryId ? String(categoryId) : 'all'}
              onValueChange={(v) => setCategoryId(v === 'all' ? undefined : Number(v))}
            >
              <SelectTrigger className="w-56 h-9">
                <SelectValue placeholder="Все категории" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все категории</SelectItem>
                {(categories ?? []).map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {data && (
            <span className="text-xs text-text-3 font-mono">
              занято {stats.busyUnits} / {stats.totalUnits}
            </span>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="p-5">
          <Skeleton className="h-96" />
        </div>
      ) : isEmpty ? (
        <div className="p-12 text-center text-text-3">
          <Box className="size-12 mx-auto opacity-30 mb-3" />
          <p className="text-sm">
            {categoryId
              ? 'В этой категории нет единиц инвентаря.'
              : 'Инвентаря пока нет. Добавьте единицы в разделе «Оборудование → Инвентарь».'}
          </p>
        </div>
      ) : (
        <TooltipProvider delayDuration={150}>
          <div className="overflow-x-auto">
            <div style={{ minWidth: LEFT_COL_PX + DAYS_TO_SHOW * DAY_MIN_WIDTH_PX }}>
              <DaysHeader days={days} today={today} />

              {data!.items.map((group) => (
                <div key={group.catalogItemId} className="border-b last:border-b-0">
                  <div className="flex bg-surface-2/40 border-t">
                    <div
                      className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
                      style={{ width: LEFT_COL_PX }}
                    >
                      {group.photo ? (
                        <img
                          src={group.photo}
                          alt=""
                          className="size-7 rounded object-cover bg-surface-3 flex-shrink-0"
                        />
                      ) : (
                        <div className="size-7 rounded bg-surface-3 grid place-items-center flex-shrink-0">
                          <Box className="size-4 text-text-3" />
                        </div>
                      )}
                      <Link
                        to={`/admin/equipment/catalog/${group.catalogItemId}`}
                        className="text-sm font-semibold hover:text-blue truncate"
                        title={group.catalogName}
                      >
                        {group.catalogName}
                      </Link>
                      <span className="text-xs text-text-3 font-mono ml-auto flex-shrink-0">
                        {group.units.length}
                      </span>
                    </div>
                    <DayBackgrounds days={days} today={today} />
                  </div>

                  {group.units.map((unit) => (
                    <UnitRow
                      key={unit.id}
                      unit={unit}
                      days={days}
                      fromDate={fromDate}
                      today={today}
                    />
                  ))}
                </div>
              ))}

              {data!.unassigned.length > 0 && (
                <div className="border-t-2 border-amber-300/50">
                  <div className="flex bg-amber-50 dark:bg-amber-950/20">
                    <div
                      className="flex items-center gap-2 px-3 py-2 flex-shrink-0 text-sm text-amber-800 dark:text-amber-200"
                      style={{ width: LEFT_COL_PX }}
                    >
                      <AlertTriangle className="size-4" />
                      <span className="font-semibold">Без привязки к каталогу</span>
                      <span className="text-xs ml-auto font-mono opacity-70">
                        {data!.unassigned.length}
                      </span>
                    </div>
                    <DayBackgrounds days={days} today={today} />
                  </div>
                  {data!.unassigned.map((unit) => (
                    <UnitRow
                      key={unit.id}
                      unit={unit}
                      days={days}
                      fromDate={fromDate}
                      today={today}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </TooltipProvider>
      )}

      <div className="px-4 py-2.5 border-t flex items-center gap-4 text-xs text-text-3 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-blue-400" /> Запланировано
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-emerald-500" /> На руках
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-slate-400" /> Возвращено
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-surface-3 border" /> Свободно
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-red-100 border border-red-300" /> Сломано / списано
        </span>
      </div>
    </div>
  );
}

// ===== Подкомпоненты Timeline =====

interface DaysHeaderProps {
  days: Date[];
  today: Date;
}

function DaysHeader({ days, today }: DaysHeaderProps) {
  return (
    <div className="flex sticky top-0 bg-surface z-10 border-b">
      <div
        className="px-3 py-2 text-xs font-semibold text-text-3 uppercase tracking-wide flex-shrink-0"
        style={{ width: LEFT_COL_PX }}
      >
        Единица инвентаря
      </div>
      <div className="flex flex-1">
        {days.map((d) => {
          const isToday = d.getTime() === today.getTime();
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          return (
            <div
              key={d.toISOString()}
              className={cn(
                'flex-1 px-1 py-2 text-center text-[10px] border-l',
                isToday && 'bg-blue/10 text-blue font-semibold',
                !isToday && isWeekend && 'bg-surface-3/30 text-text-3',
              )}
              style={{ minWidth: DAY_MIN_WIDTH_PX }}
            >
              <div className="font-mono leading-none">{d.getDate()}</div>
              <div className="leading-none mt-0.5">{WEEKDAY_SHORT[d.getDay()]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface DayBackgroundsProps {
  days: Date[];
  today: Date;
}

function DayBackgrounds({ days, today }: DayBackgroundsProps) {
  return (
    <div className="flex flex-1">
      {days.map((d) => {
        const isToday = d.getTime() === today.getTime();
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        return (
          <div
            key={d.toISOString()}
            className={cn(
              'flex-1 border-l',
              isToday && 'bg-blue/5',
              !isToday && isWeekend && 'bg-surface-3/20',
            )}
            style={{ minWidth: DAY_MIN_WIDTH_PX }}
          />
        );
      })}
    </div>
  );
}

interface UnitRowProps {
  unit: TimelineUnit;
  days: Date[];
  fromDate: Date;
  today: Date;
}

function UnitRow({ unit, days, fromDate, today }: UnitRowProps) {
  const isUsable = unit.status === 'OPERATIONAL';

  return (
    <div className="flex border-t hover:bg-surface-3/20 transition-colors">
      <div
        className="flex items-center gap-2 px-3 py-2 min-w-0 flex-shrink-0"
        style={{ width: LEFT_COL_PX }}
      >
        <span className="text-xs text-text-3">№</span>
        <span className="font-mono text-sm truncate" title={unit.inventoryNumber}>
          {unit.inventoryNumber}
        </span>
        {!isUsable && (
          <span
            className={cn(
              'text-[10px] px-1.5 py-0.5 rounded font-medium ml-auto flex-shrink-0',
              unit.status === 'BROKEN' && 'bg-red-100 text-red-700',
              unit.status === 'RETIRED' && 'bg-slate-200 text-slate-600',
            )}
          >
            {unit.status === 'BROKEN' ? 'сломана' : 'списана'}
          </span>
        )}
      </div>

      <div className="flex flex-1 relative h-12">
        {days.map((d) => {
          const isToday = d.getTime() === today.getTime();
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          return (
            <div
              key={d.toISOString()}
              className={cn(
                'flex-1 border-l',
                isToday && 'bg-blue/5',
                !isToday && isWeekend && 'bg-surface-3/20',
                !isUsable && 'bg-red-50/50',
              )}
              style={{ minWidth: DAY_MIN_WIDTH_PX }}
            />
          );
        })}
        {unit.reservations.map((r) => (
          <ReservationBar
            key={r.id}
            reservation={r}
            days={days}
            fromDate={fromDate}
            unitInventoryNumber={unit.inventoryNumber}
          />
        ))}
      </div>
    </div>
  );
}

interface ReservationBarProps {
  reservation: TimelineReservation;
  days: Date[];
  fromDate: Date;
  unitInventoryNumber: string;
}

function ReservationBar({ reservation, days, fromDate, unitInventoryNumber }: ReservationBarProps) {
  const dayWidthPercent = 100 / days.length;
  const resFrom = startOfDay(new Date(reservation.fromDate));
  const resTo = startOfDay(new Date(reservation.toDate));
  const lastVisibleDay = days[days.length - 1];

  const startDay = Math.max(0, Math.round((resFrom.getTime() - fromDate.getTime()) / DAY_MS));
  const endDay = Math.min(
    days.length - 1,
    Math.round((resTo.getTime() - fromDate.getTime()) / DAY_MS),
  );

  if (startDay > days.length - 1 || endDay < 0) return null;

  const left = startDay * dayWidthPercent;
  const width = (endDay - startDay + 1) * dayWidthPercent;

  const truncatedLeft = resFrom.getTime() < fromDate.getTime();
  const truncatedRight = resTo.getTime() > lastVisibleDay.getTime();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={`/admin/orders/${reservation.orderId}`}
          className={cn(
            'absolute top-1.5 h-9 rounded text-[11px] text-white font-medium px-2 flex items-center gap-1 truncate transition-all shadow-sm',
            reservationColor(reservation.status),
            truncatedLeft && 'rounded-l-none',
            truncatedRight && 'rounded-r-none',
          )}
          style={{ left: `${left}%`, width: `calc(${width}% - 2px)` }}
        >
          {truncatedLeft && <span className="opacity-70">←</span>}
          <span className="truncate">{reservation.orderNumber}</span>
          {truncatedRight && <span className="opacity-70 ml-auto">→</span>}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <ShoppingBag className="size-3.5" />
            <span className="font-semibold">{reservation.orderNumber}</span>
            <span className="text-xs opacity-75">
              {reservation.status === 'PLANNED'
                ? 'запланирован'
                : reservation.status === 'ACTIVE'
                  ? 'на руках'
                  : 'возвращён'}
            </span>
          </div>
          <div className="text-xs">
            <strong>{reservation.clientName}</strong>
          </div>
          <div className="text-xs opacity-75">Единица №{unitInventoryNumber}</div>
          <div className="text-xs opacity-75">
            {fmtDateLong(resFrom)} — {fmtDateLong(resTo)}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
