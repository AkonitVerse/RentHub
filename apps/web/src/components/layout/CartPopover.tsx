import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShoppingBag,
  Trash2,
  Minus,
  Plus,
  ArrowRight,
  Package,
  AlertCircle,
  Calendar,
  Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { useCart, useClearCart, useRemoveCartLine, useUpdateCartLine } from '@/lib/hooks/queries';
import { fmtRub, fmtDate } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { apiErrorMessage } from '@/lib/api/client';
import type { CartLineComputed } from '@/lib/api/types';

function tierLabel(line: CartLineComputed): string | null {
  if (line.tierRank == null) return null;
  if (line.tierMaxDays == null) return `Тариф ${line.tierRank}: от ${line.tierMinDays} сут`;
  if (line.tierMinDays === line.tierMaxDays)
    return `Тариф ${line.tierRank}: ${line.tierMinDays} сут`;
  return `Тариф ${line.tierRank}: ${line.tierMinDays}–${line.tierMaxDays} сут`;
}

export function CartPopover() {
  const [open, setOpen] = useState(false);
  const { data: cart } = useCart();
  const removeLine = useRemoveCartLine();
  const updateLine = useUpdateCartLine();
  const clear = useClearCart();

  const lines = cart?.lines ?? [];
  // totalQty с бэка (sum qty по всем позициям) — для бейджа
  const totalQty = cart?.totalQty ?? lines.reduce((s, l) => s + l.qty, 0);

  const handleQty = async (idx: number, qty: number) => {
    if (qty < 1) return;
    try {
      await updateLine.mutateAsync({ idx, data: { qty } });
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось обновить'));
    }
  };

  const handleRemove = async (idx: number) => {
    try {
      await removeLine.mutateAsync(idx);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось удалить'));
    }
  };

  const handleClear = async () => {
    try {
      await clear.mutateAsync();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось очистить'));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <ShoppingBag className="size-4" />
          {totalQty > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1.5 -right-1.5"
            >
              <Badge
                variant="default"
                className="px-1.5 py-0 h-5 min-w-5 justify-center text-[10px] rounded-full"
              >
                {totalQty}
              </Badge>
            </motion.span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[420px] p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <div className="font-display font-semibold text-sm">Корзина</div>
            <div className="text-[11px] text-text-3 font-mono mt-0.5">
              {totalQty > 0 ? `${totalQty} ед. в ${lines.length} позициях` : 'пусто'}
            </div>
          </div>
          {lines.length > 0 && (
            <button
              onClick={handleClear}
              className="text-[11px] text-text-3 hover:text-status-overdue underline-offset-2 hover:underline"
            >
              очистить
            </button>
          )}
        </div>

        {lines.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <div className="size-12 rounded-full bg-surface-2 grid place-items-center mx-auto mb-3 text-text-4">
              <Package className="size-5" />
            </div>
            <div className="text-sm text-text-2">Корзина пуста</div>
            <div className="text-xs text-text-3 mt-1">Откройте каталог и нажмите «В корзину»</div>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setOpen(false)}
            >
              <Link to="/catalog">К каталогу</Link>
            </Button>
          </div>
        ) : (
          <>
            <ul className="max-h-[440px] overflow-y-auto divide-y divide-border">
              {lines.map((line, idx) => (
                <li
                  key={`${line.catalogItemId}-${idx}`}
                  className={cn(
                    'px-4 py-3 flex items-start gap-3 hover:bg-surface-2/60 transition-colors',
                    !line.available && 'bg-status-overdue-bg/30',
                  )}
                >
                  <div className="size-12 rounded-md bg-surface-2 border border-border grid place-items-center flex-shrink-0 overflow-hidden">
                    {line.photo ? (
                      <img src={line.photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Package className="size-5 text-text-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/equipment/${line.catalogItemId}`}
                      onClick={() => setOpen(false)}
                      className="text-sm font-medium leading-tight line-clamp-2 hover:text-blue"
                    >
                      {line.name}
                    </Link>
                    <div className="text-[11px] text-text-3 font-mono mt-0.5">{line.sku}</div>

                    {/* Даты бронирования */}
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-text-2">
                      <Calendar className="size-3 text-text-3" />
                      <span>
                        {fmtDate(line.fromDate)} – {fmtDate(line.toDate)} ·{' '}
                        <span className="font-mono">{line.days} сут</span>
                      </span>
                    </div>

                    {/* Тариф */}
                    {tierLabel(line) && (
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-blue">
                        <Tag className="size-3" />
                        <span>{tierLabel(line)}</span>
                      </div>
                    )}

                    {!line.available && (
                      <div className="mt-1 inline-flex items-center gap-1 text-xs text-status-overdue">
                        <AlertCircle className="size-3" />
                        Свободно {line.freeQty} из {line.qty} на эти даты
                      </div>
                    )}

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="inline-flex items-center border border-border rounded-md">
                        <button
                          onClick={() => handleQty(idx, line.qty - 1)}
                          disabled={line.qty <= 1 || updateLine.isPending}
                          className="size-6 grid place-items-center text-text-2 hover:text-text disabled:opacity-30"
                          aria-label="Уменьшить"
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="font-mono text-xs w-6 text-center select-none">
                          {line.qty}
                        </span>
                        <button
                          onClick={() => handleQty(idx, line.qty + 1)}
                          disabled={updateLine.isPending}
                          className="size-6 grid place-items-center text-text-2 hover:text-text"
                          aria-label="Увеличить"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>
                      <div className="font-mono text-[11px] text-text-3">
                        {fmtRub(line.unitPriceNet)} × {line.qty} × {line.days}
                      </div>
                    </div>
                    <div className="text-right text-xs font-semibold mt-1">
                      {fmtRub(line.sumAmount)}
                    </div>
                    {line.deposit > 0 && (
                      <div className="text-right text-[10px] text-text-3 mt-0.5">
                        + залог {fmtRub(line.deposit * line.qty)}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemove(idx)}
                    disabled={removeLine.isPending}
                    className="text-text-4 hover:text-status-overdue transition-colors flex-shrink-0"
                    aria-label="Удалить"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>

            <Separator />

            <div className="px-4 py-3 space-y-2">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-text-3">Сумма аренды</span>
                <span className="font-display font-bold text-base price">
                  {fmtRub(cart?.totalAmount ?? 0)}
                </span>
              </div>
              {(cart?.totalDeposit ?? 0) > 0 && (
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-text-3">Сумма залогов</span>
                  <span className="font-mono text-text-2">{fmtRub(cart?.totalDeposit ?? 0)}</span>
                </div>
              )}
              {cart?.hasIssues && (
                <div className="rounded-md bg-status-overdue-bg p-2 text-xs text-status-overdue flex items-start gap-1.5">
                  <AlertCircle className="size-3.5 flex-shrink-0 mt-0.5" />
                  <span>
                    Есть позиции с проблемами доступности — оформление будет заблокировано до
                    изменения дат или количества.
                  </span>
                </div>
              )}
              <Button
                asChild
                className="w-full mt-2"
                onClick={() => setOpen(false)}
                disabled={cart?.hasIssues}
              >
                <Link to="/contact">
                  Оформить заявку
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
