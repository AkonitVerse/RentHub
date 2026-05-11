import { useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useBulkAttachEquipmentToCategory, useEquipmentList } from '@/lib/hooks/queries';
import { apiErrorMessage } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';

interface Props {
  open: boolean;
  onClose: () => void;
  categoryId: number;
  categoryName: string;
}

/**
 * Диалог управления привязанными к категории карточками каталога.
 *
 * Две вкладки в одном UI: верх — уже привязанные (с кнопкой "Отвязать"),
 * низ — кандидаты (карточки без категории или из другой), с чекбоксами для bulk-привязки.
 */
export function LinkEquipmentToCategoryDialog({ open, onClose, categoryId, categoryName }: Props) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const attach = useBulkAttachEquipmentToCategory();

  const linkedQuery = useEquipmentList(open ? { categoryId, limit: 200 } : undefined);
  const candidatesQuery = useEquipmentList(
    open ? { search: search || undefined, limit: 200 } : undefined,
  );

  const linked = linkedQuery.data?.items ?? [];
  const candidates = useMemo(
    () => (candidatesQuery.data?.items ?? []).filter((it) => it.categoryId !== categoryId),
    [candidatesQuery.data, categoryId],
  );

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAttach = async () => {
    if (selected.size === 0) return;
    try {
      const res = await attach.mutateAsync({
        categoryId,
        equipmentIds: Array.from(selected),
      });
      toast.success(`Привязано ${res.attached} карточек`);
      setSelected(new Set());
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось привязать'));
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSelected(new Set());
      setSearch('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Карточки в категории</DialogTitle>
          <DialogDescription>
            Категория: <span className="font-medium">{categoryName}</span>. Управляйте привязкой
            карточек оборудования.
          </DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Привязанные */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Уже привязаны ({linked.length})</h3>
            <div className="max-h-72 overflow-y-auto rounded-md border">
              {linkedQuery.isLoading ? (
                <div className="flex items-center justify-center py-8 text-text-3">
                  <Loader2 className="size-4 animate-spin mr-2" /> Загрузка…
                </div>
              ) : linked.length === 0 ? (
                <div className="text-center py-8 text-text-3 text-sm">Карточек нет</div>
              ) : (
                <ul className="divide-y">
                  {linked.map((it) => (
                    <li key={it.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{it.name}</div>
                        <div className="text-xs text-text-3 font-mono">{it.sku}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Кандидаты */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Добавить в категорию</h3>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-3" />
              <Input
                placeholder="Поиск карточек…"
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="max-h-60 overflow-y-auto rounded-md border">
              {candidatesQuery.isLoading ? (
                <div className="flex items-center justify-center py-8 text-text-3">
                  <Loader2 className="size-4 animate-spin mr-2" /> Загрузка…
                </div>
              ) : candidates.length === 0 ? (
                <div className="text-center py-8 text-text-3 text-sm">Нет подходящих карточек</div>
              ) : (
                <ul className="divide-y">
                  {candidates.map((it) => {
                    const isChecked = selected.has(it.id);
                    return (
                      <li key={it.id}>
                        <label
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-surface-2 text-sm',
                            isChecked && 'bg-blue/5',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggle(it.id)}
                            className="size-4"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{it.name}</div>
                            <div className="text-xs text-text-3 font-mono truncate">
                              {it.sku} · {it.category ? `в "${it.category.name}"` : 'без категории'}
                            </div>
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2">
          <span className="text-sm text-text-3">
            Выбрано к привязке: <span className="font-mono font-medium">{selected.size}</span>
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => handleOpenChange(false)}>
              Закрыть
            </Button>
            <Button onClick={handleAttach} disabled={selected.size === 0 || attach.isPending}>
              {attach.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                `Привязать ${selected.size}`
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
