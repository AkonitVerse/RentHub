import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { IdCard, Loader2, Lock, Mail, Phone, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Logo } from '@/components/shared/Logo';
import { LegalDocDialog } from '@/components/shared/LegalDocDialog';
import { useAuthStore, landingPathForRole } from '@/lib/stores/auth-store';
import { useOrgContact } from '@/lib/hooks/queries';
import { apiErrorMessage } from '@/lib/api/client';
import { stripDigitsOnInput, normalizeNameOnBlur } from '@/lib/utils/name';
import type { User } from '@/lib/api/types';

const FALLBACK_BRAND = 'RentHub';

const loginSchema = z.object({
  email: z.string().min(1, 'Введите email').email('Некорректный email'),
  // На логине НЕ проверяем минимальную длину — это форма ВХОДА, а не регистрации.
  // Если у юзера пароль короче, чем сейчас требует регистрация (например, seed-админ
  // с паролем "admin" = 5 символов) — он всё равно должен мочь войти. Все строгие
  // проверки длины — только при создании или смене пароля.
  password: z.string().min(1, 'Введите пароль'),
});
type LoginValues = z.infer<typeof loginSchema>;

/**
 * Допустимые символы пароля: латинские буквы (a–z, A–Z), цифры и любые
 * не-буквенные печатные символы. Кириллица и пробелы запрещены.
 */
const PASSWORD_REGEX = /^[\x21-\x7E]+$/;

// Цифры в имени/фамилии запрещены — фильтр на уровне ввода физически их
// стрипает, схема — страховка на случай если что-то проскочит (autofill,
// программные изменения и т.п.).
const NO_DIGITS_REGEX = /^[^\d]+$/u;

const registerSchema = z
  .object({
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
    email: z.string().trim().min(1, 'Введите email').email('Неверный формат email'),
    phone: z.string().regex(/^\+7\d{10}$/, 'Введите телефон полностью'),
    // Минимум 6 символов, латиница/цифры/спецсимволы, без пробелов и кириллицы.
    // Любая комбинация символов допустима — синхронно с backend (register.dto.ts)
    // и страницей смены пароля в ЛК.
    password: z
      .string()
      .min(6, 'Минимум 6 символов')
      .max(200, 'Слишком длинный пароль')
      .regex(PASSWORD_REGEX, 'Только латиница, цифры и спец-символы (без пробелов и кириллицы)'),
    passwordConfirm: z.string().min(1, 'Повторите пароль'),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: 'Пароли не совпадают',
    path: ['passwordConfirm'],
  });
type RegisterValues = z.infer<typeof registerSchema>;

/**
 * Черновик регистрации — пробрасывается через router state на /verify-email,
 * чтобы при возврате юзер мог поправить email/телефон/etc без потери данных.
 * Лежит ТОЛЬКО в памяти роутера, не в URL и не в storage — пароль не светится.
 */
export type RegistrationDraft = RegisterValues;

interface LoginRouterState {
  /** Откуда юзер пришёл на /login (для возврата после успешного входа). */
  from?: string;
  /** Какой таб открыть при заходе. */
  openTab?: 'login' | 'register';
  /** Пред-заполнить форму регистрации (если возвращаемся с /verify-email). */
  registrationDraft?: RegistrationDraft;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const registerUser = useAuthStore((s) => s.register);
  const [isPending, setIsPending] = useState(false);
  // Состояние из роутера: откуда пришёл, какой таб открыть, есть ли черновик
  // регистрации для пред-заполнения. Считываем один раз на маунт.
  const routerState = (location.state as LoginRouterState | null) ?? {};
  const [tab, setTab] = useState<'login' | 'register'>(routerState.openTab ?? 'login');
  const [legalSlug, setLegalSlug] = useState<string | null>(null);
  const { data: orgContact } = useOrgContact();
  const brandName = orgContact?.orgShortName?.trim() || FALLBACK_BRAND;

  const requestedFrom = routerState.from;

