import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Order } from '@/lib/api/types';
import { fmtDate, fmtRub } from '@/lib/utils/format';
import { OrderStatusBadge } from '@/components/shared/StatusBadge';
import { cn } from '@/lib/utils/cn';

interface OrderRowProps {
  order: Order;
  /** Какую дату показывать справа: возврат (toDate) или выдача (fromDate). */
  dateField?: 'fromDate' | 'toDate';
  /** Доп. слот справа — обычно primary action кнопкой. */
  action?: ReactNode;
  /** Доп. подсветка строки (для просрочек). */
  emphasize?: boolean;
}

export function OrderRow({ order, dateField = 'toDate', action, emphasize }: OrderRowProps) {
  const dateValue = order[dateField];

  return (
    <div
      className={cn(
        'group rounded-lg border px-3 py-2.5 hover:bg-surface-2 transition-colors',
        emphasize && 'border-status-overdue/30 bg-status-overdue-bg/30',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link to={`/admin/orders/${order.id}`} className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-mono text-xs text-text-3">{order.number}</span>
            <OrderStatusBadge status={order.status} />
          </div>
          <div className="font-medium text-sm truncate">
            {order.client?.name ?? '— без клиента'}
          </div>
          {order.client?.phone && (
            <div className="font-mono text-xs text-text-3 truncate mt-0.5">
              {order.client.phone}
            </div>
          )}
        </Link>
        {action ?? (
          <Link
            to={`/admin/orders/${order.id}`}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-surface-3"
          >
            <ArrowRight className="size-4 text-text-3" />
          </Link>
        )}
      </div>
      {(dateValue || order.totalAmount > 0) && (
        <div className="mt-2 flex items-center justify-between text-xs">
          {dateValue && (
            <span className={cn('text-text-3', emphasize && 'text-status-overdue font-medium')}>
              {dateField === 'toDate' ? 'до' : 'с'} {fmtDate(dateValue)}
            </span>
          )}
          {order.totalAmount > 0 && (
            <span className="font-mono font-semibold">{fmtRub(order.totalAmount)}</span>
          )}
        </div>
      )}
    </div>
  );
}
