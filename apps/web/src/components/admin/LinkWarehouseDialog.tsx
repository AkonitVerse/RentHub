import { useMemo, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
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
import { useBulkLinkWarehouse, useWarehouseList } from '@/lib/hooks/queries';
import { apiErrorMessage } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';

interface Props {
  open: boolean;
  onClose: () => void;
  catalogItemId: number;
  catalogItemName: string;
}

/**
 * Диалог массовой привязки единиц склада к карточке каталога.
 * Показываются только единицы без привязки (catalogItemId = null).
 */
export function LinkWarehouseDialog({ open, onClose, catalogItemId, catalogItemName }: Props) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const bulkLink = useBulkLinkWarehouse();

  const { data, isLoading } = useWarehouseList(
    open ? { search: search || undefined, limit: 200 } : undefined,
  );

  const items = useMemo(() => (data?.items ?? []).filter((it) => it.catalogItemId == null), [data]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selected.size === 0) return;
    try {
      const res = await bulkLink.mutateAsync({
        catalogItemId,
        warehouseItemIds: Array.from(selected),
      });
      toast.success(`Привязано ${res.linked} ед.`);
      setSelected(new Set());
      onClose();
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Привязать единицы инвентаря</DialogTitle>
          <DialogDescription>
            Карточка: <span className="font-medium">{catalogItemName}</span>. Показаны только
            единицы без текущей привязки.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-3" />
          <Input
            placeholder="Поиск по инв. номеру или названию…"
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 hover:text-text"
              aria-label="Очистить"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto rounded-md border">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-text-3">
              <Loader2 className="size-5 animate-spin mr-2" /> Загрузка…
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-10 text-text-3 text-sm">
              {search
                ? 'Ничего не найдено по запросу'
                : 'Нет свободных единиц — все уже привязаны или создайте новые в инвентаре.'}
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((it) => {
                const isChecked = selected.has(it.id);
                return (
                  <li key={it.id}>
                    <label
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-surface-2',
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
                        <div className="font-medium text-sm truncate">{it.name}</div>
                        <div className="text-xs text-text-3 font-mono mt-0.5">
                          {it.inventoryNumber}
                          {it.serialNumber ? ` · S/N ${it.serialNumber}` : ''}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full border',
                          it.status === 'OPERATIONAL'
                            ? 'border-status-active/30 text-status-active'
                            : it.status === 'BROKEN'
                              ? 'border-status-overdue/30 text-status-overdue'
                              : 'border-text-4/30 text-text-3',
                        )}
                      >
                        {it.status}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2">
          <span className="text-sm text-text-3">
            Выбрано: <span className="font-mono font-medium">{selected.size}</span>
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => handleOpenChange(false)}>
              Отмена
            </Button>
            <Button onClick={handleSubmit} disabled={selected.size === 0 || bulkLink.isPending}>
              {bulkLink.isPending ? (
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
