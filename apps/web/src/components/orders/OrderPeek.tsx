import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Calendar,
  ExternalLink,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  X,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { OrderSourceBadge } from '@/components/shared/StatusBadge';
import { InlineStatusEditor } from '@/components/orders/InlineStatusEditor';
import { useOrder } from '@/lib/hooks/queries';
import { usePeekStore } from '@/lib/stores/peek-store';
import { fmtDate, fmtDays, fmtPhone, fmtRub } from '@/lib/utils/format';

/**
 * Боковая панель с превью заказа. Открывается из списков (table/kanban),
 * управляется глобальным `usePeekStore`. В отличие от деталки — не теряем контекст списка.
 */
export function OrderPeek() {
  const peek = usePeekStore((s) => s.peek);
  const close = usePeekStore((s) => s.close);
  const isOpen = peek?.type === 'order';
  const orderId = isOpen ? peek!.id : undefined;
  const { data: order, isLoading } = useOrder(orderId);

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && close()}>
      <SheetContent className="w-full sm:max-w-lg p-0 gap-0">
        {isLoading || !order ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-32" />
            <Skeleton className="h-24" />
          </div>
        ) : (
          <>
            <SheetHeader className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <SheetTitle className="font-mono">{order.number}</SheetTitle>
                <InlineStatusEditor
                  orderId={order.id}
                  orderNumber={order.number}
                  status={order.status}
                />
                {order.source !== 'MANUAL' && <OrderSourceBadge source={order.source} />}
              </div>
              {order.client && (
                <SheetDescription>
                  {order.client.name} · {fmtPhone(order.contactPhone)}
                </SheetDescription>
              )}
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {order.source === 'WEB_INQUIRY' && order.inquiryNote && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex gap-2">
                  <MessageSquare className="size-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900/80">{order.inquiryNote}</div>
                </div>
              )}

              <section>
                <h3 className="text-xs uppercase tracking-wider text-text-3 font-medium mb-2">
                  Сроки
                </h3>
                <div className="rounded-lg border bg-surface-2 p-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-text-2">
                      <Calendar className="size-4" /> Период
                    </span>
                    <span className="font-mono">
                      {fmtDate(order.fromDate)} → {fmtDate(order.toDate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-2">Длительность</span>
                    <span className="font-mono font-semibold">{fmtDays(order.daysCount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-2">Доставка</span>
                    <span>{order.deliveryMethod === 'DELIVERY' ? 'Доставка' : 'Самовывоз'}</span>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-xs uppercase tracking-wider text-text-3 font-medium mb-2">
                  Позиции ({order.lines?.length ?? 0})
                </h3>
                {!order.lines?.length ? (
                  <div className="text-sm text-text-3 italic">Без позиций</div>
                ) : (
                  <ul className="space-y-1.5">
                    {order.lines.map((line) => (
                      <li
                        key={line.id}
                        className="flex items-start justify-between gap-2 rounded-md border bg-surface-2 p-2.5 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{line.equipment?.name}</div>
                          <div className="font-mono text-[10px] text-text-3">
                            {line.equipment?.sku} · {line.qty} × {line.days} дн.
                          </div>
                        </div>
                        <div className="font-mono text-sm font-semibold whitespace-nowrap">
                          {fmtRub(line.sumAmount)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="text-xs uppercase tracking-wider text-text-3 font-medium mb-2">
                  Клиент
                </h3>
                <div className="rounded-lg border bg-surface-2 p-3 space-y-1.5 text-sm">
                  {order.client && (
                    <Link
                      to={`/admin/customers/${order.client.id}`}
                      className="font-medium hover:text-blue inline-flex items-center gap-1"
                    >
                      {order.client.name}
                      <ExternalLink className="size-3" />
                    </Link>
                  )}
                  <div className="flex items-center gap-2 text-text-2">
                    <Phone className="size-4" /> {fmtPhone(order.contactPhone)}
                  </div>
                  {order.contactEmail && (
                    <div className="flex items-center gap-2 text-text-2">
                      <Mail className="size-4" /> {order.contactEmail}
                    </div>
                  )}
                  {order.address && (
                    <div className="flex items-start gap-2 text-text-2">
                      <MapPin className="size-4 flex-shrink-0 mt-0.5" />
                      <span className="text-xs">{order.address}</span>
                    </div>
                  )}
                </div>
              </section>

              <section className="flex items-center justify-between pt-2 border-t">
                <div className="text-text-3 text-xs uppercase tracking-wide">Сумма</div>
                <div className="font-display font-bold text-2xl price">
                  {fmtRub(order.totalAmount)}
                </div>
              </section>
            </div>

            <SheetFooter>
              <Button variant="outline" onClick={close} className="sm:flex-1">
                <X className="size-4" /> Закрыть
              </Button>
              <Button asChild className="sm:flex-1">
                <Link to={`/admin/orders/${order.id}`} onClick={close}>
                  <ArrowUpRight className="size-4" /> Открыть полностью
                </Link>
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
