import { useState } from 'react';
import { ArrowRight, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useAddTier,
  useDeleteLastTier,
  useRecalculateTier,
  useTierRecalcPreview,
  useTiers,
  useUpdateTierBoundary,
} from '@/lib/hooks/queries';
import { apiErrorMessage } from '@/lib/api/client';
import { fmtRub } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { PricingTier } from '@/lib/api/types';
import type { RecalcPreview } from '@/lib/api/endpoints';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function describeTier(t: PricingTier): string {
  if (t.maxDays == null) return `Тир ${t.rank}: от ${t.minDays} сут (открытый)`;
  if (t.minDays === t.maxDays) return `Тир ${t.rank}: ${t.minDays} сут`;
  return `Тир ${t.rank}: ${t.minDays}–${t.maxDays} сут`;
}

export function PricingTiersDialog({ open, onOpenChange }: Props) {
  const { data: tiers, isLoading } = useTiers();
  const add = useAddTier();
  const updateBoundary = useUpdateTierBoundary();
  const deleteLast = useDeleteLastTier();
  const recalc = useRecalculateTier();
  const previewQuery = useTierRecalcPreview();

  const [showAdd, setShowAdd] = useState(false);
  const [closeAt, setCloseAt] = useState<number>(7);
  const [discount, setDiscount] = useState<number>(10);
  const [editBoundary, setEditBoundary] = useState<{ tierId: number; value: number } | null>(null);

  // Состояние пересчёта: 'pick' — выбор скидки, 'preview' — предпросмотр, 'applying' — применение
  const [recalcDialog, setRecalcDialog] = useState<{
    tierId: number;
    value: number;
    preview: RecalcPreview | null;
    step: 'pick' | 'preview';
  } | null>(null);

  const handleAdd = async () => {
    try {
      await add.mutateAsync({ closeAtDays: closeAt, discountPercent: discount });
      toast.success('Тир добавлен, цены пересчитаны');
      setShowAdd(false);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось добавить тир'));
    }
  };

  const handleUpdateBoundary = async () => {
    if (!editBoundary) return;
    try {
      await updateBoundary.mutateAsync({
        tierId: editBoundary.tierId,
        maxDays: editBoundary.value,
      });
      toast.success('Граница изменена');
      setEditBoundary(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось изменить границу'));
    }
  };

  const handleDeleteLast = async () => {
    if (!confirm('Удалить последний тир? Все цены этого тира будут удалены.')) return;
    try {
      await deleteLast.mutateAsync();
      toast.success('Последний тир удалён');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось удалить'));
    }
  };

  const handlePreview = async () => {
    if (!recalcDialog) return;
    try {
      const preview = await previewQuery.mutateAsync({
        tierId: recalcDialog.tierId,
        discountPercent: recalcDialog.value,
      });
      setRecalcDialog({ ...recalcDialog, preview, step: 'preview' });
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось получить предпросмотр'));
    }
  };

  const handleApplyRecalc = async () => {
    if (!recalcDialog) return;
    try {
      const res = await recalc.mutateAsync({
        tierId: recalcDialog.tierId,
        discountPercent: recalcDialog.value,
      });
      toast.success(`Пересчитано: ${res.updated} карточек, пропущено ${res.skipped}`);
      setRecalcDialog(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось пересчитать'));
    }
  };

  const lastTier = tiers && tiers.length > 0 ? tiers[tiers.length - 1] : null;
  const canAdd = (tiers?.length ?? 0) < 5 && lastTier?.maxDays === null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Управление ценовыми тирами</DialogTitle>
          <DialogDescription>
            До 5 тиров. Последний всегда открытый. Скидка применяется от цены тира 1.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center">
            <Loader2 className="size-8 animate-spin mx-auto text-blue" />
          </div>
        ) : (
          <div className="space-y-2">
            {tiers?.map((t, idx) => {
              const isLast = idx === (tiers?.length ?? 0) - 1;
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border p-3 bg-surface-2"
                >
                  <div>
                    <div className="font-medium">{describeTier(t)}</div>
                    {t.note && <div className="text-xs text-text-3">{t.note}</div>}
                  </div>
                  <div className="flex gap-1">
                    {!isLast && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setEditBoundary({ tierId: t.id, value: t.maxDays ?? t.minDays })
                        }
                      >
                        Граница
                      </Button>
                    )}
                    {idx > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setRecalcDialog({ tierId: t.id, value: 10, preview: null, step: 'pick' })
                        }
                      >
                        <RefreshCw className="size-3.5" /> Пересчёт
                      </Button>
                    )}
                    {isLast && (tiers?.length ?? 0) > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleDeleteLast}
                        disabled={deleteLast.isPending}
                      >
                        <Trash2 className="size-3.5 text-status-overdue" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {showAdd ? (
              <div className="rounded-lg border p-3 bg-blue-soft space-y-3">
                <div>
                  <Label className="text-xs">Закрыть текущий открытый тир на (дней)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={closeAt}
                    onChange={(e) => setCloseAt(Number(e.target.value))}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-xs">Скидка нового тира, %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="mt-1.5"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>
                    Отмена
                  </Button>
                  <Button size="sm" onClick={handleAdd} disabled={add.isPending}>
                    {add.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Plus className="size-4" />
                    )}
                    Добавить
                  </Button>
                </div>
              </div>
            ) : (
              canAdd && (
                <Button variant="outline" className="w-full" onClick={() => setShowAdd(true)}>
                  <Plus className="size-4" /> Добавить тир
                </Button>
              )
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </DialogFooter>

        {/* Sub-dialog: edit boundary */}
        <Dialog open={editBoundary !== null} onOpenChange={(o) => !o && setEditBoundary(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Изменить границу тира</DialogTitle>
              <DialogDescription>
                Цены не изменятся, изменится только диапазон дней
              </DialogDescription>
            </DialogHeader>
            <Label>Новая верхняя граница (дней)</Label>
            <Input
              type="number"
              min={1}
              value={editBoundary?.value ?? 0}
              onChange={(e) =>
                setEditBoundary(
                  editBoundary ? { ...editBoundary, value: Number(e.target.value) } : null,
                )
              }
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditBoundary(null)}>
                Отмена
              </Button>
              <Button onClick={handleUpdateBoundary} disabled={updateBoundary.isPending}>
                {updateBoundary.isPending && <Loader2 className="size-4 animate-spin" />}
                Сохранить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Sub-dialog: recalculate (pick → preview → apply) */}
        <Dialog open={recalcDialog !== null} onOpenChange={(o) => !o && setRecalcDialog(null)}>
          <DialogContent
            className={cn(recalcDialog?.step === 'preview' ? 'max-w-2xl' : 'max-w-md')}
          >
            {recalcDialog?.step === 'pick' ? (
              <>
                <DialogHeader>
                  <DialogTitle>Пересчитать цены тира</DialogTitle>
                  <DialogDescription>
                    Цена тира пересчитается как Math.ceil(цена тира 1 × (100 − скидка) / 100).
                    Сначала посмотрите превью, потом подтвердите.
                  </DialogDescription>
                </DialogHeader>
                <Label>Скидка, %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={recalcDialog.value}
                  onChange={(e) =>
                    setRecalcDialog({ ...recalcDialog, value: Number(e.target.value) })
                  }
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRecalcDialog(null)}>
                    Отмена
                  </Button>
                  <Button onClick={handlePreview} disabled={previewQuery.isPending}>
                    {previewQuery.isPending && <Loader2 className="size-4 animate-spin" />}
                    Превью изменений <ArrowRight className="size-4" />
                  </Button>
                </DialogFooter>
              </>
            ) : recalcDialog?.step === 'preview' && recalcDialog.preview ? (
              <>
                <DialogHeader>
                  <DialogTitle>
                    Превью пересчёта · скидка {recalcDialog.preview.discountPercent}%
                  </DialogTitle>
                  <DialogDescription>
                    Изменится: <b>{recalcDialog.preview.summary.willChange}</b>, появится новых:{' '}
                    <b>{recalcDialog.preview.summary.willCreate}</b>, без изменений:{' '}
                    <b>{recalcDialog.preview.summary.unchanged}</b> из{' '}
                    {recalcDialog.preview.summary.total}
                  </DialogDescription>
                </DialogHeader>

                <div className="max-h-80 overflow-y-auto rounded-lg border bg-surface">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-2 text-text-3 text-xs uppercase tracking-wide">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Карточка</th>
                        <th className="text-right px-3 py-2 font-medium">База (тир 1)</th>
                        <th className="text-right px-3 py-2 font-medium">Сейчас</th>
                        <th className="text-right px-3 py-2 font-medium">Станет</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {recalcDialog.preview.items.map((item) => (
                        <tr
                          key={item.catalogItemId}
                          className={cn(item.changed ? 'bg-blue-soft/30' : 'opacity-60')}
                        >
                          <td className="px-3 py-2">
                            <div className="font-medium">{item.catalogItemName}</div>
                            <div className="text-[10px] text-text-3 font-mono">{item.sku}</div>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {fmtRub(item.tierOnePrice)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {item.currentPrice == null ? '—' : fmtRub(item.currentPrice)}
                          </td>
                          <td
                            className={cn(
                              'px-3 py-2 text-right font-mono text-xs font-semibold',
                              item.changed && 'text-blue',
                            )}
                          >
                            {fmtRub(item.newPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setRecalcDialog({ ...recalcDialog, preview: null, step: 'pick' })
                    }
                  >
                    Назад
                  </Button>
                  <Button onClick={handleApplyRecalc} disabled={recalc.isPending}>
                    {recalc.isPending && <Loader2 className="size-4 animate-spin" />}
                    Применить
                  </Button>
                </DialogFooter>
              </>
            ) : null}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
