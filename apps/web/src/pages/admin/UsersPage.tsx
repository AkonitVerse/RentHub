import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Edit, Loader2, Shield, ShieldCheck, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
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
import {
  useCreateUser,
  useDeleteUser,
  useUpdateUser,
  useUsersList,
  type SystemUser,
} from '@/lib/hooks/queries';
import { useCurrentUser, roleLabel } from '@/lib/hooks/auth';
import { fmtDateTime, fmtPhone } from '@/lib/utils/format';
import { apiErrorMessage } from '@/lib/api/client';
import { stripDigitsOnInput, normalizeNameOnBlur } from '@/lib/utils/name';
import { cn } from '@/lib/utils/cn';

const PHONE_REGEX = /^\+7\d{10}$/;
const PHONE_ERROR = 'Введите телефон полностью: +7 (XXX) XXX-XX-XX';
// Цифры в имени/фамилии запрещены — синхронно с регистрацией клиента, /me и
// созданием клиентов в /admin/customers.
const NO_DIGITS_REGEX = /^[^\d]+$/u;

const createSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, 'Введите имя')
    .regex(NO_DIGITS_REGEX, 'Имя не должно содержать цифр'),
  lastName: z
    .string()
    .trim()
    .min(2, 'Введите фамилию')
    .regex(NO_DIGITS_REGEX, 'Фамилия не должна содержать цифр'),
  email: z.string().email('Некорректный email'),
  phone: z.string().regex(PHONE_REGEX, PHONE_ERROR),
  password: z.string().min(6, 'Минимум 6 символов'),
  role: z.enum(['ADMIN', 'MANAGER']),
});
type CreateValues = z.infer<typeof createSchema>;

const editSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, 'Введите имя')
    .regex(NO_DIGITS_REGEX, 'Имя не должно содержать цифр'),
  lastName: z
    .string()
    .trim()
    .min(2, 'Введите фамилию')
    .regex(NO_DIGITS_REGEX, 'Фамилия не должна содержать цифр'),
  // На редактировании телефон опциональный — если не меняется, можно оставить пустым.
  // Но если задан — должен быть в каноническом формате.
  phone: z
    .string()
    .optional()
    .refine((v) => !v || PHONE_REGEX.test(v), PHONE_ERROR),
  role: z.enum(['ADMIN', 'MANAGER']),
  password: z.string().optional(),
});
type EditValues = z.infer<typeof editSchema>;

const ROLE_BADGE_VARIANT: Record<
  SystemUser['role'],
  { bg: string; label: string; Icon: typeof UserIcon }
> = {
  ADMIN: {
    bg: 'bg-status-overdue-bg text-status-overdue',
    label: 'Администратор',
    Icon: ShieldCheck,
  },
  MANAGER: { bg: 'bg-status-pending-bg text-status-pending', label: 'Менеджер', Icon: Shield },
  USER: { bg: 'bg-status-new-bg text-status-new', label: 'Клиент', Icon: UserIcon },
};

