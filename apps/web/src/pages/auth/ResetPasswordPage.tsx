import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowLeft, KeyRound, Loader2, Lock, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/shared/Logo';
import { useForgotPassword, useResetPassword, useVerifyResetCode } from '@/lib/hooks/queries';
import { useOrgContact } from '@/lib/hooks/queries';
import { apiErrorMessage, isApiError } from '@/lib/api/client';

const FALLBACK_BRAND = 'RentHub';
const RESEND_COOLDOWN_SEC = 60;
/** TTL кода. Должен совпадать с RESET_CODE_TTL_MIN на бэке. */
const CODE_TTL_SEC = 15 * 60;

/** Форматирует количество секунд в "MM:SS" для вывода таймера. */
function fmtMmSs(totalSec: number): string {
  const safe = Math.max(0, totalSec);
  const mm = String(Math.floor(safe / 60)).padStart(2, '0');
  const ss = String(safe % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

const codeSchema = z.object({
  email: z.string().email('Некорректный email'),
  code: z.string().regex(/^\d{6}$/, 'Введите 6 цифр'),
});
type CodeValues = z.infer<typeof codeSchema>;

// Минимум 6 символов, латиница/цифры/спецсимволы, без пробелов и кириллицы.
// Любая комбинация символов допустима — синхронно с backend и регистрацией.
const PASSWORD_REGEX = /^[\x21-\x7E]+$/;
const passwordSchema = z
  .object({
    newPassword: z
      .string()
      .min(6, 'Минимум 6 символов')
      .max(200, 'Слишком длинный пароль')
      .regex(PASSWORD_REGEX, 'Только латиница, цифры и спец-символы (без пробелов и кириллицы)'),
    confirm: z.string(),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: 'Пароли не совпадают',
    path: ['confirm'],
  });
type PasswordValues = z.infer<typeof passwordSchema>;

type Step = 'code' | 'password';

/**
 * Страница сброса пароля. Единый split-screen дизайн с LoginPage / VerifyEmailPage.
 *
 * Flow:
 *  - Юзер пришёл с /forgot-password (где ввёл email) с query ?email=...
 *  - Шаг 1 (code): вводит 6-значный код из письма. Email pre-filled и readonly,
 *    есть таймер обратного отсчёта 15 мин и кнопка resend с cooldown 60 сек.
 *  - При успешной верификации → шаг 2 (password): новый пароль + подтверждение.
 *  - При 410 Gone (исчерпаны попытки / истёк код) — toast и редирект на
 *    /forgot-password через 2 сек.
 *
 * Если попал сюда без email в query — редирект на /forgot-password.
 */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const verify = useVerifyResetCode();
  const reset = useResetPassword();
  const forgot = useForgotPassword();
  const { data: orgContact } = useOrgContact();
  const brandName = orgContact?.orgShortName?.trim() || FALLBACK_BRAND;

  const queryEmail = params.get('email') ?? '';
  // skipCode=1 в URL → bypass-режим (SMTP не настроен), фронт сразу открывает
  // шаг с новым паролем без проверки кода. Параметр выставляет ForgotPasswordPage
  // когда видит emailVerificationEnabled=false.
  const skipCode = params.get('skipCode') === '1';

  const [step, setStep] = useState<Step>(skipCode ? 'password' : 'code');
  const [emailLocked, setEmailLocked] = useState(skipCode ? queryEmail : '');
  const [codeLocked, setCodeLocked] = useState('');
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SEC);
  const [codeTtlLeft, setCodeTtlLeft] = useState(CODE_TTL_SEC);
  const codeInputRef = useRef<HTMLInputElement>(null);

  const codeForm = useForm<CodeValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { email: queryEmail, code: '' },
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { newPassword: '', confirm: '' },
  });

  // Если зашёл напрямую без email — отправляем на форму запроса.
  useEffect(() => {
    if (!queryEmail) navigate('/forgot-password', { replace: true });
  }, [queryEmail, navigate]);

  // Если email-верификация отключена на платформе (SMTP off) — закрываем
  // доступ даже по прямому URL. Без этого можно было бы напрямую вбить
  // /reset-password?email=victim@x.com&skipCode=1 и сменить пароль чужому
  // аккаунту. Восстановление в bypass-режиме отрезаем целиком; если юзеру
  // действительно нужно сбросить пароль — обращается к админу.
  useEffect(() => {
    if (orgContact && orgContact.emailVerificationEnabled === false) {
      toast.error('Восстановление пароля недоступно — Email верификация отключена');
      navigate('/login', { replace: true });
    }
  }, [orgContact, navigate]);

  // Автофокус на поле ввода кода на шаге 1.
  useEffect(() => {
    if (step === 'code') codeInputRef.current?.focus();
  }, [step]);

  // Таймер cooldown'а кнопки "Отправить код ещё раз".
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Таймер срока действия самого кода (15 минут).
  useEffect(() => {
    if (codeTtlLeft <= 0) return;
    const t = setTimeout(() => setCodeTtlLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [codeTtlLeft]);

  // 410 Gone — терминальная ошибка кода. Юзеру нужно заново через
  // /forgot-password, перебрасываем туда через 2 сек.
  const handleGone = (err: unknown, fallback: string): boolean => {
    if (isApiError(err) && err.response?.status === 410) {
      const message = (err.response?.data as { message?: string })?.message || fallback;
      toast.error(message, { duration: 4000 });
      setTimeout(() => {
        navigate('/forgot-password', { replace: true });
      }, 2000);
      return true;
    }
    return false;
  };

  const onVerify = async (data: CodeValues) => {
    try {
      await verify.mutateAsync({ email: data.email, code: data.code });
      setEmailLocked(data.email);
      setCodeLocked(data.code);
      setStep('password');
    } catch (e) {
      if (handleGone(e, 'Срок действия кода истёк. Запросите новый.')) return;
      toast.error(apiErrorMessage(e, 'Неверный код'));
      codeForm.setValue('code', '');
      codeInputRef.current?.focus();
    }
  };

  const onResetSubmit = async (data: PasswordValues) => {
    try {
      await reset.mutateAsync({
        email: emailLocked,
        code: codeLocked,
        newPassword: data.newPassword,
      });
      toast.success('Пароль обновлён. Войдите с новым паролем.');
      navigate('/login', { replace: true });
    } catch (e) {
      if (handleGone(e, 'Срок действия кода истёк. Запросите новый.')) return;
      toast.error(apiErrorMessage(e, 'Не удалось установить пароль'));
    }
  };

  const onResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await forgot.mutateAsync(queryEmail);
      // forgotPassword на бэке always-200 (анти-enumeration), поэтому
      // сообщение нейтральное — мы не подтверждаем существование аккаунта.
      toast.success('Если email зарегистрирован, новый код отправлен');
      setResendCooldown(RESEND_COOLDOWN_SEC);
      setCodeTtlLeft(CODE_TTL_SEC);
      codeForm.setValue('code', '');
      codeInputRef.current?.focus();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось отправить код'));
    }
  };

  if (!queryEmail) return null;

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* === ЛЕВАЯ ПАНЕЛЬ — единый стиль с LoginPage / VerifyEmailPage === */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="hidden lg:flex relative overflow-hidden items-center justify-center p-12"
        style={{
          background:
            'radial-gradient(ellipse at center, var(--color-blue-2) 0%, var(--color-blue) 100%)',
        }}
      >
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
            {step === 'code' ? (
              <>
                Восстановим
                <br />
                <span className="opacity-90">доступ к аккаунту.</span>
              </>
            ) : (
              <>
                Почти готово —
                <br />
                <span className="opacity-90">придумайте новый пароль.</span>
              </>
            )}
          </h2>
          {step === 'code' && (
            <p className="text-white/80 text-lg leading-relaxed">
              Мы отправили 6-значный код на ваш email. Введите его, чтобы продолжить.
            </p>
          )}
        </div>
      </motion.div>

      {/* === ПРАВАЯ ПАНЕЛЬ — форма === */}
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

          <div className="mb-6 inline-flex items-center justify-center size-14 rounded-2xl bg-blue/5 text-blue">
            {step === 'code' ? <KeyRound className="size-7" /> : <Lock className="size-7" />}
          </div>

          <h1 className="font-display font-bold text-2xl mb-2">
            {step === 'code' ? 'Подтверждение' : 'Сброс пароля'}
          </h1>
          <p className="text-text-2 text-sm mb-6">
            {step === 'code' ? (
              <>
                Код отправлен на вашу почту:{' '}
                <span className="font-medium text-text">{queryEmail}</span>
                <br />
                Если письмо не пришло — посмотрите в папке «Спам».
              </>
            ) : (
              'Придумайте новый пароль для входа в аккаунт.'
            )}
          </p>

          {step === 'code' ? (
            <>
              <form onSubmit={codeForm.handleSubmit(onVerify)} className="space-y-4">
                <div>
                  <Label htmlFor="code">Код подтверждения</Label>
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="••••••"
                    maxLength={6}
                    // Блокируем поле когда таймер дошёл до 0 — иначе юзер
                    // вводит код в просроченное окно и получит 410 Gone.
                    disabled={codeTtlLeft <= 0}
                    className="mt-1.5 text-center text-2xl font-mono tracking-[0.5em] h-14"
                    {...codeForm.register('code')}
                    ref={(el) => {
                      codeForm.register('code').ref(el);
                      (codeInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
                    }}
                  />
                  {codeForm.formState.errors.code ? (
                    <p className="text-xs text-status-overdue mt-1.5">
                      {codeForm.formState.errors.code.message}
                    </p>
                  ) : codeTtlLeft > 0 ? (
                    <p className="text-xs text-text-3 mt-1.5">
                      Действителен ещё{' '}
                      <span className="font-mono font-medium text-text-2">
                        {fmtMmSs(codeTtlLeft)}
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-status-overdue mt-1.5">
                      Срок действия истёк — запросите новый код ниже
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-11"
                  disabled={verify.isPending || codeTtlLeft <= 0}
                >
                  {verify.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Подтвердить
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t border-border space-y-3">
                <button
                  type="button"
                  onClick={onResend}
                  disabled={resendCooldown > 0 || forgot.isPending}
                  className="w-full inline-flex items-center justify-center gap-2 text-sm text-text-2 hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCcw className="size-4" />
                  {resendCooldown > 0
                    ? `Отправить ещё раз через ${resendCooldown} сек`
                    : 'Отправить код ещё раз'}
                </button>

                <Link
                  to="/login"
                  className="w-full inline-flex items-center justify-center gap-2 text-sm text-text-3 hover:text-text-2"
                >
                  <ArrowLeft className="size-4" />
                  Назад к авторизации
                </Link>
              </div>
            </>
          ) : (
            <form onSubmit={passwordForm.handleSubmit(onResetSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="np">Новый пароль</Label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-3" />
                  <Input
                    id="np"
                    type="password"
                    autoComplete="new-password"
                    className="pl-10"
                    placeholder="не менее 6 символов"
                    {...passwordForm.register('newPassword')}
                  />
                </div>
                {passwordForm.formState.errors.newPassword ? (
                  <p className="text-xs text-status-overdue mt-1">
                    {passwordForm.formState.errors.newPassword.message}
                  </p>
                ) : (
                  // Симметрично с регистрацией — юзер сразу видит правила.
                  <p className="text-xs text-text-3 mt-1">
                    Английские буквы, цифры, спец-символы. Без кириллицы.
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="cf">Повторите новый пароль</Label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-3" />
                  <Input
                    id="cf"
                    type="password"
                    autoComplete="new-password"
                    className="pl-10"
                    placeholder="повторите пароль"
                    {...passwordForm.register('confirm')}
                  />
                </div>
                {passwordForm.formState.errors.confirm && (
                  <p className="text-xs text-status-overdue mt-1">
                    {passwordForm.formState.errors.confirm.message}
                  </p>
                )}
              </div>

              <Button type="submit" disabled={reset.isPending} className="w-full h-11">
                {reset.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Подтвердить
              </Button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
