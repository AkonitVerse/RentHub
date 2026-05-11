import { useState } from 'react';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { OrderStatusBadge } from '@/components/shared/StatusBadge';
import { useChangeOrderStatus } from '@/lib/hooks/queries';
import { getAllowedNextStatuses, ORDER_STATUS_LABELS } from '@/lib/utils/order-status';
import { apiErrorMessage } from '@/lib/api/client';
import type { OrderStatus } from '@/lib/api/types';
import { cn } from '@/lib/utils/cn';

interface Props {
  orderId: number;
  orderNumber: string;
  status: OrderStatus;
  /** Размер бейджа: small (для строк) или default. */
  compact?: boolean;
  /** Дополнительный класс на trigger. */
  className?: string;
}

/**
 * Кликабельный бейдж статуса. По клику — popover с разрешёнными переходами.
 * Сразу мутирует через useChangeOrderStatus и показывает toast.
 *
 * Используется в kanban-карточках и таблице заказов вместо открытия деталки.
 */
export function InlineStatusEditor({
  orderId,
  orderNumber,
  status,
  compact = false,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const change = useChangeOrderStatus();
  const allowed = getAllowedNextStatuses(status);

  const handleSelect = async (next: OrderStatus) => {
    setOpen(false);
    try {
      await change.mutateAsync({ id: orderId, status: next });
      toast.success(`${orderNumber} → ${ORDER_STATUS_LABELS[next]}`);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось обновить статус'));
    }
  };

  if (allowed.length === 0) {
    // Терминальный — просто показываем бейдж без интерактивности
    return <OrderStatusBadge status={status} className={className} />;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'group inline-flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity',
            compact && 'text-xs',
            className,
          )}
          title="Изменить статус"
          disabled={change.isPending}
        >
          <OrderStatusBadge status={status} />
          {change.isPending ? (
            <Loader2 className="size-3 animate-spin text-text-3" />
          ) : (
            <ChevronDown className="size-3 text-text-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="p-1 w-56"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-text-3 font-medium">
          Сменить статус
        </div>
        <div className="space-y-0.5">
          {allowed.map((next) => (
            <button
              key={next}
              type="button"
              onClick={() => handleSelect(next)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-surface-2 transition-colors text-left"
            >
              <Check className="size-3.5 opacity-0" />
              <OrderStatusBadge status={next} />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
