import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Search,
  Loader2,
  Edit,
  Trash2,
  ShoppingBag,
  ExternalLink,
  Phone,
  Mail,
  MoreHorizontal,
  Download,
  Building2,
  User as UserIcon,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { BulkActionBar } from '@/components/shared/BulkActionBar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useClientsList,
  useCreateClient,
  useDeleteClient,
  useUpdateClient,
} from '@/lib/hooks/queries';
import { useIsAdmin } from '@/lib/hooks/auth';
import { fmtPhone } from '@/lib/utils/format';
import { apiErrorMessage } from '@/lib/api/client';
import { stripDigitsOnInput, normalizeNameOnBlur } from '@/lib/utils/name';
import { validateInn } from '@/lib/utils/inn';
import type { Client, ClientType } from '@/lib/api/types';

// Цифры в имени/фамилии запрещены — синхронно с регистрацией клиента и /me.
const NO_DIGITS_REGEX = /^[^\d]+$/u;

const PHONE_REGEX = /^\+7\d{10}$/;

const individualSchema = z.object({
  clientType: z.literal('INDIVIDUAL' as const),
  firstName: z
    .string()
    .trim()
    .min(2, 'Введите имя')
    .max(50, 'Слишком длинное имя')
    .regex(NO_DIGITS_REGEX, 'Имя не должно содержать цифр'),
  lastName: z
    .string()
    .trim()
    .min(2, 'Введите фамилию')
    .max(50, 'Слишком длинная фамилия')
    .regex(NO_DIGITS_REGEX, 'Фамилия не должна содержать цифр'),
  phone: z.string().regex(PHONE_REGEX, 'Введите телефон полностью: +7 (XXX) XXX-XX-XX'),
  email: z.string().email().optional().or(z.literal('')),
});

const companySchema = z.object({
  clientType: z.literal('COMPANY' as const),
  companyName: z.string().trim().min(2, 'Введите название организации'),
  phone: z.string().regex(PHONE_REGEX, 'Введите телефон полностью'),
  email: z.string().email().optional().or(z.literal('')),
  inn: z
    .string()
    .regex(/^\d{10}$|^\d{12}$/, 'ИНН: 10 цифр (юрлицо) или 12 цифр (ИП)')
    .refine(validateInn, 'Некорректная контрольная сумма ИНН'),
  kpp: z
    .string()
    .regex(/^\d{9}$/, 'КПП: 9 цифр')
    .optional()
    .or(z.literal('')),
  ogrn: z
    .string()
    .regex(/^\d{13}$|^\d{15}$/, 'ОГРН: 13 или 15 цифр')
    .optional()
    .or(z.literal('')),
  legalAddress: z.string().optional().or(z.literal('')),
  contactPerson: z.string().trim().min(2, 'Укажите контактное лицо'),
  contactPosition: z.string().optional().or(z.literal('')),
  contactPhone: z
    .string()
    .regex(PHONE_REGEX, 'Формат: +7 (XXX) XXX-XX-XX')
    .optional()
    .or(z.literal('')),
  bankAccount: z
    .string()
    .regex(/^\d{20}$/, 'Расчётный счёт: 20 цифр')
    .optional()
    .or(z.literal('')),
  bankBik: z
    .string()
    .regex(/^\d{9}$/, 'БИК: 9 цифр')
    .optional()
    .or(z.literal('')),
  bankName: z.string().optional().or(z.literal('')),
});

const schema = z.discriminatedUnion('clientType', [individualSchema, companySchema]);
type FormValues = z.infer<typeof schema>;

function joinName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

function splitName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim();
  const idx = trimmed.indexOf(' ');
  if (idx === -1) return { firstName: trimmed, lastName: '' };
  return { firstName: trimmed.slice(0, idx).trim(), lastName: trimmed.slice(idx + 1).trim() };
}

type TypeFilter = 'ALL' | ClientType;