export function UsersPage() {
  const { data: users, isLoading } = useUsersList();
  const me = useCurrentUser();
  const create = useCreateUser();
  const update = useUpdateUser();
  const remove = useDeleteUser();

  // Считаем сколько в системе админов — нужно чтобы запретить удаление и понижение
  // последнего. Без админа никто не сможет управлять платформой.
  const adminCount = (users ?? []).filter((u) => u.role === 'ADMIN').length;

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<SystemUser | null>(null);
  const [deleting, setDeleting] = useState<SystemUser | null>(null);

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: 'MANAGER' },
  });

  const editForm = useForm<EditValues>({
    resolver: zodResolver(editSchema),
  });

  const openCreate = () => {
    createForm.reset({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      role: 'MANAGER',
    });
    setCreateOpen(true);
  };

  const openEdit = (u: SystemUser) => {
    // Если на бэке нет firstName/lastName в /users response — берём первое слово.
    const parts = u.name.split(' ');
    // Endpoint /users возвращает только ADMIN/MANAGER (фильтр на бэке), поэтому
    // 'USER' здесь невозможен — приводим тип, чтобы TS не ругался.
    const safeRole: 'ADMIN' | 'MANAGER' = u.role === 'ADMIN' ? 'ADMIN' : 'MANAGER';
    editForm.reset({
      firstName: u.firstName ?? parts[0] ?? '',
      lastName: u.lastName ?? parts.slice(1).join(' ') ?? '',
      phone: u.phone ?? '',
      role: safeRole,
      password: '',
    });
    setEditing(u);
  };

  const onCreate = async (data: CreateValues) => {
    try {
      await create.mutateAsync(data);
      toast.success('Сотрудник создан');
      setCreateOpen(false);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось создать'));
    }
  };

  const onEdit = async (data: EditValues) => {
    if (!editing) return;
    try {
      await update.mutateAsync({
        id: editing.id,
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          // Телефон отправляем только если был изменён (иначе backend получит пустую строку
          // и попытается её сохранить как канонический формат — упадёт валидация).
          phone: data.phone && data.phone !== editing.phone ? data.phone : undefined,
          role: data.role,
          password: data.password || undefined,
        },
      });
      toast.success('Изменения сохранены');
      setEditing(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось сохранить'));
    }
  };

  const onDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      toast.success('Сотрудник удалён');
      setDeleting(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось удалить'));
    }
  };

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Сотрудники"
        description={`${users?.length ?? 0} учётных записей · администраторы и менеджеры платформы`}
        action={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Создать
          </Button>
        }
      />

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : !users?.length ? (
        <EmptyState title="Сотрудников нет" />
      ) : (
        <div className="rounded-xl border bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-text-3 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Сотрудник</th>
                  <th className="text-left px-4 py-3 font-medium">Телефон</th>
                  <th className="text-left px-4 py-3 font-medium">Роль</th>
                  <th className="text-left px-4 py-3 font-medium">Создан</th>
                  <th className="text-right px-4 py-3 font-medium">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => {
                  const v = ROLE_BADGE_VARIANT[u.role];
                  const isMe = u.id === me?.id;
                  const isLastAdmin = u.role === 'ADMIN' && adminCount === 1;
                  return (
                    <tr key={u.id} className="hover:bg-surface-2 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium flex items-center gap-2">
                          {u.name}
                          {isMe && (
                            <Badge variant="outline" className="text-[10px]">
                              это вы
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-text-3 font-mono mt-0.5">{u.email}</div>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono whitespace-nowrap">
                        {u.phone ? (
                          fmtPhone(u.phone)
                        ) : (
                          <span className="text-text-4 italic">не указан</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                            v.bg,
                          )}
                        >
                          <v.Icon className="size-3" />
                          {v.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-2 whitespace-nowrap">
                        {fmtDateTime(u.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEdit(u)}
                            title="Редактировать"
                          >
                            <Edit className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={isMe || isLastAdmin}
                            onClick={() => setDeleting(u)}
                            title={
                              isMe
                                ? 'Нельзя удалить себя'
                                : isLastAdmin
                                  ? 'Нельзя удалить последнего администратора'
                                  : 'Удалить'
                            }
                          >
                            <Trash2
                              className={cn(
                                'size-3.5',
                                !isMe && !isLastAdmin && 'text-status-overdue',
                              )}
                            />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* === Создание === */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Новый сотрудник</DialogTitle>
            <DialogDescription>
              Создайте учётную запись администратора или менеджера для работы в админке
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(onCreate)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cu-firstname">Имя *</Label>
                <Input
                  id="cu-firstname"
                  {...createForm.register('firstName', {
                    onChange: stripDigitsOnInput,
                    onBlur: (e) =>
                      normalizeNameOnBlur(e, (v) =>
                        createForm.setValue('firstName', v, {
                          shouldDirty: true,
                          shouldValidate: true,
                        }),
                      ),
                  })}
                  className="mt-1"
                />
                {createForm.formState.errors.firstName && (
                  <p className="text-xs text-status-overdue mt-1">
                    {createForm.formState.errors.firstName.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="cu-lastname">Фамилия *</Label>
                <Input
                  id="cu-lastname"
                  {...createForm.register('lastName', {
                    onChange: stripDigitsOnInput,
                    onBlur: (e) =>
                      normalizeNameOnBlur(e, (v) =>
                        createForm.setValue('lastName', v, {
                          shouldDirty: true,
                          shouldValidate: true,
                        }),
                      ),
                  })}
                  className="mt-1"
                />
                {createForm.formState.errors.lastName && (
                  <p className="text-xs text-status-overdue mt-1">
                    {createForm.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="cu-email">Email *</Label>
              <Input
                id="cu-email"
                type="email"
                {...createForm.register('email')}
                className="mt-1"
              />
              {createForm.formState.errors.email && (
                <p className="text-xs text-status-overdue mt-1">
                  {createForm.formState.errors.email.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="cu-phone">Телефон *</Label>
              <PhoneInput
                id="cu-phone"
                value={createForm.watch('phone') ?? ''}
                onChange={(canonical) =>
                  createForm.setValue('phone', canonical, { shouldValidate: true })
                }
                className="mt-1"
              />
              {createForm.formState.errors.phone && (
                <p className="text-xs text-status-overdue mt-1">
                  {createForm.formState.errors.phone.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="cu-password">Пароль *</Label>
              <Input
                id="cu-password"
                type="password"
                {...createForm.register('password')}
                placeholder="не менее 6 символов"
                className="mt-1"
              />
              {createForm.formState.errors.password && (
                <p className="text-xs text-status-overdue mt-1">
                  {createForm.formState.errors.password.message}
                </p>
              )}
            </div>
            <div>
              <Label>Роль *</Label>
              <Select
                value={createForm.watch('role')}
                onValueChange={(v) => createForm.setValue('role', v as CreateValues['role'])}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANAGER">
                    {roleLabel('MANAGER')} — управляет заказами и складом
                  </SelectItem>
                  <SelectItem value="ADMIN">{roleLabel('ADMIN')} — полный доступ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Создать
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* === Редактирование === */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Редактирование сотрудника</DialogTitle>
            <DialogDescription>{editing?.email}</DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="eu-firstname">Имя</Label>
                <Input
                  id="eu-firstname"
                  {...editForm.register('firstName', {
                    onChange: stripDigitsOnInput,
                    onBlur: (e) =>
                      normalizeNameOnBlur(e, (v) =>
                        editForm.setValue('firstName', v, {
                          shouldDirty: true,
                          shouldValidate: true,
                        }),
                      ),
                  })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="eu-lastname">Фамилия</Label>
                <Input
                  id="eu-lastname"
                  {...editForm.register('lastName', {
                    onChange: stripDigitsOnInput,
                    onBlur: (e) =>
                      normalizeNameOnBlur(e, (v) =>
                        editForm.setValue('lastName', v, {
                          shouldDirty: true,
                          shouldValidate: true,
                        }),
                      ),
                  })}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="eu-phone">Телефон</Label>
              <PhoneInput
                id="eu-phone"
                value={editForm.watch('phone') ?? ''}
                onChange={(canonical) =>
                  editForm.setValue('phone', canonical, { shouldValidate: true })
                }
                className="mt-1"
              />
              {editForm.formState.errors.phone && (
                <p className="text-xs text-status-overdue mt-1">
                  {editForm.formState.errors.phone.message}
                </p>
              )}
            </div>
            <div>
              <Label>Роль</Label>
              <Select
                value={editForm.watch('role')}
                onValueChange={(v) => editForm.setValue('role', v as EditValues['role'])}
                disabled={editing?.id === me?.id}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANAGER">{roleLabel('MANAGER')}</SelectItem>
                  <SelectItem value="ADMIN">{roleLabel('ADMIN')}</SelectItem>
                </SelectContent>
              </Select>
              {editing?.id === me?.id && (
                <p className="text-xs text-text-3 mt-1">Нельзя изменить свою собственную роль</p>
              )}
            </div>
            <div>
              <Label htmlFor="eu-password">Новый пароль (необязательно)</Label>
              <Input
                id="eu-password"
                type="password"
                {...editForm.register('password')}
                placeholder="оставьте пустым, чтобы не менять"
                className="mt-1"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Отмена
              </Button>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Edit className="size-4" />
                )}
                Сохранить
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* === Удаление === */}
      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Удалить пользователя?</DialogTitle>
            <DialogDescription>
              {deleting?.name} ({deleting?.email}) — учётная запись будет удалена безвозвратно.
            </DialogDescription>
          </DialogHeader>
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
    </div>
  );
}
