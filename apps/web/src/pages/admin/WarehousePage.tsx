import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Boxes,
  Edit,
  Layers,
  Link as LinkIcon,
  Loader2,
  Plus,
  Search,
  Trash2,
  Unlink,
  Wrench,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { AvailabilityBadge } from '@/components/shared/StatusBadge';
import {
  useBulkCreateWarehouse,
  useBulkLinkWarehouse,
  useBulkStatusWarehouse,
  useBulkUnlinkWarehouse,
  useCreateWarehouseItem,
  useDeleteWarehouseItem,
  useEquipmentList,
  useUpdateWarehouseItem,
  useWarehouseList,
} from '@/lib/hooks/queries';
import { apiErrorMessage } from '@/lib/api/client';
import type { WarehouseAvailability, WarehouseItem, WarehouseItemStatus } from '@/lib/api/types';

interface FormState {
  id: number | null;
  name: string;
  inventoryNumber: string;
  serialNumber: string;
  status: WarehouseItemStatus;
  catalogItemId: number | null;
  purchaseDate: string;
  purchasePrice: string;
  warrantyUntil: string;
  notes: string;
}

const PHYSICAL_STATUS_LABEL: Record<WarehouseItemStatus, string> = {
  OPERATIONAL: 'Рабочая',
  BROKEN: 'На обслуживании',
  RETIRED: 'Списана',
};

const AVAILABILITY_FILTER_LABEL: Record<WarehouseAvailability, string> = {
  AVAILABLE: 'Доступно',
  RENTED: 'В аренде',
  RESERVED: 'Зарезервировано',
  BROKEN: 'На обслуживании',
  RETIRED: 'Списано',
};

function emptyForm(catalogItemId: number | null): FormState {
  return {
    id: null,
    name: '',
    inventoryNumber: '',
    serialNumber: '',
    status: 'OPERATIONAL',
    catalogItemId,
    purchaseDate: '',
    purchasePrice: '',
    warrantyUntil: '',
    notes: '',
  };
}

function fromItem(item: WarehouseItem): FormState {
  return {
    id: item.id,
    name: item.name,
    inventoryNumber: item.inventoryNumber,
    serialNumber: item.serialNumber ?? '',
    status: item.status,
    catalogItemId: item.catalogItemId,
    purchaseDate: item.purchaseDate ? item.purchaseDate.slice(0, 10) : '',
    purchasePrice: item.purchasePrice != null ? String(item.purchasePrice) : '',
    warrantyUntil: item.warrantyUntil ? item.warrantyUntil.slice(0, 10) : '',
    notes: item.notes ?? '',
  };
}

