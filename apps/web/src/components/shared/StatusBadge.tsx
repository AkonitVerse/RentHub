import type {
  OrderStatus,
  OrderSource,
  WarehouseAvailability,
  WarehouseItemStatus,
} from '@/lib/api/types';
import { cn } from '@/lib/utils/cn';
import {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  ORDER_SOURCE_LABELS,
} from '@/lib/utils/order-status';

const WAREHOUSE_STATUS_LABELS: Record<WarehouseItemStatus, string> = {
  OPERATIONAL: 'Доступно',
  BROKEN: 'На обслуживании',
  RETIRED: 'Списана',
};

const WAREHOUSE_STATUS_STYLES: Record<WarehouseItemStatus, string> = {
  OPERATIONAL: 'bg-emerald-100 text-emerald-800',
  BROKEN: 'bg-red-100 text-red-800',
  RETIRED: 'bg-slate-100 text-slate-600',
};

const AVAILABILITY_LABELS: Record<WarehouseAvailability, string> = {
  AVAILABLE: 'Свободна сейчас',
  RESERVED: 'Зарезервирована',
  RENTED: 'В аренде',
  BROKEN: 'На обслуживании',
  RETIRED: 'Списана',
};

const AVAILABILITY_STYLES: Record<WarehouseAvailability, string> = {
  AVAILABLE: 'bg-emerald-100 text-emerald-800',
  RESERVED: 'bg-amber-100 text-amber-800',
  RENTED: 'bg-blue-100 text-blue-800',
  BROKEN: 'bg-red-100 text-red-800',
  RETIRED: 'bg-slate-100 text-slate-600',
};

const SOURCE_STYLES: Record<OrderSource, string> = {
  MANUAL: 'bg-slate-100 text-slate-700',
  WEB_CART: 'bg-blue-100 text-blue-800',
  WEB_INQUIRY: 'bg-amber-100 text-amber-800',
};

interface OrderStatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const colors = ORDER_STATUS_COLORS[status];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap border',
        colors.bg,
        colors.text,
        colors.border,
        className,
      )}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

export function OrderSourceBadge({
  source,
  className,
}: {
  source: OrderSource;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap',
        SOURCE_STYLES[source],
        className,
      )}
    >
      {ORDER_SOURCE_LABELS[source]}
    </span>
  );
}

export function WarehouseStatusBadge({
  status,
  className,
}: {
  status: WarehouseItemStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        WAREHOUSE_STATUS_STYLES[status],
        className,
      )}
    >
      {WAREHOUSE_STATUS_LABELS[status]}
    </span>
  );
}

export function AvailabilityBadge({
  availability,
  className,
}: {
  availability: WarehouseAvailability;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        AVAILABILITY_STYLES[availability],
        className,
      )}
    >
      {AVAILABILITY_LABELS[availability]}
    </span>
  );
}

export const orderStatusLabel = (status: OrderStatus) => ORDER_STATUS_LABELS[status];
export const orderSourceLabel = (source: OrderSource) => ORDER_SOURCE_LABELS[source];
export const warehouseStatusLabel = (status: WarehouseItemStatus) =>
  WAREHOUSE_STATUS_LABELS[status];
export const availabilityLabel = (availability: WarehouseAvailability) =>
  AVAILABILITY_LABELS[availability];
