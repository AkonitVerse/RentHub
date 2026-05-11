import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Plus, Trash2, Loader2, Sparkles, Building2, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { useClientsList, useEquipmentList, useCreateOrder, useOrder } from '@/lib/hooks/queries';
import { ordersApi } from '@/lib/api/endpoints';
import { apiErrorMessage } from '@/lib/api/client';
import { fmtRub, daysBetween, fmtDays } from '@/lib/utils/format';

const schema = z.object({
  clientId: z.number().min(1, 'Выберите клиента'),
  fromDate: z.string().min(1, 'Укажите дату начала'),
  toDate: z.string().min(1, 'Укажите дату окончания'),
  deliveryMethod: z.enum(['PICKUP', 'DELIVERY']),
  address: z.string().optional(),
  contactPhone: z.string().regex(/^\+7\d{10}$/, 'Введите телефон полностью: +7 (XXX) XXX-XX-XX'),
  contactEmail: z.string().email().optional().or(z.literal('')),
  deposit: z.number().min(0).optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface LineDraft {
  equipmentId: number;
  qty: number;
}

const todayISO = (offset = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

export function OrderCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: clientsData } = useClientsList({ limit: 200 });
  const { data: equipData } = useEquipmentList({ limit: 200 });
  const create = useCreateOrder();

  // === Prefill из query-параметров ===
  const prefilledClientId = searchParams.get('clientId');
  const prefilledEquipmentId = searchParams.get('equipmentId');
  const prefilledQty = searchParams.get('qty');
  const prefilledFromDate = searchParams.get('fromDate');
  const prefilledToDate = searchParams.get('toDate');
  const duplicateFrom = searchParams.get('duplicateFrom');
  const { data: sourceOrder } = useOrder(duplicateFrom ? Number(duplicateFrom) : undefined);

  const prefillNotice = useMemo(() => {
    if (duplicateFrom) return 'Заказ скопирован — обновите даты и сохраните';
    if (prefilledClientId) return 'Клиент подставлен — добавьте оборудование и сохраните';
    if (prefilledEquipmentId) return 'Оборудование добавлено — выберите клиента и сохраните';
    if (prefilledFromDate || prefilledToDate) return 'Даты подставлены из календаря';
    return null;
  }, [duplicateFrom, prefilledClientId, prefilledEquipmentId, prefilledFromDate, prefilledToDate]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientId: prefilledClientId ? Number(prefilledClientId) : undefined,
      fromDate: prefilledFromDate ?? todayISO(0),
      toDate: prefilledToDate ?? todayISO(7),
      deliveryMethod: 'PICKUP',
      deposit: 0,
    },
  });

  const [lines, setLines] = useState<LineDraft[]>(
    prefilledEquipmentId
      ? [{ equipmentId: Number(prefilledEquipmentId), qty: Number(prefilledQty ?? 1) }]
      : [],
  );
  const [previewSum, setPreviewSum] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Если копируем из существующего заказа — заполняем после загрузки исходника
  useEffect(() => {
    if (!sourceOrder) return;
    setValue('clientId', sourceOrder.clientId);
    setValue('contactPhone', sourceOrder.contactPhone);
    if (sourceOrder.contactEmail) setValue('contactEmail', sourceOrder.contactEmail);
    setValue('deliveryMethod', sourceOrder.deliveryMethod);
    if (sourceOrder.address) setValue('address', sourceOrder.address);
    setValue('deposit', sourceOrder.deposit);
    if (sourceOrder.lines && sourceOrder.lines.length > 0) {
      setLines(sourceOrder.lines.map((l) => ({ equipmentId: l.equipmentId, qty: l.qty })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceOrder]);

  const watchedFrom = watch('fromDate');
  const watchedTo = watch('toDate');
  const watchedDelivery = watch('deliveryMethod');

  const selectedClient = clientsData?.items.find((c) => c.id === watch('clientId'));
  useEffect(() => {
    if (selectedClient) {
      // Для юрлиц: берём телефон контактного лица (если есть), иначе основной.
      const phone =
        selectedClient.clientType === 'COMPANY' && selectedClient.contactPhone
          ? selectedClient.contactPhone
          : selectedClient.phone;
      setValue('contactPhone', phone);
      if (selectedClient.email) setValue('contactEmail', selectedClient.email);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient]);

  const days = useMemo(() => {
    if (!watchedFrom || !watchedTo) return 0;
    return daysBetween(watchedFrom, watchedTo);
  }, [watchedFrom, watchedTo]);

  // Auto-preview
  useEffect(() => {
    if (lines.length === 0 || !watchedFrom || !watchedTo) {
      setPreviewSum(null);
      return;
    }
    setPreviewLoading(true);
    ordersApi
      .preview({
        fromDate: new Date(watchedFrom).toISOString(),
        toDate: new Date(watchedTo).toISOString(),
        lines: lines.map((l) => ({ equipmentId: l.equipmentId, qty: l.qty })),
      })
      .then((r) => setPreviewSum(r.totalAmount))
      .catch(() => setPreviewSum(null))
      .finally(() => setPreviewLoading(false));
  }, [lines, watchedFrom, watchedTo]);

  const addLine = (equipmentId: number) => {
    if (lines.find((l) => l.equipmentId === equipmentId)) {
      setLines(lines.map((l) => (l.equipmentId === equipmentId ? { ...l, qty: l.qty + 1 } : l)));
    } else {
      setLines([...lines, { equipmentId, qty: 1 }]);
    }
  };

  const removeLine = (equipmentId: number) => {
    setLines(lines.filter((l) => l.equipmentId !== equipmentId));
  };

  const setLineQty = (equipmentId: number, qty: number) => {
    setLines(
      lines.map((l) => (l.equipmentId === equipmentId ? { ...l, qty: Math.max(1, qty) } : l)),
    );
  };

  const onSubmit = async (data: FormValues) => {
    if (lines.length === 0) {
      toast.error('Добавьте хотя бы одну позицию');
      return;
    }
    try {
      const order = await create.mutateAsync({
        clientId: data.clientId,
        fromDate: new Date(data.fromDate).toISOString(),
        toDate: new Date(data.toDate).toISOString(),
        deliveryMethod: data.deliveryMethod,
        address: data.address || undefined,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail || undefined,
        deposit: data.deposit ?? 0,
        notes: data.notes || undefined,
        lines: lines.map((l) => ({ equipmentId: l.equipmentId, qty: l.qty })),
      });
      toast.success(`Заказ ${order.number} создан`);
      navigate(`/admin/orders/${order.id}`);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось создать заказ'));
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
        <ArrowLeft className="size-4" /> Назад
      </Button>

      <PageHeader
        title="Новый заказ"
        description="Заполните данные клиента и выберите оборудование"
      />

      {prefillNotice && (
        <div className="rounded-xl border border-blue/20 bg-blue-soft text-blue px-4 py-3 mb-4 flex items-center gap-2 text-sm">
          <Sparkles className="size-4 flex-shrink-0" />
          <span>{prefillNotice}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="grid lg:grid-cols-[1fr_360px] gap-4">
        <div className="space-y-4">
          {/* === CLIENT === */}
          <section className="rounded-xl border bg-surface p-5">
            <h2 className="font-display font-semibold mb-4">Клиент</h2>
            <div>
              <Label>Клиент *</Label>
              <Select
                onValueChange={(v) => setValue('clientId', Number(v))}
                value={watch('clientId')?.toString()}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Выберите клиента" />
                </SelectTrigger>
                <SelectContent>
                  {clientsData?.items.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      <span className="flex items-center gap-1.5">
                        {c.clientType === 'COMPANY' ? (
                          <Building2 className="size-3.5 text-amber-500 shrink-0" />
                        ) : (
                          <UserIcon className="size-3.5 text-blue shrink-0" />
                        )}
                        {c.name}
                        <span className="text-text-3">
                          {c.clientType === 'COMPANY' && c.inn
                            ? `ИНН ${c.inn}`
                            : c.phone}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.clientId && (
                <p className="text-xs text-status-overdue mt-1">{errors.clientId.message}</p>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <div>
                <Label htmlFor="contactPhone">Телефон контакта</Label>
                <PhoneInput
                  id="contactPhone"
                  className="mt-1.5"
                  value={watch('contactPhone') ?? ''}
                  onChange={(canonical) =>
                    setValue('contactPhone', canonical, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
                {errors.contactPhone && (
                  <p className="text-xs text-status-overdue mt-1">{errors.contactPhone.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="contactEmail">Email (необяз.)</Label>
                <Input id="contactEmail" {...register('contactEmail')} className="mt-1.5" />
              </div>
            </div>
          </section>

          {/* === DATES === */}
          <section className="rounded-xl border bg-surface p-5">
            <h2 className="font-display font-semibold mb-4">Сроки</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="fromDate">Дата начала *</Label>
                <Input id="fromDate" type="date" {...register('fromDate')} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="toDate">Дата окончания *</Label>
                <Input id="toDate" type="date" {...register('toDate')} className="mt-1.5" />
              </div>
            </div>
            <div className="text-sm text-text-2 mt-3">
              Длительность: <span className="font-semibold">{fmtDays(days)}</span>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <div>
                <Label>Способ получения *</Label>
                <Select
                  value={watchedDelivery}
                  onValueChange={(v) => setValue('deliveryMethod', v as 'PICKUP' | 'DELIVERY')}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PICKUP">Самовывоз</SelectItem>
                    <SelectItem value="DELIVERY">Доставка</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="deposit">Залог, ₽</Label>
                <Input
                  id="deposit"
                  type="number"
                  {...register('deposit', { valueAsNumber: true })}
                  className="mt-1.5"
                />
              </div>
            </div>
            {watchedDelivery === 'DELIVERY' && (
              <div className="mt-3">
                <Label htmlFor="address">Адрес доставки</Label>
                <Input
                  id="address"
                  {...register('address')}
                  className="mt-1.5"
                  placeholder="Город, улица, дом, квартира"
                />
              </div>
            )}
          </section>

          {/* === LINES === */}
          <section className="rounded-xl border bg-surface p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold">Оборудование</h2>
              <Select onValueChange={(v) => addLine(Number(v))}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Добавить позицию" />
                </SelectTrigger>
                <SelectContent>
                  {equipData?.items.map((e) => (
                    <SelectItem key={e.id} value={e.id.toString()}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {lines.length === 0 ? (
              <div className="text-sm text-text-3 text-center py-8 border-2 border-dashed rounded-lg">
                Добавьте оборудование из списка выше
              </div>
            ) : (
              <ul className="divide-y">
                {lines.map((line) => {
                  const eq = equipData?.items.find((e) => e.id === line.equipmentId);
                  if (!eq) return null;
                  return (
                    <li key={line.equipmentId} className="py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{eq.name}</div>
                        <div className="font-mono text-xs text-text-3">{eq.sku}</div>
                      </div>
                      <Input
                        type="number"
                        min={1}
                        max={eq.totalUnits}
                        value={line.qty}
                        onChange={(e) => setLineQty(line.equipmentId, Number(e.target.value))}
                        className="w-20 text-right"
                      />
                      <span className="text-xs text-text-3 w-16 text-right">
                        из {eq.totalUnits}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLine(line.equipmentId)}
                      >
                        <Trash2 className="size-4 text-status-overdue" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* === NOTES === */}
          <section className="rounded-xl border bg-surface p-5">
            <Label htmlFor="notes">Заметки к заказу</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              rows={3}
              className="mt-1.5"
              placeholder="Особые условия, договорённости..."
            />
          </section>
        </div>

        {/* === SUMMARY === */}
        <aside className="space-y-4">
          <div className="sticky top-20 rounded-xl border bg-surface p-5">
            <h3 className="font-display font-semibold mb-3">Сумма заказа</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-2">Позиций</span>
                <span className="font-mono">{lines.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-2">Дней</span>
                <span className="font-mono">{days}</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="text-text-3 text-xs uppercase tracking-wide">Итого</div>
              <div className="font-display font-bold text-3xl mt-1 price">
                {previewLoading ? (
                  <Loader2 className="animate-spin size-6 text-text-3" />
                ) : (
                  fmtRub(previewSum ?? 0)
                )}
              </div>
              <div className="text-xs text-text-3 mt-1">с учётом тарифа на {days} дн.</div>
            </div>
            <Button type="submit" size="lg" disabled={create.isPending} className="w-full mt-5">
              {create.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Создать заказ
            </Button>
          </div>
        </aside>
      </form>
    </>
  );
}
