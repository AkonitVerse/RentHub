import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, MailCheck, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/shared/Logo';
import { useAuthStore, landingPathForRole } from '@/lib/stores/auth-store';
import { useOrgContact } from '@/lib/hooks/queries';
import { apiErrorMessage, isApiError } from '@/lib/api/client';
import type { RegistrationDraft } from './LoginPage';

const FALLBACK_BRAND = 'RentHub';
const RESEND_COOLDOWN_SEC = 60;
/** TTL кода подтверждения. Должен совпадать с VERIFICATION_CODE_TTL_MIN на бэке. */
const CODE_TTL_SEC = 15 * 60;

/** Форматирует количество секунд в "MM:SS" для вывода таймера. */
function fmtMmSs(totalSec: number): string {
  const safe = Math.max(0, totalSec);
  const mm = String(Math.floor(safe / 60)).padStart(2, '0');
  const ss = String(safe % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * Страница ввода 6-значного кода подтверждения email.
 *
 * Flow:
 *  - Юзер пришёл сюда после регистрации (LoginPage → POST /auth/register).
 *  - На его email отправлен 6-значный код (TTL 15 мин).
 *  - Здесь он вводит код, бэк проверяет через POST /auth/verify-email.
 *  - При успехе создаётся User в БД, выдаётся JWT, переход на landing-страницу.
 *  - При истечении кода / ошибке — сообщение, кнопка «Отправить ещё раз»
 *    с таймером 60 сек.
 *
 * Email берётся из query-параметра ?email=... (передаёт LoginPage). Если
 * параметра нет — редирект на /login (юзер пришёл напрямую без регистрации).
 */
export function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const verifyEmail = useAuthStore((s) => s.verifyEmail);
  const resendVerification = useAuthStore((s) => s.resendVerification);
  const { data: orgContact } = useOrgContact();
  const brandName = orgContact?.orgShortName?.trim() || FALLBACK_BRAND;

  const email = params.get('email') ?? '';
  // Черновик регистрации, который пришёл из LoginPage. Если юзер захочет
  // вернуться "Назад к регистрации", прокинем его обратно — форма поднимется
  // в том же виде, в каком юзер её отправлял (можно поправить любую опечатку).
  const registrationDraft = (location.state as { registrationDraft?: RegistrationDraft } | null)
    ?.registrationDraft;

  const [code, setCode] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SEC);
  // Срок жизни кода. Локальный отсчёт от момента входа на страницу — бэк
  // источник истины (вернёт 410 если код реально истёк), но юзеру важно
  // видеть на UI сколько у него осталось времени. Сбрасывается при resend.
  const [codeTtlLeft, setCodeTtlLeft] = useState(CODE_TTL_SEC);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Если попал сюда без email в query — отправляем на регистрацию.
  useEffect(() => {
    if (!email) navigate('/login', { replace: true });
  }, [email, navigate]);

  // Автофокус на поле ввода кода.
  useEffect(() => {
    codeInputRef.current?.focus();
  }, []);

  // Таймер обратного отсчёта для resend.
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

  const onCodeChange = (value: string) => {
    // Только цифры, максимум 6.
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error('Введите 6 цифр кода');
      return;
    }
    setIsPending(true);
    try {
      const me = await verifyEmail(email, code);
      toast.success(`Email подтверждён. Добро пожаловать, ${me.name}!`);
      navigate(landingPathForRole(me.role), { replace: true });
    } catch (err) {
      // 410 Gone — pending удалён (исчерпание попыток / истёкший срок /
      // не найден). Юзеру нужно регистрироваться заново — редиректим на
      // /login через 2 секунды, чтобы он успел прочитать сообщение.
      if (isApiError(err) && err.response?.status === 410) {
        const message =
          (err.response?.data as { message?: string })?.message ||
          'Регистрация устарела. Пройдите регистрацию заново.';
        toast.error(message, { duration: 4000 });
        setCode('');
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 2000);
        return;
      }
      toast.error(apiErrorMessage(err, 'Не удалось подтвердить код'));
      setCode('');
      codeInputRef.current?.focus();
    } finally {
      setIsPending(false);
    }
  };

  const onResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await resendVerification(email);
      toast.success('Новый код отправлен на ваш email');
      setResendCooldown(RESEND_COOLDOWN_SEC);
      setCodeTtlLeft(CODE_TTL_SEC);
      setCode('');
      codeInputRef.current?.focus();
    } catch (err) {
      // 410 Gone — pending не найден / истёк → редирект на регистрацию.
      if (isApiError(err) && err.response?.status === 410) {
        const message =
          (err.response?.data as { message?: string })?.message ||
          'Регистрация устарела. Пройдите регистрацию заново.';
        toast.error(message, { duration: 4000 });
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 2000);
        return;
      }
      // 429 Too Many Requests — rate-limit. Берём retryAfter из body
      // и перезапускаем таймер на оставшееся время.
      if (isApiError(err) && err.response?.status === 429) {
        const data = err.response?.data as { message?: string; retryAfter?: number };
        const retryAfter = data?.retryAfter ?? RESEND_COOLDOWN_SEC;
        toast.error(data?.message || `Подождите ещё ${retryAfter} сек.`);
        setResendCooldown(retryAfter);
        return;
      }
      toast.error(apiErrorMessage(err, 'Не удалось отправить код'));
    }
  };

  if (!email) return null;

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* === ЛЕВАЯ ПАНЕЛЬ — тот же стиль что в LoginPage === */}
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
            Один шаг
            <br />
            <span className="opacity-90">до завершения регистрации.</span>
          </h2>
          <p className="text-white/80 text-lg leading-relaxed">
            Мы отправили 6-значный код на ваш email. Введите его, чтобы завершить регистрацию.
          </p>
        </div>
      </motion.div>

      {/* === ПРАВАЯ ПАНЕЛЬ — форма ввода кода === */}
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
            <MailCheck className="size-7" />
          </div>

          <h1 className="font-display font-bold text-2xl mb-2">Завершите регистрацию</h1>
          <p className="text-text-2 text-sm mb-6">
            Код подтверждения отправлен на вашу почту:{' '}
            <span className="font-medium text-text">{email}</span>
            <br />
            Если письмо не пришло — посмотрите в папке «Спам».
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="code">Код подтверждения</Label>
              <Input
                ref={codeInputRef}
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="••••••"
                value={code}
                onChange={(e) => onCodeChange(e.target.value)}
                // Когда таймер дошёл до 00:00 — блокируем поле, чтобы юзер не
                // вводил код в просроченное окно (бэк всё равно вернёт 410).
                disabled={codeTtlLeft <= 0}
                className="mt-1.5 text-center text-2xl font-mono tracking-[0.5em] h-14"
                maxLength={6}
              />
              {codeTtlLeft > 0 ? (
                <p className="text-xs text-text-3 mt-1.5">
                  Действителен ещё{' '}
                  <span className="font-mono font-medium text-text-2">{fmtMmSs(codeTtlLeft)}</span>
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
              // Сабмит блокируем дополнительно по истечении TTL — иначе юзер
              // нажмёт «Подтвердить», получит 410 и его выкинет на /login.
              disabled={isPending || code.length !== 6 || codeTtlLeft <= 0}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Подтвердить
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border space-y-3">
            <button
              type="button"
              onClick={onResend}
              disabled={resendCooldown > 0}
              className="w-full inline-flex items-center justify-center gap-2 text-sm text-text-2 hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCcw className="size-4" />
              {resendCooldown > 0
                ? `Отправить ещё раз через ${resendCooldown} сек`
                : 'Отправить код ещё раз'}
            </button>

            {/*
              Прокидываем openTab='register' чтобы LoginPage сразу открылся на
              нужной вкладке, и registrationDraft (если он у нас есть) — чтобы
              форма поднялась с теми же данными, которые юзер уже ввёл.
              На бэке его старый pending удалится при следующем submit —
              register() ищет совпадения по email/телефону и чистит дубль.
            */}
            <Link
              to="/login"
              state={{
                openTab: 'register',
                ...(registrationDraft && { registrationDraft }),
              }}
              className="w-full inline-flex items-center justify-center gap-2 text-sm text-text-3 hover:text-text-2"
            >
              <ArrowLeft className="size-4" />
              Назад к регистрации
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
