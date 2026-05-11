import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCancelMyOrder, useMyOrder, useOrgContact } from '@/lib/hooks/queries';
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from '@/lib/utils/order-status';
import { fmtRub } from '@/lib/utils/format';
import { formatPhoneInput } from '@/lib/utils/phone';
import { cn } from '@/lib/utils/cn';
import { apiErrorMessage } from '@/lib/api/client';

export function MyOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const orderId = id ? Number(id) : undefined;
  const { data: order, isLoading } = useMyOrder(orderId);
  const cancel = useCancelMyOrder();
  const [cancelling, setCancelling] = useState(false);
  const { data: orgContact } = useOrgContact();
  const orgPhoneFormatted = orgContact?.orgPhone
    ? formatPhoneInput(orgContact.orgPhone).trim()
    : '';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-text-3">
        <Loader2 className="size-5 animate-spin mr-2" /> Загрузка…
      </div>
    );
  }
  if (!order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center">
        <p className="text-text-3">Заказ не найден.</p>
        <Link to="/me/profile?tab=orders" className="text-blue hover:underline mt-3 inline-block">
          ← К списку
        </Link>
      </div>
    );
  }

  const canCancel = order.status === 'DRAFT' || order.status === 'PENDING';
  const colors = ORDER_STATUS_COLORS[order.status];
  const fromStr = order.fromDate
    ? new Date(order.fromDate).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '—';
  const toStr = order.toDate
    ? new Date(order.toDate).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '—';

  const handleCancel = async () => {
    if (!orderId) return;
    if (!confirm('Точно отменить заказ? Действие необратимо.')) return;
    setCancelling(true);
    try {
      await cancel.mutateAsync(orderId);
      toast.success('Заказ отменён');
      navigate('/me/profile?tab=orders');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось отменить'));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <Link
        to="/me/profile?tab=orders"
        className="inline-flex items-center gap-1 text-sm text-text-3 hover:text-text mb-4"
      >
        <ChevronLeft className="size-4" /> К списку заказов
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <h1 className="font-display font-bold text-3xl font-mono">{order.number}</h1>
        <span
          className={cn(
            'px-2.5 py-0.5 rounded-full text-xs font-medium border',
            colors.bg,
            colors.text,
            colors.border,
          )}
        >
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>
      <p className="text-text-2 text-sm mb-8">
        Создан {new Date(order.createdAt).toLocaleString('ru-RU')}
      </p>

      <section className="rounded-xl border bg-surface p-6 mb-6">
        <h2 className="font-semibold mb-4">Период аренды</h2>
        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-text-3 text-xs uppercase tracking-wide">С</div>
            <div className="font-medium mt-1">{fromStr}</div>
          </div>
          <div>
            <div className="text-text-3 text-xs uppercase tracking-wide">По</div>
            <div className="font-medium mt-1">{toStr}</div>
          </div>
          <div>
            <div className="text-text-3 text-xs uppercase tracking-wide">Дней</div>
            <div className="font-medium mt-1">{order.daysCount ?? '—'}</div>
          </div>
        </div>
      </section>

      {order.inquiryNote && (
        <section className="rounded-xl border bg-blue-soft p-4 mb-6 text-sm">
          <div className="text-text-3 text-xs uppercase tracking-wide mb-1">Ваше сообщение</div>
          <div>{order.inquiryNote}</div>
        </section>
      )}

      <section className="rounded-xl border bg-surface p-6 mb-6">
        <h2 className="font-semibold mb-4">Позиции</h2>
        {!order.lines || order.lines.length === 0 ? (
          <p className="text-text-3 text-sm">
            Пока без позиций — менеджер дозаполнит после связи с вами.
          </p>
        ) : (
          <ul className="divide-y">
            {order.lines.map((line) => (
              <li key={line.id} className="py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">
                    {line.equipment?.name ?? `#${line.equipmentId}`}
                  </div>
                  <div className="text-xs text-text-3 mt-0.5">
                    {line.qty} × {line.days} сут × {fmtRub(line.unitPriceNet)}
                  </div>
                </div>
                <div className="font-mono font-semibold">{fmtRub(line.sumAmount)}</div>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t mt-4 pt-4 flex justify-between items-center">
          <span className="text-text-3 text-sm">Итого</span>
          <span className="font-display font-bold text-2xl price">{fmtRub(order.totalAmount)}</span>
        </div>
        {order.deposit > 0 && (
          <div className="flex justify-between items-center text-xs text-text-3 mt-1">
            <span>Залог</span>
            <span className="font-mono">{fmtRub(order.deposit)}</span>
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-surface p-6 mb-6">
        <h2 className="font-semibold mb-4">Доставка</h2>
        <div className="text-sm space-y-1">
          <div>
            <span className="text-text-3">Способ: </span>
            {order.deliveryMethod === 'DELIVERY' ? 'Доставка' : 'Самовывоз'}
          </div>
          {order.address && (
            <div>
              <span className="text-text-3">Адрес: </span>
              {order.address}
            </div>
          )}
          <div>
            <span className="text-text-3">Контакт: </span>
            {order.contactPhone}
          </div>
          {order.contactEmail && (
            <div>
              <span className="text-text-3">Email: </span>
              {order.contactEmail}
            </div>
          )}
        </div>
      </section>

      {canCancel && (
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={cancelling}
          className="w-full text-status-overdue hover:text-status-overdue"
        >
          {cancelling ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
          Отменить заказ
        </Button>
      )}
      {!canCancel && (
        <p className="text-xs text-text-3 text-center">
          Для изменений или отмены свяжитесь с менеджером
          {orgPhoneFormatted && (
            <>
              :{' '}
              <a href={`tel:${orgContact?.orgPhone ?? ''}`} className="text-blue hover:underline">
                {orgPhoneFormatted}
              </a>
            </>
          )}
          .
        </p>
      )}
    </div>
  );
}
