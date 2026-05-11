import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  FileText,
  IdCard,
  Loader2,
  Lock,
  Mail,
  Package,
  Phone,
  Save,
  Search,
  ShieldCheck,
  ShoppingBag,
  User as UserIcon,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PhoneInput } from '@/components/ui/PhoneInput';
import {
  useChangeMyPassword,
  useMyOrders,
  useMyProfile,
  useUpdateMyProfile,
} from '@/lib/hooks/queries';
import { useAuthStore } from '@/lib/stores/auth-store';
import { apiErrorMessage } from '@/lib/api/client';
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from '@/lib/utils/order-status';
import { fmtDateLong, fmtRub } from '@/lib/utils/format';
import { stripDigitsOnInput, normalizeNameOnBlur } from '@/lib/utils/name';
import { cn } from '@/lib/utils/cn';
import type { Order, OrderStatus } from '@/lib/api/types';

// Цифры в имени/фамилии запрещены — синхронно с регистрацией.
const NO_DIGITS_REGEX = /^[^\d]+$/u;

const profileSchema = z.object({
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
  email: z.string().min(1, 'Введите email').email('Некорректный email').max(160),
  phone: z.string().regex(/^\+7\d{10}$/, 'Введите телефон полностью: +7 (XXX) XXX-XX-XX'),
});
type ProfileValues = z.infer<typeof profileSchema>;

// Требования к новому паролю синхронны со страницей регистрации и backend
// (me.dto.ts ChangePasswordDto). Минимум 6 символов, латиница/цифры/спецсимволы,
// без пробелов и кириллицы. Любая комбинация символов допустима.
const PASSWORD_REGEX = /^[\x21-\x7E]+$/;
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Введите текущий пароль'),
    newPassword: z
      .string()
      .min(6, 'Минимум 6 символов')
      .max(200, 'Слишком длинный пароль')
      .regex(PASSWORD_REGEX, 'Только латиница, цифры и спец-символы (без пробелов и кириллицы)'),
    confirm: z.string().min(1, 'Повторите новый пароль'),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: 'Пароли не совпадают',
    path: ['confirm'],
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: 'Новый пароль совпадает с текущим',
    path: ['newPassword'],
  });
type PasswordValues = z.infer<typeof passwordSchema>;

// «Активная аренда» — оборудование уже у клиента (выдано или просрочено возвратом).
// PENDING/CONFIRMED — это заявки в обработке, до выдачи.
const ACTIVE_STATUSES: OrderStatus[] = ['ACTIVE', 'OVERDUE'];
const DRAFT_STATUSES: OrderStatus[] = ['DRAFT', 'PENDING', 'CONFIRMED'];
const HISTORY_STATUSES: OrderStatus[] = ['DONE', 'CANCELLED'];

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

function daysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

/** «+79234567890» / «79234567890» / «89234567890» → «+7 (923) 456-78-90» */
function formatRussianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) {
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  }
  return raw.trim();
}

type TabKey = 'profile' | 'orders' | 'security';
const TAB_KEYS: TabKey[] = ['profile', 'orders', 'security'];
const ORDERS_FILTER_GROUPS: Array<{
  key: 'all' | 'active' | 'history';
  label: string;
  statuses: OrderStatus[] | null;
}> = [
  { key: 'all', label: 'Все', statuses: null },
  {
    key: 'active',
    label: 'Активные',
    statuses: ['DRAFT', 'PENDING', 'CONFIRMED', 'ACTIVE', 'OVERDUE'],
  },
  { key: 'history', label: 'История', statuses: ['DONE', 'CANCELLED'] },
];

