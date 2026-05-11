import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  CheckCircle2,
  GripVertical,
  ImagePlus,
  Link2,
  Loader2,
  Plus,
  Save,
  Trash2,
  Package,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/PageHeader';
import { CategoryLeafSelect } from '@/components/admin/CategoryLeafSelect';
import { LinkWarehouseDialog } from '@/components/admin/LinkWarehouseDialog';
import {
  useBulkUnlinkWarehouse,
  useCreateEquipment,
  useEquipment,
  useEquipmentActivationStatus,
  useSetEquipmentPhotos,
  useSetTierPrice,
  useTiers,
  useUpdateEquipment,
  useUploadEquipmentPhoto,
} from '@/lib/hooks/queries';
import { apiErrorMessage } from '@/lib/api/client';
import { fmtRub } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

const schema = z.object({
  // SKU опционален — при создании генерируется на бэке как 8 случайных цифр.
  // При редактировании показываем как read-only, не отправляем.
  sku: z
    .string()
    .regex(/^[A-Za-z0-9_-]*$/, 'Только буквы, цифры, дефис и подчёркивание')
    .optional(),
  name: z.string().min(2, 'Введите название'),
  categoryId: z
    .number({ required_error: 'Выберите листовую категорию' })
    .int()
    .positive('Выберите листовую категорию'),
  description: z.string().min(1, 'Краткое описание обязательно'),
  fullDesc: z.string().optional(),
  basePrice: z.number().min(0, 'Цена не может быть отрицательной'),
  deposit: z.number().min(0, 'Залог не может быть отрицательным'),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface SpecRow {
  key: string;
  value: string;
}

function describeTier(tier: { rank: number; minDays: number; maxDays: number | null }): string {
  if (tier.maxDays == null) return `Тир ${tier.rank}: от ${tier.minDays} сут`;
  if (tier.minDays === tier.maxDays) return `Тир ${tier.rank}: ${tier.minDays} сут`;
  return `Тир ${tier.rank}: ${tier.minDays}–${tier.maxDays} сут`;
}

export function EquipmentEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const equipmentId = isNew ? undefined : Number(id);

  const { data: equipment, isLoading } = useEquipment(equipmentId);
  const { data: tiers } = useTiers();
  const { data: activationStatus } = useEquipmentActivationStatus(equipmentId);
  const create = useCreateEquipment();
  const update = useUpdateEquipment();
  const uploadPhoto = useUploadEquipmentPhoto();
  const setPhotos = useSetEquipmentPhotos();
  const setTierPrice = useSetTierPrice();
  const bulkUnlink = useBulkUnlinkWarehouse();

  const [specs, setSpecs] = useState<SpecRow[]>([]);
  const [tierPrices, setTierPrices] = useState<Record<number, number>>({});
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      sku: '',
      name: '',
      // 0 = не выбрана; zod-валидация требует positive перед сохранением.
      categoryId: 0,
      description: '',
      basePrice: 0,
      deposit: 0,
      isActive: true,
    },
  });

  useEffect(() => {
    if (equipment) {
      const tier1 = equipment.prices?.find((p) => p.tier?.rank === 1);
      reset({
        sku: equipment.sku,
        name: equipment.name,
        categoryId: equipment.categoryId ?? 0,
        description: equipment.description,
        fullDesc: equipment.fullDesc ?? '',
        basePrice: tier1?.pricePerDay ?? 0,
        deposit: equipment.deposit,
        isActive: equipment.isActive,
      });
      if (equipment.specs) {
        setSpecs(
          Object.entries(equipment.specs).map(([key, value]) => ({
            key,
            value: String(value),
          })),
        );
      }
      const map: Record<number, number> = {};
      for (const p of equipment.prices ?? []) map[p.tierId] = p.pricePerDay;
      setTierPrices(map);
    }
  }, [equipment, reset]);

  const onSubmit = async (data: FormValues) => {
    const specsObj = specs.reduce<Record<string, string>>((acc, s) => {
      if (s.key.trim()) acc[s.key.trim()] = s.value;
      return acc;
    }, {});

    try {
      if (isNew) {
        // SKU не отправляем — бэк сгенерирует 8 случайных цифр автоматически.
        const { sku: _sku, ...payload } = data;
        const created = await create.mutateAsync({ ...payload, specs: specsObj });
        toast.success(`Карточка создана: ${created.sku}`);
        navigate(`/admin/equipment/catalog/${created.id}`);
      } else {
        // При редактировании SKU read-only, не отправляем.
        const { sku: _sku, ...payload } = data;
        await update.mutateAsync({ id: equipmentId!, data: { ...payload, specs: specsObj } });
        // Сохраняем переопределения цен тиров (если изменились)
        if (equipment && tiers) {
          for (const tier of tiers) {
            const newPrice = tierPrices[tier.id];
            const existing = equipment.prices?.find((p) => p.tierId === tier.id)?.pricePerDay;
            if (newPrice !== undefined && newPrice !== existing) {
              await setTierPrice.mutateAsync({
                equipmentId: equipmentId!,
                tierId: tier.id,
                pricePerDay: newPrice,
              });
            }
          }
        }
        toast.success('Изменения сохранены');
      }
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось сохранить'));
    }
  };

  const handlePhotoUpload = async (file: File) => {
    if (!equipmentId) return;
    try {
      await uploadPhoto.mutateAsync({ id: equipmentId, file });
      toast.success('Фото загружено');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось загрузить фото'));
    }
  };

  const handleRemovePhoto = async (idx: number) => {
    if (!equipmentId || !equipment) return;
    const next = [...(equipment.photos ?? [])];
    next.splice(idx, 1);
    try {
      await setPhotos.mutateAsync({ id: equipmentId, photos: next });
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось удалить фото'));
    }
  };

  const handlePhotoDragEnd = async (event: DragEndEvent) => {
    if (!equipmentId || !equipment) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const current = equipment.photos ?? [];
    const oldIdx = current.findIndex((p) => p === active.id);
    const newIdx = current.findIndex((p) => p === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(current, oldIdx, newIdx);
    try {
      await setPhotos.mutateAsync({ id: equipmentId, photos: next });
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось переставить'));
    }
  };

  const handleUnlinkUnit = async (warehouseItemId: number) => {
    if (!equipmentId) return;
    try {
      await bulkUnlink.mutateAsync([warehouseItemId]);
      toast.success('Единица отвязана');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось отвязать'));
    }
  };

  if (!isNew && isLoading) {
    return (
      <div className="text-center py-20">
        <Loader2 className="size-8 animate-spin mx-auto text-blue" />
      </div>
    );
  }

  const photos = equipment?.photos ?? [];

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/admin/equipment/catalog')}
        className="mb-4"
      >
        <ArrowLeft className="size-4" /> К каталогу
      </Button>

      <PageHeader
        title={isNew ? 'Новая карточка' : (equipment?.name ?? 'Редактирование')}
        description={
          equipment
            ? `Доступно ${equipment.availableUnits ?? 0} из ${equipment.totalUnits ?? 0} ед.`
            : undefined
        }
        action={
          <div className="flex gap-2">
            {!isNew && equipmentId && (
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/admin/orders/new?equipmentId=${equipmentId}`)}
              >
                <Plus className="size-4" /> Создать заказ
              </Button>
            )}
            <Button
              onClick={handleSubmit(onSubmit)}
              disabled={create.isPending || update.isPending}
            >
              {create.isPending || update.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {isNew ? 'Создать' : 'Сохранить'}
            </Button>
          </div>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="grid lg:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-4">
          <section className="rounded-xl border bg-surface p-5">
            <h2 className="font-display font-semibold mb-4">Основные данные</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="sku">Артикул (SKU)</Label>
                {isNew ? (
                  <div className="mt-1.5 flex items-center gap-2 rounded-md border border-dashed border-border bg-surface-2 px-3 py-2 text-sm text-text-3">
                    <span className="font-mono">XXXXXXXX</span>
                    <span className="text-xs">— сгенерируется автоматически после сохранения</span>
                  </div>
                ) : (
                  <Input
                    id="sku"
                    value={watch('sku') ?? ''}
                    readOnly
                    disabled
                    className="mt-1.5 font-mono bg-surface-2 text-text-2 cursor-not-allowed"
                    title="Артикул присваивается при создании и не меняется"
                  />
                )}
              </div>
              <div>
                <Label>Категория</Label>
                <div className="mt-1.5">
                  <CategoryLeafSelect
                    value={watch('categoryId') || null}
                    onChange={(id) => setValue('categoryId', id ?? 0, { shouldValidate: true })}
                    placeholder="Выбрать конечную категорию"
                  />
                  {errors.categoryId && (
                    <p className="text-xs text-status-overdue mt-1">{errors.categoryId.message}</p>
                  )}
                </div>
                <p className="text-xs text-text-3 mt-1">
                  Доступны только листовые категории. Группирующие узлы покажутся для навигации, но
                  выбрать их нельзя.
                </p>
              </div>
            </div>
            <div className="mt-3">
              <Label htmlFor="name">Название *</Label>
              <Input
                id="name"
                {...register('name')}
                className="mt-1.5"
                placeholder="Перфоратор Bosch GBH 2-26"
              />
              {errors.name && (
                <p className="text-xs text-status-overdue mt-1">{errors.name.message}</p>
              )}
            </div>
            <div className="mt-3">
              <Label htmlFor="description">Краткое описание *</Label>
              <Input
                id="description"
                {...register('description')}
                className="mt-1.5"
                placeholder="SDS-Plus, 2.7 Дж, 830 Вт"
              />
              {errors.description && (
                <p className="text-xs text-status-overdue mt-1">{errors.description.message}</p>
              )}
            </div>
            <div className="mt-3">
              <Label htmlFor="fullDesc">Полное описание</Label>
              <Textarea id="fullDesc" {...register('fullDesc')} className="mt-1.5" rows={4} />
            </div>
          </section>

          <section className="rounded-xl border bg-surface p-5">
            <h2 className="font-display font-semibold mb-4">Цена и залог</h2>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="basePrice">Базовая цена (тир 1), ₽/сут *</Label>
                <Input
                  id="basePrice"
                  type="number"
                  min={0}
                  {...register('basePrice', { valueAsNumber: true })}
                  className="mt-1.5"
                />
                {errors.basePrice && (
                  <p className="text-xs text-status-overdue mt-1">{errors.basePrice.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="deposit">Залог, ₽</Label>
                <Input
                  id="deposit"
                  type="number"
                  min={0}
                  {...register('deposit', { valueAsNumber: true })}
                  className="mt-1.5"
                />
                {errors.deposit && (
                  <p className="text-xs text-status-overdue mt-1">{errors.deposit.message}</p>
                )}
              </div>
              <div className="flex items-center gap-2 pt-7">
                <input
                  id="isActive"
                  type="checkbox"
                  className="size-4 disabled:cursor-not-allowed"
                  disabled={!isNew && activationStatus ? !activationStatus.canActivate : false}
                  {...register('isActive')}
                />
                <Label htmlFor="isActive">Активна (видна на сайте)</Label>
              </div>
            </div>

            {!isNew && activationStatus && (
              <div className="mt-4 pt-4 border-t">
                <h3 className="text-sm font-medium mb-2 text-text-2">Готовность к активации</h3>
                <ul className="space-y-1.5 text-sm">
                  <ActivationCheckRow
                    ok={activationStatus.tiersTotal > 0 && activationStatus.tiersMissing === 0}
                    label={
                      activationStatus.tiersTotal === 0
                        ? 'Создайте хотя бы один ценовой тир'
                        : `Заполнены все ценовые тиры (${activationStatus.tiersFilled}/${activationStatus.tiersTotal})`
                    }
                  />
                  <ActivationCheckRow
                    ok={activationStatus.operationalUnits >= 1}
                    label={
                      activationStatus.operationalUnits >= 1
                        ? `В инвентаре ${activationStatus.operationalUnits} ед. в статусе OPERATIONAL`
                        : 'Привяжите хотя бы 1 рабочую единицу из инвентаря'
                    }
                  />
                </ul>
                {!activationStatus.canActivate && (
                  <p className="text-xs text-text-3 mt-2">
                    Карточка не появится на витрине, пока не выполнены все условия. Активация
                    заблокирована до их выполнения.
                  </p>
                )}
              </div>
            )}

            {!isNew && tiers && tiers.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <h3 className="text-sm font-medium mb-3 text-text-2">
                  Цены по тирам (можно переопределять вручную)
                </h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {tiers.map((t) => (
                    <div key={t.id}>
                      <Label className="text-xs">{describeTier(t)}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={tierPrices[t.id] ?? ''}
                        onChange={(e) =>
                          setTierPrices({
                            ...tierPrices,
                            [t.id]: Number(e.target.value),
                          })
                        }
                        className="mt-1.5"
                        placeholder="₽/сут"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border bg-surface p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold">Характеристики</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSpecs([...specs, { key: '', value: '' }])}
              >
                <Plus className="size-3.5" /> Добавить
              </Button>
            </div>
            {specs.length === 0 ? (
              <p className="text-sm text-text-3 text-center py-4">Характеристики не указаны</p>
            ) : (
              <div className="space-y-2">
                {specs.map((spec, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={spec.key}
                      onChange={(e) => {
                        const next = [...specs];
                        next[idx].key = e.target.value;
                        setSpecs(next);
                      }}
                      placeholder="Параметр (Мощность)"
                      className="flex-1"
                    />
                    <Input
                      value={spec.value}
                      onChange={(e) => {
                        const next = [...specs];
                        next[idx].value = e.target.value;
                        setSpecs(next);
                      }}
                      placeholder="Значение (830 Вт)"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setSpecs(specs.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="size-4 text-status-overdue" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border bg-surface p-5">
            <h3 className="font-display font-semibold mb-3">Фотогалерея</h3>
            {photos.length > 0 && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handlePhotoDragEnd}
              >
                <SortableContext items={photos} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {photos.map((p, i) => (
                      <SortablePhoto key={p} url={p} onRemove={() => handleRemovePhoto(i)} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
            {photos.length === 0 && (
              <div className="aspect-[4/3] rounded-lg bg-surface-2 border-2 border-dashed grid place-items-center mb-3">
                <Package className="size-16 text-text-4" strokeWidth={1.2} />
              </div>
            )}
            {!isNew && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handlePhotoUpload(f);
                    if (fileRef.current) fileRef.current.value = '';
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadPhoto.isPending}
                >
                  {uploadPhoto.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ImagePlus className="size-4" />
                  )}
                  Добавить фото
                </Button>
                <p className="text-xs text-text-3 mt-2 text-center">JPG, PNG или WebP, до 5 МБ</p>
              </>
            )}
            {isNew && (
              <p className="text-xs text-text-3 mt-3 text-center">
                Сначала создайте карточку, затем загрузите фото
              </p>
            )}
          </div>

          {!isNew && equipment && (
            <div className="rounded-xl border bg-surface p-5">
              <h3 className="font-display font-semibold mb-3">Инвентарь</h3>
              <div className="text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-text-2">Всего единиц:</span>
                  <span className="font-mono font-medium">{equipment.totalUnits ?? 0}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-text-2">Доступно:</span>
                  <span className="font-mono font-medium text-status-active">
                    {equipment.availableUnits ?? 0}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-text-2">Залог:</span>
                  <span className="font-mono font-medium">{fmtRub(equipment.deposit)}</span>
                </div>
              </div>

              {equipment.warehouseItems && equipment.warehouseItems.length > 0 && (
                <ul className="mt-3 pt-3 border-t space-y-1.5 max-h-48 overflow-y-auto">
                  {equipment.warehouseItems.map((w) => (
                    <li
                      key={w.id}
                      className="flex items-center gap-2 text-sm rounded-md px-2 py-1.5 bg-surface-2"
                    >
                      <span
                        className={cn(
                          'size-1.5 rounded-full flex-shrink-0',
                          w.status === 'OPERATIONAL'
                            ? 'bg-status-active'
                            : w.status === 'BROKEN'
                              ? 'bg-status-overdue'
                              : 'bg-text-4',
                        )}
                      />
                      <span className="font-mono text-xs flex-1 truncate">{w.inventoryNumber}</span>
                      <button
                        type="button"
                        onClick={() => handleUnlinkUnit(w.id)}
                        disabled={bulkUnlink.isPending}
                        className="text-text-3 hover:text-status-overdue disabled:opacity-50"
                        title="Отвязать"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLinkDialogOpen(true)}
                >
                  <Link2 className="size-3.5" /> Привязать
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/admin/equipment/stock?catalogItemId=${equipmentId}`)}
                >
                  В инвентаре
                </Button>
              </div>
            </div>
          )}
        </aside>
      </form>

      {!isNew && equipment && (
        <LinkWarehouseDialog
          open={linkDialogOpen}
          onClose={() => setLinkDialogOpen(false)}
          catalogItemId={equipment.id}
          catalogItemName={equipment.name}
        />
      )}
    </>
  );
}

// ====== Вспомогательные компоненты ======

function ActivationCheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? (
        <CheckCircle2 className="size-4 text-status-active flex-shrink-0 mt-0.5" />
      ) : (
        <XCircle className="size-4 text-status-overdue flex-shrink-0 mt-0.5" />
      )}
      <span className={ok ? 'text-text-2' : 'text-text'}>{label}</span>
    </li>
  );
}

function SortablePhoto({ url, onRemove }: { url: string; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: url,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="aspect-square relative rounded-lg overflow-hidden bg-surface-2 group"
    >
      <img src={url} alt="" className="w-full h-full object-cover" />
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute top-1 left-1 size-6 rounded-full bg-surface/90 grid place-items-center text-text-3 hover:text-text cursor-grab active:cursor-grabbing"
        aria-label="Перетащить"
      >
        <GripVertical className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 size-6 rounded-full bg-surface/90 grid place-items-center text-status-overdue hover:bg-surface"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