export function WarehousePage() {
  const [params] = useSearchParams();
  const presetCatalogId = params.get('catalogItemId');

  const [search, setSearch] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<WarehouseAvailability | 'all'>(
    'all',
  );
  const [unlinkedOnly, setUnlinkedOnly] = useState(false);

  const [form, setForm] = useState<FormState | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [bulkCreateOpen, setBulkCreateOpen] = useState(false);
  const [bulkLinkOpen, setBulkLinkOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Бэк фильтрует по физическому статусу (BROKEN/RETIRED). Производный
  // (RENTED/RESERVED/AVAILABLE) применяем на клиенте к тем же 200 загруженным.
  const physicalStatusForBackend: WarehouseItemStatus | undefined =
    availabilityFilter === 'BROKEN'
      ? 'BROKEN'
      : availabilityFilter === 'RETIRED'
        ? 'RETIRED'
        : undefined;

  const { data, isLoading } = useWarehouseList({
    search: search || undefined,
    status: physicalStatusForBackend,
    catalogItemId: presetCatalogId ? Number(presetCatalogId) : undefined,
    unlinkedOnly: unlinkedOnly || undefined,
    limit: 200,
  });
  const { data: catalog } = useEquipmentList({ limit: 200 });
  const create = useCreateWarehouseItem();
  const update = useUpdateWarehouseItem();
  const remove = useDeleteWarehouseItem();
  const bulkLink = useBulkLinkWarehouse();
  const bulkUnlink = useBulkUnlinkWarehouse();
  const bulkStatus = useBulkStatusWarehouse();

  const allItems = data?.items ?? [];
  const totalUnits = data?.total ?? 0;

  const availabilityCounts = allItems.reduce(
    (acc, it) => {
      const a = it.availability;
      if (a) acc[a] += 1;
      return acc;
    },
    { AVAILABLE: 0, RENTED: 0, RESERVED: 0, BROKEN: 0, RETIRED: 0 } as Record<
      WarehouseAvailability,
      number
    >,
  );
  const busyNow = availabilityCounts.RENTED + availabilityCounts.RESERVED;

  const visibleItems = useMemo(
    () =>
      availabilityFilter === 'all'
        ? allItems
        : allItems.filter((it) => it.availability === availabilityFilter),
    [allItems, availabilityFilter],
  );

  const visibleIds = useMemo(() => visibleItems.map((it) => it.id), [visibleItems]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));

  const toggleOne = (id: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAllVisible = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });

  const clearSelection = () => setSelectedIds(new Set());

  const handleSave = async () => {
    if (!form) return;
    if (!form.name || !form.inventoryNumber) {
      toast.error('Название и инвентарный номер обязательны');
      return;
    }
    try {
      const payload = {
        name: form.name.trim(),
        inventoryNumber: form.inventoryNumber.trim(),
        serialNumber: form.serialNumber.trim() || undefined,
        status: form.status,
        catalogItemId: form.catalogItemId,
        purchaseDate: form.purchaseDate || null,
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
        warrantyUntil: form.warrantyUntil || null,
        notes: form.notes.trim() || null,
      };
      if (form.id == null) {
        await create.mutateAsync(payload);
        toast.success('Единица добавлена');
      } else {
        await update.mutateAsync({ id: form.id, data: payload });
        toast.success('Единица обновлена');
      }
      setForm(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось сохранить'));
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await remove.mutateAsync(deleteId);
      toast.success('Единица удалена');
      setDeleteId(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось удалить'));
    }
  };

  const handleBulkUnlink = async () => {
    try {
      const res = await bulkUnlink.mutateAsync(Array.from(selectedIds));
      toast.success(`Отвязано ${res.unlinked}`);
      clearSelection();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось отвязать'));
    }
  };

  const handleBulkStatus = async (status: WarehouseItemStatus) => {
    try {
      const res = await bulkStatus.mutateAsync({
        warehouseItemIds: Array.from(selectedIds),
        status,
      });
      toast.success(`Статус сменён у ${res.updated}`);
      clearSelection();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось сменить статус'));
    }
  };

  const handleBulkLink = async (catalogItemId: number) => {
    try {
      const res = await bulkLink.mutateAsync({
        catalogItemId,
        warehouseItemIds: Array.from(selectedIds),
      });
      toast.success(`Привязано ${res.linked}`);
      clearSelection();
      setBulkLinkOpen(false);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось привязать'));
    }
  };

  return (
    <>
      <PageHeader
        title="Инвентарь"
        description={`Физические единицы оборудования: ${totalUnits}`}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setBulkCreateOpen(true)}>
              <Layers className="size-4" /> Несколько
            </Button>
            <Button
              onClick={() => setForm(emptyForm(presetCatalogId ? Number(presetCatalogId) : null))}
            >
              <Plus className="size-4" /> Единица
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="rounded-xl border bg-surface p-4">
          <div className="text-xs text-text-3">Всего</div>
          <div className="font-display font-bold text-2xl mt-1">{totalUnits}</div>
        </div>
        <div className="rounded-xl border bg-surface p-4">
          <div className="text-xs text-text-3">Доступно</div>
          <div className="font-display font-bold text-2xl mt-1 text-emerald-600">
            {availabilityCounts.AVAILABLE}
          </div>
        </div>
        <div className="rounded-xl border bg-surface p-4">
          <div className="text-xs text-text-3">Заняты сейчас</div>
          <div className="font-display font-bold text-2xl mt-1 text-blue-600">{busyNow}</div>
          <div className="text-xs text-text-3 mt-0.5">
            {availabilityCounts.RENTED} в аренде · {availabilityCounts.RESERVED} зарезерв.
          </div>
        </div>
        <div className="rounded-xl border bg-surface p-4">
          <div className="text-xs text-text-3">На обслуживании</div>
          <div className="font-display font-bold text-2xl mt-1 text-status-overdue">
            {availabilityCounts.BROKEN}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-3" />
          <Input
            placeholder="Поиск по инв. номеру, серийному, названию…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={availabilityFilter}
          onValueChange={(v) => setAvailabilityFilter(v as WarehouseAvailability | 'all')}
        >
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="AVAILABLE">{AVAILABILITY_FILTER_LABEL.AVAILABLE}</SelectItem>
            <SelectItem value="RENTED">{AVAILABILITY_FILTER_LABEL.RENTED}</SelectItem>
            <SelectItem value="RESERVED">{AVAILABILITY_FILTER_LABEL.RESERVED}</SelectItem>
            <SelectItem value="BROKEN">{AVAILABILITY_FILTER_LABEL.BROKEN}</SelectItem>
            <SelectItem value="RETIRED">{AVAILABILITY_FILTER_LABEL.RETIRED}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={unlinkedOnly ? 'default' : 'outline'}
          onClick={() => setUnlinkedOnly((v) => !v)}
          className="whitespace-nowrap"
        >
          Только без карточки
        </Button>
      </div>

      {selectedIds.size > 0 && (
        <div className="sticky top-2 z-10 mb-3 rounded-xl border bg-surface shadow-md p-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium px-2">
            Выбрано: <span className="font-mono">{selectedIds.size}</span>
          </span>
          <Button size="sm" variant="outline" onClick={() => setBulkLinkOpen(true)}>
            <LinkIcon className="size-4" /> Привязать к карточке
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleBulkUnlink}
            disabled={bulkUnlink.isPending}
          >
            <Unlink className="size-4" /> Отвязать
          </Button>
          <Select onValueChange={(v) => handleBulkStatus(v as WarehouseItemStatus)}>
            <SelectTrigger className="h-8 w-[210px] text-sm">
              <Wrench className="size-4 mr-1" />
              <SelectValue placeholder="Сменить статус…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="OPERATIONAL">{PHYSICAL_STATUS_LABEL.OPERATIONAL}</SelectItem>
              <SelectItem value="BROKEN">{PHYSICAL_STATUS_LABEL.BROKEN}</SelectItem>
              <SelectItem value="RETIRED">{PHYSICAL_STATUS_LABEL.RETIRED}</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto">
            <Button size="sm" variant="ghost" onClick={clearSelection}>
              <X className="size-4" /> Снять выделение
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !visibleItems.length ? (
        <EmptyState
          title="Инвентарь пуст"
          description="Добавьте первую физическую единицу"
          icon={<Boxes className="size-7" />}
          action={
            <Button onClick={() => setForm(emptyForm(null))}>
              <Plus className="size-4" /> Единица
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border bg-surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2">
              <tr className="text-left text-xs uppercase text-text-3">
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    className="size-4 cursor-pointer"
                    checked={allVisibleSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected;
                    }}
                    onChange={toggleAllVisible}
                  />
                </th>
                <th className="px-4 py-3">Инв. номер</th>
                <th className="px-4 py-3">Название</th>
                <th className="px-4 py-3">Серийный</th>
                <th className="px-4 py-3">Карточка</th>
                <th className="px-4 py-3">Категория</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((it) => {
                const isSelected = selectedIds.has(it.id);
                return (
                  <tr
                    key={it.id}
                    className={`border-t hover:bg-surface-2/50 ${isSelected ? 'bg-blue/5' : ''}`}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        className="size-4 cursor-pointer"
                        checked={isSelected}
                        onChange={() => toggleOne(it.id)}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono font-medium">{it.inventoryNumber}</td>
                    <td className="px-4 py-3">{it.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-text-2">
                      {it.serialNumber ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-text-2">
                      {it.catalogItem ? (
                        <span className="text-text">{it.catalogItem.name}</span>
                      ) : (
                        <span className="text-text-3 italic">— общий пул</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-2">
                      {it.catalogItem?.category ? (
                        <span className="text-text-2">
                          {it.catalogItem.category.name}
                          <span className="text-text-3 text-xs ml-1">(через карточку)</span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {it.availability ? <AvailabilityBadge availability={it.availability} /> : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setForm(fromItem(it))}>
                          <Edit className="size-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteId(it.id)}>
                          <Trash2 className="size-4 text-status-overdue" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Диалог: создать / редактировать единицу */}
      <Dialog open={form !== null} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {form?.id == null ? 'Добавить единицу' : 'Редактировать единицу'}
            </DialogTitle>
            <DialogDescription>
              Категория единицы наследуется от привязанной карточки каталога.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-3">
              <div>
                <Label>Название *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1.5"
                  placeholder="Перфоратор Bosch GBH 2-26"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Инвентарный номер *</Label>
                  <Input
                    value={form.inventoryNumber}
                    onChange={(e) => setForm({ ...form, inventoryNumber: e.target.value })}
                    className="mt-1.5 font-mono"
                    placeholder="INV-000123"
                  />
                </div>
                <div>
                  <Label>Серийный номер</Label>
                  <Input
                    value={form.serialNumber}
                    onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                    className="mt-1.5 font-mono"
                    placeholder="SN-XYZ789"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Физический статус</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm({ ...form, status: v as WarehouseItemStatus })}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPERATIONAL">
                        {PHYSICAL_STATUS_LABEL.OPERATIONAL}
                      </SelectItem>
                      <SelectItem value="BROKEN">{PHYSICAL_STATUS_LABEL.BROKEN}</SelectItem>
                      <SelectItem value="RETIRED">{PHYSICAL_STATUS_LABEL.RETIRED}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-text-3 mt-1">
                    «В аренде» / «Зарезервировано» вычисляются автоматически.
                  </p>
                </div>
                <div>
                  <Label>Карточка каталога</Label>
                  <Select
                    value={form.catalogItemId?.toString() ?? '__none__'}
                    onValueChange={(v) =>
                      setForm({ ...form, catalogItemId: v === '__none__' ? null : Number(v) })
                    }
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Не привязана (общий пул)</SelectItem>
                      {catalog?.items.map((c) => (
                        <SelectItem key={c.id} value={c.id.toString()}>
                          {c.name} ({c.sku})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-text-3 mt-1">Через карточку наследуется категория.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Дата покупки</Label>
                  <Input
                    type="date"
                    value={form.purchaseDate}
                    onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Закупочная цена, ₽</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.purchasePrice}
                    onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                    className="mt-1.5"
                    placeholder="15000"
                  />
                </div>
              </div>
              <div>
                <Label>Гарантия до</Label>
                <Input
                  type="date"
                  value={form.warrantyUntil}
                  onChange={(e) => setForm({ ...form, warrantyUntil: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Заметка о состоянии</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="mt-1.5"
                  rows={2}
                  placeholder="Царапина на корпусе, без кейса…"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
              {(create.isPending || update.isPending) && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteUnitDialog
        deleteId={deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        pending={remove.isPending}
      />

      <BulkLinkSelectDialog
        open={bulkLinkOpen}
        onClose={() => setBulkLinkOpen(false)}
        onPick={handleBulkLink}
        pending={bulkLink.isPending}
        cards={catalog?.items ?? []}
        selectedCount={selectedIds.size}
      />

      <BulkCreateDialog
        open={bulkCreateOpen}
        onClose={() => setBulkCreateOpen(false)}
        cards={catalog?.items ?? []}
      />
    </>
  );
}

// ===== Подкомпоненты диалогов =====

function DeleteUnitDialog({
  deleteId,
  onClose,
  onConfirm,
  pending,
}: {
  deleteId: number | null;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <Dialog open={deleteId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Удалить единицу?</DialogTitle>
          <DialogDescription>
            Если единица в активном заказе — удаление будет заблокировано с указанием номеров.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Удалить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkLinkSelectDialog({
  open,
  onClose,
  onPick,
  pending,
  cards,
  selectedCount,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (catalogItemId: number) => void;
  pending: boolean;
  cards: { id: number; sku: string; name: string }[];
  selectedCount: number;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(
    () =>
      cards.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.sku.toLowerCase().includes(search.toLowerCase()),
      ),
    [cards, search],
  );
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Привязать {selectedCount} ед. к карточке</DialogTitle>
          <DialogDescription>
            Все выбранные единицы будут привязаны к указанной карточке. Категория унаследуется
            автоматически.
          </DialogDescription>
        </DialogHeader>
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-3" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            placeholder="Поиск карточек…"
          />
        </div>
        <div className="max-h-72 overflow-y-auto rounded-md border">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-sm text-text-3">Нет карточек</div>
          ) : (
            <ul className="divide-y">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => onPick(c.id)}
                    disabled={pending}
                    className="w-full text-left px-3 py-2 hover:bg-surface-2 disabled:opacity-50 text-sm"
                  >
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-text-3 font-mono">{c.sku}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkCreateDialog({
  open,
  onClose,
  cards,
}: {
  open: boolean;
  onClose: () => void;
  cards: { id: number; sku: string; name: string }[];
}) {
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState('INV-');
  const [startNumber, setStartNumber] = useState('100');
  const [count, setCount] = useState('5');
  const [padWidth, setPadWidth] = useState('3');
  const [catalogItemId, setCatalogItemId] = useState<string>('__none__');
  const [status, setStatus] = useState<WarehouseItemStatus>('OPERATIONAL');
  const bulkCreate = useBulkCreateWarehouse();

  const reset = () => {
    setName('');
    setPrefix('INV-');
    setStartNumber('100');
    setCount('5');
    setPadWidth('3');
    setCatalogItemId('__none__');
    setStatus('OPERATIONAL');
  };

  const handleCreate = async () => {
    const startN = Number(startNumber);
    const cnt = Number(count);
    if (!name.trim()) {
      toast.error('Название обязательно');
      return;
    }
    if (!cnt || cnt < 1 || cnt > 50) {
      toast.error('Количество должно быть от 1 до 50');
      return;
    }
    try {
      const res = await bulkCreate.mutateAsync({
        name: name.trim(),
        prefix: prefix.trim(),
        startNumber: startN,
        count: cnt,
        padWidth: Number(padWidth) || undefined,
        status,
        catalogItemId: catalogItemId === '__none__' ? undefined : Number(catalogItemId),
      });
      toast.success(
        `Создано ${res.created}: ${res.inventoryNumbers[0]} … ${res.inventoryNumbers[res.inventoryNumbers.length - 1]}`,
      );
      reset();
      onClose();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось создать'));
    }
  };

  // Превью первого/последнего номера
  const startN = Number(startNumber) || 0;
  const cnt = Number(count) || 0;
  const pad = Number(padWidth) || 0;
  const fmt = (n: number) => `${prefix}${pad > 0 ? String(n).padStart(pad, '0') : n}`;
  const preview = cnt > 0 ? `${fmt(startN)} … ${fmt(startN + cnt - 1)}` : '—';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Массовое создание единиц</DialogTitle>
          <DialogDescription>
            До 50 единиц за раз с авто-нумерацией. Опционально — сразу к карточке.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Название (для всех) *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5"
              placeholder="Перфоратор Bosch GBH 2-26"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Префикс</Label>
              <Input
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                className="mt-1.5 font-mono"
                placeholder="INV-"
              />
            </div>
            <div>
              <Label>Стартовый №</Label>
              <Input
                type="number"
                min="0"
                value={startNumber}
                onChange={(e) => setStartNumber(e.target.value)}
                className="mt-1.5 font-mono"
              />
            </div>
            <div>
              <Label>Кол-во (1–50)</Label>
              <Input
                type="number"
                min="1"
                max="50"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="mt-1.5 font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Ширина числа (паддинг)</Label>
              <Input
                type="number"
                min="0"
                max="6"
                value={padWidth}
                onChange={(e) => setPadWidth(e.target.value)}
                className="mt-1.5 font-mono"
                placeholder="3"
              />
              <p className="text-xs text-text-3 mt-1">0 = без паддинга</p>
            </div>
            <div>
              <Label>Физический статус</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as WarehouseItemStatus)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPERATIONAL">{PHYSICAL_STATUS_LABEL.OPERATIONAL}</SelectItem>
                  <SelectItem value="BROKEN">{PHYSICAL_STATUS_LABEL.BROKEN}</SelectItem>
                  <SelectItem value="RETIRED">{PHYSICAL_STATUS_LABEL.RETIRED}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Привязать сразу к карточке (опц.)</Label>
            <Select value={catalogItemId} onValueChange={setCatalogItemId}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Не привязывать (в общий пул)</SelectItem>
                {cards.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.name} ({c.sku})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md bg-surface-2 p-3 text-sm">
            <span className="text-text-3">Будут созданы: </span>
            <span className="font-mono font-medium">{preview}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleCreate} disabled={bulkCreate.isPending}>
            {bulkCreate.isPending && <Loader2 className="size-4 animate-spin" />}
            Создать {cnt > 0 ? cnt : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