  const redirectAfter = (user: User) => {
    if (requestedFrom) {
      navigate(requestedFrom, { replace: true });
      return;
    }
    navigate(landingPathForRole(user.role), { replace: true });
  };

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    // Если в state роутера лежит черновик (пришли с /verify-email обратно
    // через "Назад к регистрации") — поднимаем форму с ним. Иначе пусто.
    defaultValues: routerState.registrationDraft ?? {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      passwordConfirm: '',
    },
  });

  const onLogin = async (data: LoginValues) => {
    setIsPending(true);
    try {
      const me = await login(data.email, data.password);
      toast.success(`Добро пожаловать, ${me.name}!`);
      redirectAfter(me);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось войти'));
    } finally {
      setIsPending(false);
    }
  };

  const onRegister = async (data: RegisterValues) => {
    setIsPending(true);
    try {
      // Регистрация теперь не создаёт User в БД и не логинит — она создаёт
      // pending-запись и шлёт код подтверждения на email. Фронт ведёт юзера
      // на /verify-email, где он вводит код. После успеха User создаётся
      // и юзер сразу залогинен.
      const result = await registerUser({
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email,
        password: data.password,
        phone: data.phone,
      });
      if (result.requiresVerification) {
        toast.success('Код подтверждения отправлен на email');
        // Передаём черновик через router state — если юзер на /verify-email
        // решит вернуться править данные (например, заметит опечатку в email),
        // форма регистрации откроется уже заполненной.
        navigate(`/verify-email?email=${encodeURIComponent(result.email)}`, {
          state: { registrationDraft: data },
        });
        return;
      }
      // Legacy-путь — если бэк когда-нибудь будет возвращать готового юзера
      // без верификации (служебная регистрация). В публичном flow не вызывается.
      toast.success(`Регистрация успешна. Добро пожаловать, ${result.user.name}!`);
      redirectAfter(result.user);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось зарегистрироваться'));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="hidden lg:flex relative overflow-hidden items-center justify-center p-12"
        style={{
          // Радиальный градиент с эффектом виньетки: центр чуть светлее
          // (--color-blue-2 #1e293b), углы темнее (--color-blue #0f172a).
          // Даёт «перепад» — фокус на центральном контенте, периферия в тени.
          // Цвета те же что у CTA-кнопок витрины — единая дизайн-система.
          background:
            'radial-gradient(ellipse at center, var(--color-blue-2) 0%, var(--color-blue) 100%)',
        }}
      >
        {/*
          Декор фона в стиле витрины (HomePage hero) — но в тёмной инверсии,
          чтобы логин читался как «своя страница того же сайта», а не чужая.

          Использованы те же два приёма что в светлой версии на главной:
            1. Клеточная сетка 64×64 (тонкие линии).
            2. Точечная сетка 32×32 в одном углу (для текстурности).
          Обе с radial/linear-mask, чтобы исчезать к краям и не «душить»
          плотностью, как обои.

          Цвета — белые с очень низкой opacity (5–8%), потому что фон тёмный.
          Никаких grunge-штрихов и шумов — только чистая геометрия.
        */}
        {/* Сетка 64×64 — основной паттерн, слабее в углах через radial mask */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse 80% 70% at 30% 50%, black 30%, transparent 80%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 80% 70% at 30% 50%, black 30%, transparent 80%)',
          }}
        />
        {/* Точки 32×32 — лёгкая текстурность, видна по диагонали */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.07) 1px, transparent 0)',
            backgroundSize: '32px 32px',
            maskImage:
              'linear-gradient(to bottom right, transparent 30%, black 70%, transparent 95%)',
            WebkitMaskImage:
              'linear-gradient(to bottom right, transparent 30%, black 70%, transparent 95%)',
          }}
        />
        <div className="relative max-w-md text-white">
          <Link to="/" className="inline-flex items-center gap-4 mb-12">
            <div className="size-16 rounded-2xl bg-white/30 backdrop-blur-md ring-1 ring-white/40 grid place-items-center">
              <Logo className="size-12" />
            </div>
            <div>
              <div className="font-display font-bold text-3xl leading-tight">{brandName}</div>
              <div className="text-base opacity-80 mt-0.5">аренда оборудования</div>
            </div>
          </Link>
          <h2 className="font-display font-bold text-4xl mb-4 leading-tight">
            Аренда оборудования.
            <br />
            <span className="opacity-90">Просто, прозрачно, удобно.</span>
          </h2>
          <p className="text-white/80 text-lg leading-relaxed">
            Каталог онлайн, бронирование за пару минут, история заказов в личном кабинете.
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center justify-center p-6 lg:p-12 bg-bg"
      >
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <Logo className="size-11" />
              <div className="font-display font-bold text-2xl">{brandName}</div>
            </Link>
          </div>

          {/*
            min-h фиксирует высоту контейнера заголовка чтобы при переключении
            табов "Вход" / "Регистрация" нижняя форма не прыгала. Оба таба
            имеют подзаголовок, так что текст естественно занимает один и тот же
            вертикальный объём.
          */}
          <div className="min-h-[72px]">
            <h1 className="font-display font-bold text-2xl">
              {tab === 'login' ? 'Вход' : 'Регистрация'}
            </h1>
            <p className="text-text-2 text-sm mt-1">
              {tab === 'login'
                ? 'Введите почту и пароль вашего аккаунта'
                : 'Заведите аккаунт, чтобы оформлять и отслеживать заказы'}
            </p>
          </div>

          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as 'login' | 'register')}
            className="mt-6"
          >
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login">Вход</TabsTrigger>
              <TabsTrigger value="register">Регистрация</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <motion.form
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={loginForm.handleSubmit(onLogin)}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="login-email">Email</Label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-3" />
                    <Input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      className="pl-10"
                      {...loginForm.register('email')}
                    />
                  </div>
                  {loginForm.formState.errors.email && (
                    <p className="text-xs text-status-overdue mt-1">
                      {loginForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="login-password">Пароль</Label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-3" />
                    <Input
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      className="pl-10"
                      {...loginForm.register('password')}
                    />
                  </div>
                  {loginForm.formState.errors.password && (
                    <p className="text-xs text-status-overdue mt-1">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <Button type="submit" disabled={isPending} className="w-full" size="lg">
                  {isPending ? (
                    <>
                      <Loader2 className="animate-spin" /> Вход…
                    </>
                  ) : (
                    'Войти'
                  )}
                </Button>

                {/*
                  Без email-верификации (SMTP не настроен) сброс пароля шёл бы
                  без проверки владельца — это дыра в безопасности. Лучше
                  спрятать кнопку и направить юзера к админу за помощью,
                  чем предлагать ему небезопасный путь.
                */}
                {orgContact?.emailVerificationEnabled !== false && (
                  <div className="text-right -mt-2">
                    <Link to="/forgot-password" className="text-xs text-blue hover:underline">
                      Забыли пароль?
                    </Link>
                  </div>
                )}
              </motion.form>
            </TabsContent>

            <TabsContent value="register">
              <motion.form
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={registerForm.handleSubmit(onRegister)}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="reg-firstname">Имя *</Label>
                    <div className="relative mt-1.5">
                      <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-3" />
                      <Input
                        id="reg-firstname"
                        type="text"
                        autoComplete="given-name"
                        className="pl-10"
                        placeholder="Иван"
                        {...registerForm.register('firstName', {
                          onChange: stripDigitsOnInput,
                          onBlur: (e) =>
                            normalizeNameOnBlur(e, (v) =>
                              registerForm.setValue('firstName', v, {
                                shouldDirty: true,
                                shouldValidate: true,
                              }),
                            ),
                        })}
                      />
                    </div>
                    {registerForm.formState.errors.firstName && (
                      <p className="text-xs text-status-overdue mt-1">
                        {registerForm.formState.errors.firstName.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="reg-lastname">Фамилия *</Label>
                    <div className="relative mt-1.5">
                      <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-3" />
                      <Input
                        id="reg-lastname"
                        type="text"
                        autoComplete="family-name"
                        className="pl-10"
                        placeholder="Иванов"
                        {...registerForm.register('lastName', {
                          onChange: stripDigitsOnInput,
                          onBlur: (e) =>
                            normalizeNameOnBlur(e, (v) =>
                              registerForm.setValue('lastName', v, {
                                shouldDirty: true,
                                shouldValidate: true,
                              }),
                            ),
                        })}
                      />
                    </div>
                    {registerForm.formState.errors.lastName && (
                      <p className="text-xs text-status-overdue mt-1">
                        {registerForm.formState.errors.lastName.message}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="reg-email">Email *</Label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-3" />
                    <Input
                      id="reg-email"
                      type="email"
                      autoComplete="email"
                      className="pl-10"
                      placeholder="email@example.com"
                      {...registerForm.register('email')}
                    />
                  </div>
                  {registerForm.formState.errors.email && (
                    <p className="text-xs text-status-overdue mt-1">
                      {registerForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="reg-phone">Телефон *</Label>
                  <div className="relative mt-1.5">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-3 z-10" />
                    <PhoneInput
                      id="reg-phone"
                      className="pl-10"
                      value={registerForm.watch('phone') ?? ''}
                      onChange={(canonical) =>
                        registerForm.setValue('phone', canonical, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                    />
                  </div>
                  {registerForm.formState.errors.phone && (
                    <p className="text-xs text-status-overdue mt-1">
                      {registerForm.formState.errors.phone.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="reg-password">Пароль *</Label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-3" />
                    <Input
                      id="reg-password"
                      type="password"
                      autoComplete="new-password"
                      className="pl-10"
                      placeholder="не менее 6 символов"
                      {...registerForm.register('password')}
                    />
                  </div>
                  {registerForm.formState.errors.password ? (
                    <p className="text-xs text-status-overdue mt-1">
                      {registerForm.formState.errors.password.message}
                    </p>
                  ) : (
                    // text-xs (12px) — минимум по WCAG для helper-текста.
                    <p className="text-xs text-text-3 mt-1">
                      Английские буквы, цифры, спец-символы. Без кириллицы.
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="reg-password2">Повторите пароль *</Label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-3" />
                    <Input
                      id="reg-password2"
                      type="password"
                      autoComplete="new-password"
                      className="pl-10"
                      placeholder="повторите пароль"
                      {...registerForm.register('passwordConfirm')}
                    />
                  </div>
                  {registerForm.formState.errors.passwordConfirm && (
                    <p className="text-xs text-status-overdue mt-1">
                      {registerForm.formState.errors.passwordConfirm.message}
                    </p>
                  )}
                </div>

                <Button type="submit" disabled={isPending} className="w-full" size="lg">
                  {isPending ? (
                    <>
                      <Loader2 className="animate-spin" /> Регистрация…
                    </>
                  ) : (
                    'Зарегистрироваться'
                  )}
                </Button>

                <p className="text-xs text-text-3 text-center leading-relaxed">
                  Нажимая «Зарегистрироваться», вы принимаете{' '}
                  <button
                    type="button"
                    onClick={() => setLegalSlug('terms')}
                    className="text-blue hover:underline"
                  >
                    Условия использования
                  </button>{' '}
                  и даёте{' '}
                  <button
                    type="button"
                    onClick={() => setLegalSlug('personal-data')}
                    className="text-blue hover:underline"
                  >
                    Согласие на обработку персональных данных
                  </button>{' '}
                  в соответствии с{' '}
                  <button
                    type="button"
                    onClick={() => setLegalSlug('privacy')}
                    className="text-blue hover:underline"
                  >
                    Политикой обработки персональных данных
                  </button>
                  .
                </p>
              </motion.form>
            </TabsContent>
          </Tabs>

          <div className="mt-8 pt-6 border-t text-center text-sm text-text-3">
            <Link to="/" className="hover:text-text">
              ← Вернуться на главную
            </Link>
          </div>
        </div>
      </motion.div>

      <LegalDocDialog slug={legalSlug} onClose={() => setLegalSlug(null)} />
    </div>
  );
}
