import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive,
  ArchiveRestore,
  Edit,
  Loader2,
  Package,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { RoleGuard } from '@/components/shared/RoleGuard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useArchiveEquipment,
  useDeleteEquipment,
  useEquipmentList,
  useTiers,
  useUnarchiveEquipment,
} from '@/lib/hooks/queries';
import { fmtRub } from '@/lib/utils/format';
import { apiErrorMessage } from '@/lib/api/client';

type ActiveFilter = 'active' | 'archived' | 'all';

export function EquipmentListPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ActiveFilter>('active');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data, isLoading } = useEquipmentList({
    search: search || undefined,
    isActive: filter === 'all' ? undefined : filter === 'active',
    limit: 100,
  });
  const { data: tiers } = useTiers();
  const remove = useDeleteEquipment();
  const archive = useArchiveEquipment();
  const unarchive = useUnarchiveEquipment();

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await remove.mutateAsync(deleteId);
      toast.success('Карточка удалена навсегда');
      setDeleteId(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось удалить'));
    }
  };

  const handleArchive = async (id: number) => {
    try {
      await archive.mutateAsync(id);
      toast.success('Карточка архивирована');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось архивировать'));
    }
  };

  const handleUnarchive = async (id: number) => {
    try {
      await unarchive.mutateAsync(id);
      toast.success('Карточка восстановлена');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось восстановить'));
    }
  };

  return (
    <>
      <PageHeader
        title="Каталог"
        description={`${data?.total ?? 0} карточек`}
        action={
          <Button asChild>
            <Link to="/admin/equipment/catalog/new">
              <Plus className="size-4" /> Карточка
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-3" />
          <Input
            placeholder="Поиск по названию или артикулу…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as ActiveFilter)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Активные</SelectItem>
            <SelectItem value="archived">Архив</SelectItem>
            <SelectItem value="all">Все</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <EmptyState
          title="Каталог пуст"
          description="Создайте первую карточку"
          icon={<Package className="size-7" />}
          action={
            <Button asChild>
              <Link to="/admin/equipment/catalog/new">
                <Plus className="size-4" /> Карточка
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2.5">
          {data.items.map((eq) => {
            const photos = (eq.photos ?? []) as string[];
            return (
              <div
                key={eq.id}
                className={`@container rounded-xl border bg-surface overflow-hidden flex flex-col ${
                  !eq.isActive ? 'opacity-60' : ''
                }`}
              >
                <div className="aspect-[4/3] bg-surface-2 relative overflow-hidden">
                  {photos[0] ? (
                    <img
                      src={photos[0]}
                      alt={eq.name}
                      className="absolute inset-0 w-full h-full object-contain p-2"
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center text-text-4">
                      <Package className="size-8" strokeWidth={1.2} />
                    </div>
                  )}
                  {!eq.isActive && (
                    <div className="absolute top-1.5 left-1.5 rounded-full bg-status-overdue/90 text-white text-[10px] font-medium px-2 py-0.5">
                      В архиве
                    </div>
                  )}
                </div>
                <div className="p-3 flex-1 flex flex-col">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[10px] text-text-3">{eq.sku}</span>
                    <span className="text-[11px] font-semibold text-status-active font-mono whitespace-nowrap">
                      {eq.availableUnits ?? 0}/{eq.totalUnits ?? 0}{' '}
                      <span className="text-text-3 font-sans font-normal">дост.</span>
                    </span>
                  </div>
                  <h3 className="font-semibold text-sm mt-0.5 leading-tight line-clamp-2">
                    {eq.name}
                  </h3>

                  {tiers && tiers.length > 0 && (
                    <div className="mt-2 grid gap-0.5 text-xs border-t border-border pt-2">
                      {tiers.map((t) => {
                        const p = eq.prices?.find((x) => x.tierId === t.id);
                        const label =
                          t.maxDays == null
                            ? `от ${t.minDays}`
                            : t.minDays === t.maxDays
                              ? `${t.minDays}`
                              : `${t.minDays}–${t.maxDays}`;
                        return (
                          <div key={t.id} className="flex justify-between leading-tight">
                            <span className="text-text-3 font-mono">{label} сут</span>
                            <span className="font-medium font-mono">
                              {p ? fmtRub(p.pricePerDay) : '—'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/*
                    mt-auto прижимает блок кнопок к низу карточки независимо от
                    высоты названия и наличия тарифов. Все карточки в строке
                    одинаковой высоты (grid auto-stretch), пустое место уходит
                    между тарифами и кнопками — кнопки выровнены в одной линии.
                  */}
                  {/*
                    @container на самой карточке + @[180px]:inline на тексте
                    "Изменить" — на узких карточках кнопка показывает только
                    иконку (помещается с архивом), на широких появляется текст.
                    Граница 180 px подобрана так, чтобы при текущих брейкпоинтах
                    Tailwind тонкие карточки на lg/xl уходили в иконочный режим.
                  */}
                  <div className="mt-auto pt-2 flex gap-1.5">
                    <Button asChild variant="outline" size="sm" className="flex-1 min-w-0">
                      <Link to={`/admin/equipment/catalog/${eq.id}`}>
                        <Edit className="size-3.5 flex-shrink-0" />
                        <span className="hidden @[180px]:inline">Изменить</span>
                      </Link>
                    </Button>
                    {eq.isActive ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Архивировать (скрыть с витрины)"
                        onClick={() => handleArchive(eq.id)}
                        disabled={archive.isPending}
                      >
                        <Archive className="size-3.5 text-text-2" />
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Восстановить из архива"
                          onClick={() => handleUnarchive(eq.id)}
                          disabled={unarchive.isPending}
                        >
                          <ArchiveRestore className="size-3.5 text-status-active" />
                        </Button>
                        <RoleGuard
                          role="ADMIN"
                          mode="disable"
                          tooltip="Удаление навсегда — только администратор"
                        >
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Удалить навсегда"
                            onClick={() => setDeleteId(eq.id)}
                          >
                            <Trash2 className="size-3.5 text-status-overdue" />
                          </Button>
                        </RoleGuard>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить карточку навсегда?</DialogTitle>
            <DialogDescription>
              Действие необратимо. Удаление возможно только если у карточки нет истории заказов и
              инквайри-заявок. Все привязанные единицы инвентаря будут отвязаны автоматически.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={remove.isPending}>
              {remove.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Удалить навсегда
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
