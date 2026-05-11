import { useState } from 'react';
import { ArrowRight, Layers, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
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
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
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
import { RoleGuard } from '@/components/shared/RoleGuard';

function describeTier(t: PricingTier): string {
  if (t.maxDays == null) return `от ${t.minDays} сут (открытый)`;
  if (t.minDays === t.maxDays) return `${t.minDays} сут`;
  return `${t.minDays}–${t.maxDays} сут`;
}

export function PricingPage() {
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
  const [recalcDialog, setRecalcDialog] = useState<{
    tierId: number;
    rank: number;
    value: number;
    preview: RecalcPreview | null;
    step: 'pick' | 'preview';
  } | null>(null);
  const [confirmDeleteLast, setConfirmDeleteLast] = useState(false);

  const handleAdd = async () => {
    try {
      await add.mutateAsync({ closeAtDays: closeAt, discountPercent: discount });
      toast.success('Тариф добавлен, цены пересчитаны');
      setShowAdd(false);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось добавить тариф'));
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
    try {
      await deleteLast.mutateAsync();
      toast.success('Последний тариф удалён');
      setConfirmDeleteLast(false);
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
      toast.success(`Пересчитано: ${res.updated}, пропущено ${res.skipped}`);
      setRecalcDialog(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось пересчитать'));
    }
  };

  const lastTier = tiers && tiers.length > 0 ? tiers[tiers.length - 1] : null;
  const canAdd = (tiers?.length ?? 0) < 5 && lastTier?.maxDays === null;

  return (
    <>
      <PageHeader
        title="Тарифы"
        description="Ценовые тиры (1–5). Скидка применяется от тарифа №1. Последний всегда открытый."
        action={
          canAdd && (
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="size-4" /> Добавить тариф
            </Button>
          )
        }
      />

      {isLoading ? (
        <div className="py-12 text-center">
          <Loader2 className="size-8 animate-spin mx-auto text-blue" />
        </div>
      ) : !tiers || tiers.length === 0 ? (
        <EmptyState
          title="Тарифов пока нет"
          description="Создайте первый тариф, чтобы задавать цены оборудования"
          icon={<Layers className="size-7" />}
          action={
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="size-4" /> Добавить тариф
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {tiers.map((t, idx) => {
            const isLast = idx === tiers.length - 1;
            const isFirst = idx === 0;
            return (
              <div
                key={t.id}
                className="rounded-xl border bg-surface p-5 flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="size-10 rounded-md bg-blue-soft text-blue grid place-items-center font-display font-bold flex-shrink-0">
                    {t.rank}
                  </div>
                  <div className="min-w-0">
                    <div className="font-display font-semibold">Тариф {t.rank}</div>
                    <div className="text-sm text-text-2 mt-0.5">{describeTier(t)}</div>
                    {t.note && <div className="text-xs text-text-3 mt-1">{t.note}</div>}
                  </div>
                </div>
                <div className="flex flex-col gap-1 items-end flex-shrink-0">
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
                  {!isFirst && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setRecalcDialog({
                          tierId: t.id,
                          rank: t.rank,
                          value: 10,
                          preview: null,
                          step: 'pick',
                        })
                      }
                    >
                      <RefreshCw className="size-3.5" /> Пересчёт
                    </Button>
                  )}
                  {isLast && tiers.length > 1 && (
                    <RoleGuard
                      role="ADMIN"
                      mode="disable"
                      tooltip="Удаление тарифа доступно только администратору"
                    >
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteLast(true)}>
                        <Trash2 className="size-3.5 text-status-overdue" />
                      </Button>
                    </RoleGuard>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* === ADD TIER DIALOG === */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Добавить тариф</DialogTitle>
            <DialogDescription>
              Текущий открытый тариф закроется указанным числом дней, а новый займёт его место как
              открытый.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Закрыть текущий открытый тариф на (дней)</Label>
              <Input
                type="number"
                min={1}
                value={closeAt}
                onChange={(e) => setCloseAt(Number(e.target.value))}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs">Скидка нового тарифа, %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              Отмена
            </Button>
            <Button onClick={handleAdd} disabled={add.isPending}>
              {add.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === EDIT BOUNDARY === */}
      <Dialog open={editBoundary !== null} onOpenChange={(o) => !o && setEditBoundary(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Изменить границу тарифа</DialogTitle>
            <DialogDescription>Цены не изменятся, изменится только диапазон дней</DialogDescription>
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

      {/* === RECALC === */}
      <Dialog open={recalcDialog !== null} onOpenChange={(o) => !o && setRecalcDialog(null)}>
        <DialogContent className={cn(recalcDialog?.step === 'preview' ? 'max-w-2xl' : 'max-w-md')}>
          {recalcDialog?.step === 'pick' ? (
            <>
              <DialogHeader>
                <DialogTitle>Пересчитать цены тарифа {recalcDialog.rank}</DialogTitle>
                <DialogDescription>
                  Новая цена = Math.ceil(цена тарифа 1 × (100 − скидка) / 100). Сначала превью,
                  потом подтверждение.
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
                  Изменится <b>{recalcDialog.preview.summary.willChange}</b>, появится новых{' '}
                  <b>{recalcDialog.preview.summary.willCreate}</b>, без изменений{' '}
                  <b>{recalcDialog.preview.summary.unchanged}</b> из{' '}
                  {recalcDialog.preview.summary.total}
                </DialogDescription>
              </DialogHeader>

              <div className="max-h-80 overflow-y-auto rounded-lg border bg-surface">
                <table className="w-full text-sm">
                  <thead className="bg-surface-2 text-text-3 text-xs uppercase tracking-wide sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Карточка</th>
                      <th className="text-right px-3 py-2 font-medium">База (тариф 1)</th>
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
                  onClick={() => setRecalcDialog({ ...recalcDialog, preview: null, step: 'pick' })}
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

      {/* === CONFIRM DELETE LAST === */}
      <Dialog open={confirmDeleteLast} onOpenChange={setConfirmDeleteLast}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Удалить последний тариф?</DialogTitle>
            <DialogDescription>
              Все цены этого тарифа будут удалены. Действие нельзя отменить.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteLast(false)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteLast}
              disabled={deleteLast.isPending}
            >
              {deleteLast.isPending && <Loader2 className="size-4 animate-spin" />}
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