export function ClientsListPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data, isLoading } = useClientsList({
    search: search || undefined,
    clientType: typeFilter === 'ALL' ? undefined : typeFilter,
    limit: 100,
  });

  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const clearSelection = () => setSelected(new Set());
  const create = useCreateClient();
  const update = useUpdateClient();
  const remove = useDeleteClient();
  const isAdmin = useIsAdmin();

  const createForm = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { clientType: 'INDIVIDUAL' } as any,
  });

  const editForm = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { clientType: 'INDIVIDUAL' } as any,
  });

  useEffect(() => {
    if (editing) {
      if (editing.clientType === 'COMPANY') {
        editForm.reset({
          clientType: 'COMPANY',
          companyName: editing.name,
          phone: editing.phone,
          email: editing.email ?? '',
          inn: editing.inn ?? '',
          kpp: editing.kpp ?? '',
          ogrn: editing.ogrn ?? '',
          legalAddress: editing.legalAddress ?? '',
          contactPerson: editing.contactPerson ?? '',
          contactPosition: editing.contactPosition ?? '',
          contactPhone: editing.contactPhone ?? '',
          bankAccount: editing.bankAccount ?? '',
          bankBik: editing.bankBik ?? '',
          bankName: editing.bankName ?? '',
        });
      } else {
        const { firstName, lastName } = splitName(editing.name);
        editForm.reset({
          clientType: 'INDIVIDUAL',
          firstName,
          lastName,
          phone: editing.phone,
          email: editing.email ?? '',
        });
      }
    }
  }, [editing, editForm]);

  const buildPayload = (data: FormValues) => {
    if (data.clientType === 'COMPANY') {
      return {
        clientType: 'COMPANY' as const,
        name: data.companyName,
        phone: data.phone,
        email: data.email || null,
        inn: data.inn,
        kpp: data.kpp || null,
        ogrn: data.ogrn || null,
        legalAddress: data.legalAddress || null,
        contactPerson: data.contactPerson,
        contactPosition: data.contactPosition || null,
        contactPhone: data.contactPhone || null,
        bankAccount: data.bankAccount || null,
        bankBik: data.bankBik || null,
        bankName: data.bankName || null,
      };
    }
    return {
      clientType: 'INDIVIDUAL' as const,
      name: joinName(data.firstName, data.lastName),
      phone: data.phone,
      email: data.email || null,
    };
  };

  const onCreate = async (data: FormValues) => {
    try {
      await create.mutateAsync(buildPayload(data) as any);
      toast.success(data.clientType === 'COMPANY' ? 'Организация создана' : 'Клиент создан');
      setCreateOpen(false);
      createForm.reset({ clientType: 'INDIVIDUAL' } as any);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось создать'));
    }
  };

  const onEdit = async (data: FormValues) => {
    if (!editing) return;
    try {
      await update.mutateAsync({ id: editing.id, data: buildPayload(data) as any });
      toast.success('Изменения сохранены');
      setEditing(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось сохранить'));
    }
  };

  const onDelete = async () => {
    if (!deleting) return;
    const hadOrders = (deleting._count?.orders ?? 0) > 0;
    try {
      await remove.mutateAsync(deleting.id);
      toast.success(
        hadOrders ? 'Аккаунт клиента удалён, история заказов сохранена' : 'Клиент удалён',
      );
      setDeleting(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось удалить'));
    }
  };

  const total = data?.total ?? 0;
  const TYPE_TABS: { value: TypeFilter; label: string }[] = [
    { value: 'ALL', label: `Все (${total})` },
    { value: 'INDIVIDUAL', label: 'Физ. лица' },
    { value: 'COMPANY', label: 'Юр. лица' },
  ];

  return (
    <>
      <PageHeader
        title="Клиенты"
        description={`${total} клиентов в базе`}
        action={
          <Button
            onClick={() => {
              createForm.reset({ clientType: 'INDIVIDUAL' } as any);
              setCreateOpen(true);
            }}
          >
            <Plus className="size-4" /> Добавить
          </Button>
        }
      />

      {/* Фильтр по типу + поиск */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex gap-1 bg-surface-2 rounded-lg p-1">
          {TYPE_TABS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTypeFilter(value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                typeFilter === value
                  ? 'bg-surface text-text shadow-sm'
                  : 'text-text-3 hover:text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-3" />
          <Input
            placeholder="Поиск по имени, телефону, email, ИНН…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : !data?.items.length ? (
        <EmptyState title="Клиентов нет" />
      ) : (
        <div className="rounded-xl border bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-text-3 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-3 w-8">
                    <Checkbox
                      checked={data.items.length > 0 && data.items.every((c) => selected.has(c.id))}
                      onCheckedChange={(v) => {
                        if (v) setSelected(new Set(data.items.map((c) => c.id)));
                        else clearSelection();
                      }}
                      aria-label="Выделить всех"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-medium">Клиент</th>
                  <th className="text-left px-4 py-3 font-medium">Контакты</th>
                  <th className="text-right px-4 py-3 font-medium">Заказов</th>
                  <th className="text-right px-4 py-3 font-medium w-20">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.items.map((client) => (
                  <tr key={client.id} className="hover:bg-surface-2 transition-colors">
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(client.id)}
                        onCheckedChange={() => toggleSelect(client.id)}
                        aria-label={`Выделить клиента ${client.name}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {client.clientType === 'COMPANY' ? (
                          <Building2 className="size-4 text-amber-500 shrink-0" />
                        ) : (
                          <UserIcon className="size-4 text-blue shrink-0" />
                        )}
                        <div>
                          <Link
                            to={`/admin/customers/${client.id}`}
                            className="font-medium hover:text-blue"
                          >
                            {client.name}
                          </Link>
                          {client.clientType === 'COMPANY' && client.inn && (
                            <div className="text-[11px] text-text-3 font-mono">
                              ИНН {client.inn}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`tel:${client.phone}`}
                        className="inline-flex items-center gap-1.5 text-xs text-text-2 hover:text-text font-mono"
                      >
                        <Phone className="size-3" />
                        {fmtPhone(client.phone)}
                      </a>
                      {client.email && (
                        <div className="mt-1">
                          <a
                            href={`mailto:${client.email}`}
                            className="inline-flex items-center gap-1.5 text-xs text-text-2 hover:text-text"
                          >
                            <Mail className="size-3" />
                            {client.email}
                          </a>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{client._count?.orders ?? 0}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <Button asChild variant="ghost" size="icon-sm" title="Открыть карточку">
                          <Link to={`/admin/customers/${client.id}`}>
                            <ExternalLink className="size-3.5" />
                          </Link>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" title="Ещё действия">
                              <MoreHorizontal className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem asChild>
                              <Link
                                to={`/admin/orders/new?clientId=${client.id}`}
                                className="cursor-pointer"
                              >
                                <ShoppingBag className="size-4" /> Создать заказ
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setEditing(client)}
                              className="cursor-pointer"
                            >
                              <Edit className="size-4" /> Редактировать
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a href={`tel:${client.phone}`} className="cursor-pointer">
                                <Phone className="size-4" /> Позвонить
                              </a>
                            </DropdownMenuItem>
                            {client.email && (
                              <DropdownMenuItem asChild>
                                <a href={`mailto:${client.email}`} className="cursor-pointer">
                                  <Mail className="size-4" /> Написать
                                </a>
                              </DropdownMenuItem>
                            )}
                            {isAdmin && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDeleting(client)}
                                  className="cursor-pointer text-status-overdue focus:text-status-overdue"
                                >
                                  <Trash2 className="size-4" /> Удалить
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <BulkActionBar count={selected.size} onClear={clearSelection}>
        <Button
          size="sm"
          variant="ghost"
          className="text-bg hover:bg-white/10 rounded-full"
          onClick={() => {
            const arr = (data?.items ?? []).filter((c) => selected.has(c.id));
            const csvBlob = new Blob(
              [
                '\uFEFF' +
                  'Тип,Название/ФИО,Телефон,Email,ИНН,Контактное лицо\n' +
                  arr
                    .map(
                      (c) =>
                        `"${c.clientType === 'COMPANY' ? 'Юрлицо' : 'Физлицо'}","${c.name}","${c.phone}","${c.email ?? ''}","${c.inn ?? ''}","${c.contactPerson ?? ''}"`,
                    )
                    .join('\n'),
              ],
              { type: 'text/csv;charset=utf-8' },
            );
            const url = URL.createObjectURL(csvBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success(`Экспортировано ${selected.size} клиентов`);
          }}
        >
          <Download className="size-3.5" /> Экспорт CSV
        </Button>
      </BulkActionBar>

      {/* === Создание === */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Новый клиент</DialogTitle>
            <DialogDescription>Добавьте контактные данные</DialogDescription>
          </DialogHeader>
          <ClientForm form={createForm} onSubmit={onCreate} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Отмена
            </Button>
            <Button onClick={createForm.handleSubmit(onCreate)} disabled={create.isPending}>
              {create.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Редактирование === */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Редактирование клиента</DialogTitle>
            <DialogDescription>{editing?.name}</DialogDescription>
          </DialogHeader>
          <ClientForm form={editForm} onSubmit={onEdit} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Отмена
            </Button>
            <Button onClick={editForm.handleSubmit(onEdit)} disabled={update.isPending}>
              {update.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Edit className="size-4" />
              )}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Удаление === */}
      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Удалить клиента?</DialogTitle>
            <DialogDescription>
              {deleting && (deleting._count?.orders ?? 0) > 0
                ? 'Аккаунт будет отключён, история заказов сохранится. Если клиент зарегистрируется заново с этим же телефоном — заказы автоматически вернутся в его ЛК.'
                : 'Карточка клиента и его аккаунт будут удалены полностью. Email и телефон освободятся для повторной регистрации.'}
            </DialogDescription>
          </DialogHeader>
          {deleting && (
            <div className="rounded-md border bg-surface-2 p-3 text-sm">
              <div className="flex items-center gap-2">
                {deleting.clientType === 'COMPANY' ? (
                  <Building2 className="size-4 text-amber-500" />
                ) : (
                  <UserIcon className="size-4 text-blue" />
                )}
                <span className="font-semibold">{deleting.name}</span>
              </div>
              <div className="text-text-3 text-xs mt-1 font-mono">{fmtPhone(deleting.phone)}</div>
              {deleting.inn && (
                <div className="text-text-3 text-xs mt-0.5 font-mono">ИНН {deleting.inn}</div>
              )}
              <div className="text-text-3 text-xs mt-0.5">
                Заказов: {deleting._count?.orders ?? 0}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={remove.isPending}>
              {remove.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// === Переиспользуемая форма клиента ===
function ClientForm({
  form,
  onSubmit,
}: {
  form: ReturnType<typeof useForm<FormValues>>;
  onSubmit: (data: FormValues) => void;
}) {
  const clientType = useWatch({ control: form.control, name: 'clientType' });
  const [bankOpen, setBankOpen] = useState(false);

  const switchType = (type: ClientType) => {
    if (type === 'COMPANY') {
      form.reset({
        clientType: 'COMPANY',
        companyName: '',
        phone: form.getValues('phone') ?? '',
        email: (form.getValues as any)('email') ?? '',
        inn: '',
        kpp: '',
        ogrn: '',
        legalAddress: '',
        contactPerson: '',
        contactPosition: '',
        contactPhone: '',
        bankAccount: '',
        bankBik: '',
        bankName: '',
      } as any);
    } else {
      form.reset({
        clientType: 'INDIVIDUAL',
        firstName: '',
        lastName: '',
        phone: form.getValues('phone') ?? '',
        email: (form.getValues as any)('email') ?? '',
      } as any);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" id="client-form">
      {/* Переключатель типа */}
      <div className="flex gap-1 bg-surface-2 rounded-lg p-1">
        <button
          type="button"
          onClick={() => switchType('INDIVIDUAL')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            clientType === 'INDIVIDUAL'
              ? 'bg-surface text-text shadow-sm'
              : 'text-text-3 hover:text-text'
          }`}
        >
          <UserIcon className="size-4" /> Физ. лицо
        </button>
        <button
          type="button"
          onClick={() => switchType('COMPANY')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            clientType === 'COMPANY'
              ? 'bg-surface text-text shadow-sm'
              : 'text-text-3 hover:text-text'
          }`}
        >
          <Building2 className="size-4" /> Юр. лицо
        </button>
      </div>

      {clientType === 'INDIVIDUAL' ? (
        /* === Физ. лицо === */
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cl-firstname">Имя *</Label>
              <Input
                id="cl-firstname"
                {...form.register('firstName' as any, {
                  onChange: stripDigitsOnInput,
                  onBlur: (e: any) =>
                    normalizeNameOnBlur(e, (v: string) =>
                      form.setValue('firstName' as any, v, {
                        shouldDirty: true,
                        shouldValidate: true,
                      }),
                    ),
                })}
                placeholder="Иван"
                className="mt-1"
              />
              {(form.formState.errors as any).firstName && (
                <p className="text-xs text-status-overdue mt-1">
                  {(form.formState.errors as any).firstName.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="cl-lastname">Фамилия *</Label>
              <Input
                id="cl-lastname"
                {...form.register('lastName' as any, {
                  onChange: stripDigitsOnInput,
                  onBlur: (e: any) =>
                    normalizeNameOnBlur(e, (v: string) =>
                      form.setValue('lastName' as any, v, {
                        shouldDirty: true,
                        shouldValidate: true,
                      }),
                    ),
                })}
                placeholder="Иванов"
                className="mt-1"
              />
              {(form.formState.errors as any).lastName && (
                <p className="text-xs text-status-overdue mt-1">
                  {(form.formState.errors as any).lastName.message}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* === Юр. лицо === */
        <div className="space-y-3">
          <div>
            <Label htmlFor="cl-company">Название организации *</Label>
            <Input
              id="cl-company"
              {...form.register('companyName' as any)}
              placeholder='ООО «СтройМастер»'
              className="mt-1"
            />
            {(form.formState.errors as any).companyName && (
              <p className="text-xs text-status-overdue mt-1">
                {(form.formState.errors as any).companyName.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cl-inn">ИНН *</Label>
              <Input
                id="cl-inn"
                {...form.register('inn' as any)}
                placeholder="10 или 12 цифр"
                maxLength={12}
                className="mt-1 font-mono"
              />
              {(form.formState.errors as any).inn && (
                <p className="text-xs text-status-overdue mt-1">
                  {(form.formState.errors as any).inn.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="cl-kpp">КПП</Label>
              <Input
                id="cl-kpp"
                {...form.register('kpp' as any)}
                placeholder="9 цифр"
                maxLength={9}
                className="mt-1 font-mono"
              />
              {(form.formState.errors as any).kpp && (
                <p className="text-xs text-status-overdue mt-1">
                  {(form.formState.errors as any).kpp.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="cl-ogrn">ОГРН / ОГРНИП</Label>
            <Input
              id="cl-ogrn"
              {...form.register('ogrn' as any)}
              placeholder="13 или 15 цифр"
              maxLength={15}
              className="mt-1 font-mono"
            />
            {(form.formState.errors as any).ogrn && (
              <p className="text-xs text-status-overdue mt-1">
                {(form.formState.errors as any).ogrn.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="cl-legaladdr">Юридический адрес</Label>
            <Input
              id="cl-legaladdr"
              {...form.register('legalAddress' as any)}
              placeholder="г. Москва, ул. Строителей, д. 15"
              className="mt-1"
            />
          </div>

          <div className="border-t pt-3">
            <div className="text-xs text-text-3 uppercase tracking-wide font-medium mb-2">
              Контактное лицо
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cl-cperson">ФИО *</Label>
                <Input
                  id="cl-cperson"
                  {...form.register('contactPerson' as any)}
                  placeholder="Иванов Иван Иванович"
                  className="mt-1"
                />
                {(form.formState.errors as any).contactPerson && (
                  <p className="text-xs text-status-overdue mt-1">
                    {(form.formState.errors as any).contactPerson.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="cl-cposition">Должность</Label>
                <Input
                  id="cl-cposition"
                  {...form.register('contactPosition' as any)}
                  placeholder="Генеральный директор"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="mt-3">
              <Label htmlFor="cl-cphone">Телефон контактного лица</Label>
              <PhoneInput
                id="cl-cphone"
                className="mt-1"
                value={(form.watch as any)('contactPhone') ?? ''}
                onChange={(canonical: string) =>
                  form.setValue('contactPhone' as any, canonical, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
            </div>
          </div>

          {/* Банковские реквизиты — collapsible */}
          <div className="border-t pt-3">
            <button
              type="button"
              onClick={() => setBankOpen(!bankOpen)}
              className="flex items-center gap-1 text-xs text-text-3 uppercase tracking-wide font-medium hover:text-text transition-colors"
            >
              {bankOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              Банковские реквизиты
            </button>
            {bankOpen && (
              <div className="mt-3 space-y-3">
                <div>
                  <Label htmlFor="cl-baccount">Расчётный счёт</Label>
                  <Input
                    id="cl-baccount"
                    {...form.register('bankAccount' as any)}
                    placeholder="20 цифр"
                    maxLength={20}
                    className="mt-1 font-mono"
                  />
                  {(form.formState.errors as any).bankAccount && (
                    <p className="text-xs text-status-overdue mt-1">
                      {(form.formState.errors as any).bankAccount.message}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="cl-bik">БИК</Label>
                    <Input
                      id="cl-bik"
                      {...form.register('bankBik' as any)}
                      placeholder="9 цифр"
                      maxLength={9}
                      className="mt-1 font-mono"
                    />
                    {(form.formState.errors as any).bankBik && (
                      <p className="text-xs text-status-overdue mt-1">
                        {(form.formState.errors as any).bankBik.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="cl-bname">Банк</Label>
                    <Input
                      id="cl-bname"
                      {...form.register('bankName' as any)}
                      placeholder="Наименование банка"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Общие поля */}
      <div className="border-t pt-3 space-y-3">
        <div>
          <Label htmlFor="cl-phone">
            {clientType === 'COMPANY' ? 'Телефон организации *' : 'Телефон *'}
          </Label>
          <PhoneInput
            id="cl-phone"
            className="mt-1"
            value={form.watch('phone') ?? ''}
            onChange={(canonical) =>
              form.setValue('phone', canonical, { shouldDirty: true, shouldValidate: true })
            }
          />
          {form.formState.errors.phone && (
            <p className="text-xs text-status-overdue mt-1">
              {form.formState.errors.phone.message}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="cl-email">Email</Label>
          <Input
            id="cl-email"
            type="email"
            {...form.register('email' as any)}
            className="mt-1"
          />
        </div>
      </div>
    </form>
  );
}