export function MyProfilePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: profile, isLoading } = useMyProfile();
  // Сотрудникам клиентские заказы не нужны — пропускаем их подгрузку, чтобы
  // не делать лишний запрос. Их статистика как «клиента» здесь не показывается.
  const currentUser = useAuthStore((s) => s.user);
  const isStaff = currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER';
  const { data: ordersData, isLoading: ordersLoading } = useMyOrders(undefined, {
    enabled: !isStaff,
  });
  const updateProfile = useUpdateMyProfile();
  const changePassword = useChangeMyPassword();
  const logout = useAuthStore((s) => s.logout);

  const tabParam = searchParams.get('tab');
  // Staff не видит вкладку «Мои заказы» — если каким-то образом попал на неё
  // (по прямой ссылке), редиректим на профиль.
  const requestedTab: TabKey = (TAB_KEYS as string[]).includes(tabParam ?? '')
    ? (tabParam as TabKey)
    : 'profile';
  const activeTab: TabKey = isStaff && requestedTab === 'orders' ? 'profile' : requestedTab;
  const setTab = (next: TabKey) => {
    const sp = new URLSearchParams(searchParams);
    if (next === 'profile') sp.delete('tab');
    else sp.set('tab', next);
    setSearchParams(sp, { replace: true });
  };

  const [showCurPass, setShowCurPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [orderFilter, setOrderFilter] = useState<'all' | 'active' | 'history'>('all');

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
    },
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    // mode: 'onChange' — валидация на лету. Без него кнопка submit активна
    // даже при пустом или слабом пароле (RHF валидирует только на submit
    // по умолчанию), что вводит юзера в заблуждение.
    mode: 'onChange',
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });

  useEffect(() => {
    if (profile) {
      profileForm.reset({
        firstName: profile.firstName ?? '',
        lastName: profile.lastName ?? '',
        email: profile.email ?? '',
        phone: profile.phone ?? '',
      });
    }
  }, [profile, profileForm]);

  const orders = ordersData?.items ?? [];
  const stats = useMemo(() => {
    const active = orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length;
    const drafts = orders.filter((o) => DRAFT_STATUSES.includes(o.status)).length;
    const done = orders.filter((o) => HISTORY_STATUSES.includes(o.status)).length;
    const totalSpent = orders
      .filter((o) => o.status === 'DONE' || o.status === 'ACTIVE' || o.status === 'OVERDUE')
      .reduce((s, o) => s + o.totalAmount, 0);
    return { active, drafts, done, totalSpent };
  }, [orders]);

  const watchEmail = profileForm.watch('email');
  const isProfileDirty = profileForm.formState.isDirty;

  const nearestActiveRental = useMemo(() => {
    const active = orders.filter(
      (o) =>
        (o.status === 'ACTIVE' || o.status === 'OVERDUE' || o.status === 'CONFIRMED') && o.toDate,
    );
    if (active.length === 0) return null;
    active.sort((a, b) => new Date(a.toDate!).getTime() - new Date(b.toDate!).getTime());
    return active[0];
  }, [orders]);

  const onProfileSubmit = async (data: ProfileValues) => {
    if (data.email !== profile?.email) {
      const ok = window.confirm('Email используется для входа в аккаунт. Точно сменить?');
      if (!ok) return;
    }
    try {
      await updateProfile.mutateAsync({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
      });
      toast.success('Профиль обновлён');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось сохранить'));
    }
  };

  const onPasswordSubmit = async (data: PasswordValues) => {
    try {
      await changePassword.mutateAsync({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success('Пароль изменён. Войдите заново.');
      passwordForm.reset({ currentPassword: '', newPassword: '', confirm: '' });
      await logout();
      navigate('/login', { replace: true });
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось сменить пароль'));
    }
  };

  const copy = async (value: string, field: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      // ignore
    }
  };

  if (isLoading || !profile) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        <Loader2 className="size-6 animate-spin mx-auto text-blue" />
      </div>
    );
  }

  const fullName = profile.name || 'Без имени';
  const initials = initialsOf(fullName);
  const memberSince = profile.createdAt ? fmtDateLong(profile.createdAt) : null;
  const phone = profile.phone ?? '—';

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      {/* === IDENTITY HEADER === */}
      <header className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-start gap-4">
          <div
            className="shrink-0 size-16 rounded-2xl bg-blue text-white grid place-items-center font-display font-bold text-2xl"
            aria-hidden
          >
            {initials}
          </div>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-3xl truncate">{fullName}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {memberSince && <span className="text-sm text-text-3">с {memberSince}</span>}
            </div>
          </div>
        </div>
      </header>

      {/* === CONTACTS BAR === */}
      <section className="rounded-xl border bg-surface px-5 py-4 mb-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-sm">
        <ContactCell
          icon={<Mail className="size-4" />}
          label="Email"
          value={profile.email}
          onCopy={() => copy(profile.email, 'email')}
          copied={copiedField === 'email'}
        />
        {profile.phone && (
          <ContactCell
            icon={<Phone className="size-4" />}
            label="Телефон"
            value={formatRussianPhone(phone)}
            onCopy={() => copy(phone, 'phone')}
            copied={copiedField === 'phone'}
          />
        )}
      </section>

      {/* === ACTIVE RENTAL BANNER === только для клиентов */}
      {!isStaff && nearestActiveRental && <ActiveRentalBanner order={nearestActiveRental} />}

      {/* === STATS === только для клиентов: «Активных аренд», «Всего потрачено» — клиентские метрики */}
      {!isStaff && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard
            icon={<Package className="size-4" />}
            label="Активных аренд"
            value={stats.active}
          />
          <StatCard
            icon={<FileText className="size-4" />}
            label="Заявок на рассмотрении"
            value={stats.drafts}
          />
          <StatCard
            icon={<Check className="size-4" />}
            label="Завершено заказов"
            value={stats.done}
          />
          <StatCard
            icon={<UserIcon className="size-4" />}
            label="Всего потрачено"
            value={fmtRub(stats.totalSpent)}
            isString
          />
        </div>
      )}

      {/* === TABS === */}
      <Tabs value={activeTab} onValueChange={(v) => setTab(v as TabKey)} className="w-full">
        <nav className="flex gap-1 border-b -mx-1 px-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <UnderlineTab
            value="profile"
            active={activeTab === 'profile'}
            onClick={() => setTab('profile')}
            icon={<UserIcon className="size-4" />}
            label="Профиль"
          />
          {/* Вкладка «Мои заказы» — только для клиентов. Сотрудники сюда заходят
              через свой профиль, но клиентских заказов у них нет. */}
          {!isStaff && (
            <UnderlineTab
              value="orders"
              active={activeTab === 'orders'}
              onClick={() => setTab('orders')}
              icon={<ShoppingBag className="size-4" />}
              label="Мои заказы"
              count={orders.length}
            />
          )}
          <UnderlineTab
            value="security"
            active={activeTab === 'security'}
            onClick={() => setTab('security')}
            icon={<ShieldCheck className="size-4" />}
            label="Безопасность"
          />
        </nav>

        {/* --- ВКЛАДКА: ПРОФИЛЬ --- */}
        <TabsContent value="profile" className="mt-6 space-y-6">
          <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
            {/* Личные данные */}
            <section className="rounded-xl border bg-surface p-6">
              <header className="mb-4">
                <h2 className="font-display font-semibold text-lg">Личные данные</h2>
                <p className="text-text-3 text-xs mt-1">
                  Эти данные использует менеджер при оформлении и доставке.
                </p>
              </header>
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field
                    label="Имя"
                    htmlFor="prof-firstname"
                    icon={<UserIcon className="size-4" />}
                    error={profileForm.formState.errors.firstName?.message}
                  >
                    <Input
                      id="prof-firstname"
                      autoComplete="given-name"
                      placeholder="Иван"
                      {...profileForm.register('firstName', {
                        onChange: stripDigitsOnInput,
                        onBlur: (e) =>
                          normalizeNameOnBlur(e, (v) =>
                            profileForm.setValue('firstName', v, {
                              shouldDirty: true,
                              shouldValidate: true,
                            }),
                          ),
                      })}
                    />
                  </Field>
                  <Field
                    label="Фамилия"
                    htmlFor="prof-lastname"
                    icon={<IdCard className="size-4" />}
                    error={profileForm.formState.errors.lastName?.message}
                  >
                    <Input
                      id="prof-lastname"
                      autoComplete="family-name"
                      placeholder="Иванов"
                      {...profileForm.register('lastName', {
                        onChange: stripDigitsOnInput,
                        onBlur: (e) =>
                          normalizeNameOnBlur(e, (v) =>
                            profileForm.setValue('lastName', v, {
                              shouldDirty: true,
                              shouldValidate: true,
                            }),
                          ),
                      })}
                    />
                  </Field>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field
                    label="Email"
                    htmlFor="prof-email"
                    icon={<Mail className="size-4" />}
                    error={profileForm.formState.errors.email?.message}
                    hint={
                      watchEmail !== profile.email
                        ? 'Email используется для входа — после смены войдите с новым адресом.'
                        : undefined
                    }
                  >
                    <Input
                      id="prof-email"
                      type="email"
                      autoComplete="email"
                      {...profileForm.register('email')}
                    />
                  </Field>
                  <Field
                    label="Телефон"
                    htmlFor="prof-phone"
                    icon={<Phone className="size-4" />}
                    error={profileForm.formState.errors.phone?.message}
                  >
                    <PhoneInput
                      id="prof-phone"
                      value={profileForm.watch('phone') ?? ''}
                      onChange={(canonical) =>
                        profileForm.setValue('phone', canonical, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                    />
                  </Field>
                </div>
              </div>
            </section>

            {/* Sticky save bar */}
            <div
              className={cn(
                'sticky bottom-4 z-10 transition-all duration-200',
                isProfileDirty
                  ? 'opacity-100 translate-y-0'
                  : 'pointer-events-none opacity-0 translate-y-2',
              )}
            >
              <div className="rounded-xl border bg-surface shadow-lg p-3 flex items-center justify-between gap-3">
                <span className="text-sm text-text-2">Есть несохранённые изменения</span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => profileForm.reset()}
                    disabled={updateProfile.isPending}
                  >
                    Сбросить
                  </Button>
                  <Button type="submit" size="sm" disabled={updateProfile.isPending}>
                    {updateProfile.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Сохранить
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </TabsContent>

        {/* --- ВКЛАДКА: МОИ ЗАКАЗЫ --- */}
        <TabsContent value="orders" className="mt-6">
          <OrdersTabContent
            orders={orders}
            isLoading={ordersLoading}
            filter={orderFilter}
            onFilterChange={setOrderFilter}
          />
        </TabsContent>

        {/* --- ВКЛАДКА: БЕЗОПАСНОСТЬ --- */}
        <TabsContent value="security" className="mt-6 space-y-6">
          <section className="rounded-xl border bg-surface p-6">
            <header className="mb-4">
              <h2 className="font-display font-semibold text-lg">Смена пароля</h2>
              <p className="text-text-3 text-xs mt-1">
                После смены вас разлогинит на всех устройствах — потребуется войти заново.
              </p>
            </header>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
              <Field
                label="Текущий пароль"
                htmlFor="cur-pass"
                icon={<Lock className="size-4" />}
                error={passwordForm.formState.errors.currentPassword?.message}
                rightSlot={
                  <button
                    type="button"
                    onClick={() => setShowCurPass((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-text-3 hover:text-text"
                    aria-label={showCurPass ? 'Скрыть' : 'Показать'}
                  >
                    {showCurPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                }
              >
                <Input
                  id="cur-pass"
                  type={showCurPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="pr-10"
                  {...passwordForm.register('currentPassword')}
                />
              </Field>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field
                  label="Новый пароль"
                  htmlFor="new-pass"
                  icon={<Lock className="size-4" />}
                  error={passwordForm.formState.errors.newPassword?.message}
                  rightSlot={
                    <button
                      type="button"
                      onClick={() => setShowNewPass((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-text-3 hover:text-text"
                      aria-label={showNewPass ? 'Скрыть' : 'Показать'}
                    >
                      {showNewPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  }
                >
                  <Input
                    id="new-pass"
                    type={showNewPass ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="pr-10"
                    {...passwordForm.register('newPassword')}
                  />
                </Field>
                <Field
                  label="Повторите новый пароль"
                  htmlFor="conf-pass"
                  icon={<Lock className="size-4" />}
                  error={passwordForm.formState.errors.confirm?.message}
                >
                  <Input
                    id="conf-pass"
                    type={showNewPass ? 'text' : 'password'}
                    autoComplete="new-password"
                    {...passwordForm.register('confirm')}
                  />
                </Field>
              </div>
              <div className="pt-2 flex flex-wrap gap-3">
                <Button
                  type="submit"
                  disabled={changePassword.isPending || !passwordForm.formState.isValid}
                >
                  {changePassword.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-4" />
                  )}
                  Сменить пароль
                </Button>
                <Link
                  to="/forgot-password"
                  className="inline-flex items-center text-sm text-text-3 hover:text-blue px-3 py-2"
                >
                  Забыли текущий пароль?
                </Link>
              </div>
            </form>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ====================
// Локальные подкомпоненты
// ====================

function StatCard({
  icon,
  label,
  value,
  isString,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  isString?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-surface px-5 py-4">
      <div className="text-text-3 inline-flex items-center gap-1.5 text-xs uppercase tracking-wide">
        {icon}
        <span>{label}</span>
      </div>
      <div className={cn('font-display font-bold mt-2', isString ? 'text-xl' : 'text-2xl')}>
        {value}
      </div>
    </div>
  );
}

function UnderlineTab({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  value: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
        active ? 'border-blue text-blue' : 'border-transparent text-text-2 hover:text-text',
      )}
    >
      {icon}
      {label}
      {count != null && count > 0 && (
        <span className="rounded-full px-1.5 py-0 text-[10px] font-mono bg-surface-3 text-text-2">
          {count}
        </span>
      )}
    </button>
  );
}

function ContactCell({
  icon,
  label,
  value,
  onCopy,
  copied,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
}) {
  const content = (
    <>
      <span className="text-text-3 shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[11px] text-text-3 uppercase tracking-wide">{label}</span>
        <span className="block text-sm text-text truncate">{value}</span>
      </span>
      {onCopy &&
        (copied ? (
          <Check className="size-3.5 text-status-active ml-auto shrink-0" />
        ) : (
          <Copy className="size-3.5 text-text-4 ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        ))}
    </>
  );
  if (onCopy) {
    return (
      <button
        type="button"
        onClick={onCopy}
        className="group flex items-center gap-3 text-left min-w-0 hover:text-text transition-colors"
        title="Скопировать"
      >
        {content}
      </button>
    );
  }
  return <div className="flex items-center gap-3 min-w-0">{content}</div>;
}

function Field({
  label,
  htmlFor,
  icon,
  error,
  hint,
  rightSlot,
  children,
}: {
  label: string;
  htmlFor: string;
  icon: React.ReactNode;
  error?: string;
  hint?: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      <div className="relative mt-1.5">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3 pointer-events-none">
          {icon}
        </span>
        <div className="[&>input]:pl-10 [&>textarea]:pl-10">{children}</div>
        {rightSlot}
      </div>
      {error ? (
        <p className="text-xs text-status-overdue mt-1">{error}</p>
      ) : hint ? (
        <p className="text-xs text-text-3 mt-1">{hint}</p>
      ) : null}
    </div>
  );
}

function OrdersTabContent({
  orders,
  isLoading,
  filter,
  onFilterChange,
}: {
  orders: Order[];
  isLoading: boolean;
  filter: 'all' | 'active' | 'history';
  onFilterChange: (next: 'all' | 'active' | 'history') => void;
}) {
  const [search, setSearch] = useState('');
  const activeStatuses = ORDERS_FILTER_GROUPS.find((g) => g.key === filter)?.statuses;
  const byStatus = activeStatuses
    ? orders.filter((o) => activeStatuses.includes(o.status))
    : orders;
  const q = search.trim().toLowerCase();
  const filtered = q
    ? byStatus.filter((o) => {
        if (o.number.toLowerCase().includes(q)) return true;
        return (o.lines ?? []).some((l) => l.equipment?.name?.toLowerCase().includes(q));
      })
    : byStatus;

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-surface p-12 text-center text-text-3">
        <Loader2 className="size-5 animate-spin mx-auto mb-2" /> Загрузка…
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-xl border bg-surface p-12 text-center">
        <ShoppingBag className="size-12 text-text-4 mx-auto mb-3" />
        <h3 className="font-semibold">У вас пока нет заказов</h3>
        <p className="text-text-3 text-sm mt-2 max-w-sm mx-auto">
          Когда вы оформите аренду через витрину, заказы появятся здесь.
        </p>
        <Link
          to="/catalog"
          className="inline-flex items-center gap-1 mt-4 text-blue hover:underline text-sm font-medium"
        >
          Перейти в каталог <ChevronRight className="size-4" />
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {ORDERS_FILTER_GROUPS.map((g) => {
          const count = g.statuses
            ? orders.filter((o) => g.statuses!.includes(o.status)).length
            : orders.length;
          return (
            <button
              key={g.key}
              onClick={() => onFilterChange(g.key)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm border transition-colors inline-flex items-center gap-1.5',
                filter === g.key
                  ? 'bg-blue text-white border-blue'
                  : 'bg-surface text-text-2 border-border hover:bg-surface-2',
              )}
            >
              <span>{g.label}</span>
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold',
                  filter === g.key ? 'bg-white/20' : 'bg-surface-2 text-text-3',
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-3 pointer-events-none" />
          <Input
            type="search"
            placeholder="Номер заказа или оборудование"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-3 hover:text-text"
              aria-label="Очистить"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-surface p-10 text-center">
          <p className="text-text-3 text-sm">
            {q ? `Ничего не найдено по запросу «${search}».` : 'В этой категории пусто.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order: o }: { order: Order }) {
  const colors = ORDER_STATUS_COLORS[o.status];
  const fromStr = o.fromDate
    ? new Date(o.fromDate).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
    : null;
  const toStr = o.toDate
    ? new Date(o.toDate).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
    : null;
  const linesCount = o.lines?.length ?? o._count?.lines ?? 0;
  const previews = (o.lines ?? []).slice(0, 3);
  const firstNames = (o.lines ?? [])
    .slice(0, 2)
    .map((l) => l.equipment?.name)
    .filter(Boolean) as string[];

  // «Осталось N дней» для активных аренд
  let daysBadge: { text: string; tone: 'overdue' | 'soon' | 'normal' } | null = null;
  if ((o.status === 'ACTIVE' || o.status === 'CONFIRMED') && o.toDate) {
    const d = daysUntil(new Date(o.toDate));
    if (d <= 0) daysBadge = { text: 'возврат сегодня', tone: 'soon' };
    else if (d === 1) daysBadge = { text: 'завтра возврат', tone: 'soon' };
    else if (d <= 3) daysBadge = { text: `осталось ${d} дн.`, tone: 'soon' };
    else daysBadge = { text: `осталось ${d} дн.`, tone: 'normal' };
  } else if (o.status === 'OVERDUE' && o.toDate) {
    const d = -daysUntil(new Date(o.toDate));
    daysBadge = { text: `просрочка ${d} дн.`, tone: 'overdue' };
  }

  const firstPhoto = previews[0]
    ? (((previews[0].equipment?.photos ?? []) as string[])[0] ?? null)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border bg-surface hover:bg-surface-2 transition-colors"
    >
      <Link to={`/me/orders/${o.id}`} className="flex items-center gap-4 p-4">
        <div className="hidden sm:grid shrink-0 size-12 rounded-md bg-surface-2 overflow-hidden place-items-center">
          {firstPhoto ? (
            <img src={firstPhoto} alt="" className="w-full h-full object-cover" />
          ) : previews.length > 0 ? (
            <Package className="size-5 text-text-4" />
          ) : (
            <FileText className="size-5 text-text-4" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-semibold">{o.number}</span>
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-medium border',
                colors.bg,
                colors.text,
                colors.border,
              )}
            >
              {ORDER_STATUS_LABELS[o.status]}
            </span>
            {daysBadge && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[11px]',
                  daysBadge.tone === 'overdue' && 'text-status-overdue font-medium',
                  daysBadge.tone === 'soon' && 'text-amber-700 font-medium',
                  daysBadge.tone === 'normal' && 'text-text-3',
                )}
              >
                <CalendarClock className="size-3" />
                {daysBadge.text}
              </span>
            )}
          </div>
          <div className="text-sm text-text-2 mt-1 truncate">
            {firstNames.length > 0
              ? firstNames.join(', ') +
                (linesCount > firstNames.length ? ` и ещё ${linesCount - firstNames.length}` : '')
              : o.status === 'DRAFT'
                ? 'Заявка с витрины — менеджер скоро свяжется'
                : 'Без позиций'}
          </div>
          {fromStr && toStr && (
            <div className="text-xs text-text-3 mt-1">
              {fromStr} – {toStr}
            </div>
          )}
          {o.deliveryMethod === 'DELIVERY' && o.address && (
            <div className="text-xs text-text-3 mt-1 truncate" title={o.address}>
              📍 {o.address}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono font-semibold">{fmtRub(o.totalAmount)}</div>
          <div className="text-xs text-text-3 mt-1">
            {new Date(o.createdAt).toLocaleDateString('ru-RU')}
          </div>
        </div>
        <ChevronRight className="size-4 text-text-3 shrink-0" />
      </Link>
    </motion.div>
  );
}

// =====================
// Дополнительные секции профиля
// =====================

function ActiveRentalBanner({ order }: { order: Order }) {
  if (!order.toDate) return null;
  const d = daysUntil(new Date(order.toDate));
  const isOverdue = d < 0 || order.status === 'OVERDUE';
  const isSoon = !isOverdue && d <= 3;
  const subline = isOverdue
    ? `Просрочен возврат · ${-d} дн.`
    : d === 0
      ? 'Возврат сегодня'
      : d === 1
        ? 'Возврат завтра'
        : `Осталось ${d} дн.`;
  const dateStr = new Date(order.toDate).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
  });
  return (
    <div
      className={cn(
        'rounded-xl border bg-surface px-5 py-3.5 mb-4 flex items-center gap-4 flex-wrap',
        isOverdue && 'border-l-4 border-l-status-overdue',
        isSoon && 'border-l-4 border-l-amber-500',
      )}
    >
      <div
        className={cn(
          'shrink-0 size-9 rounded-md grid place-items-center bg-surface-2',
          isOverdue && 'text-status-overdue',
          isSoon && 'text-amber-600',
          !isOverdue && !isSoon && 'text-blue',
        )}
      >
        {isOverdue ? <AlertTriangle className="size-4" /> : <CalendarClock className="size-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm">
          <span className="text-text-3">Текущая аренда</span>{' '}
          <span className="font-mono font-semibold">{order.number}</span>
          <span className="text-text-3"> · возврат </span>
          <span className="font-medium">{dateStr}</span>
        </div>
        <div
          className={cn(
            'text-xs mt-0.5',
            isOverdue
              ? 'text-status-overdue font-medium'
              : isSoon
                ? 'text-amber-700'
                : 'text-text-3',
          )}
        >
          {subline}
        </div>
      </div>
      <Link
        to={`/me/orders/${order.id}`}
        className="text-sm font-medium text-blue hover:underline inline-flex items-center gap-1 shrink-0"
      >
        Подробности <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
