import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowLeft, KeyRound, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/shared/Logo';
import { useForgotPassword, useOrgContact } from '@/lib/hooks/queries';
import { apiErrorMessage } from '@/lib/api/client';

const FALLBACK_BRAND = 'RentHub';

const schema = z.object({
  email: z.string().min(1, 'Введите email').email('Некорректный email'),
});
type FormValues = z.infer<typeof schema>;

/**
 * Страница запроса кода восстановления пароля. Единый split-screen дизайн
 * с LoginPage / VerifyEmailPage / ResetPasswordPage.
 *
 * Flow:
 *  - Юзер вводит email от своего аккаунта.
 *  - Бэк (анти-enumeration) всегда возвращает 200, даже если такого аккаунта
 *    нет — поэтому в toast пишем нейтральное "если email зарегистрирован".
 *  - Дальше юзер ведёт на /reset-password?email=..., где вводит код.
 */
export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const forgot = useForgotPassword();
  const [isPending, setIsPending] = useState(false);
  const { data: orgContact } = useOrgContact();
  const brandName = orgContact?.orgShortName?.trim() || FALLBACK_BRAND;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  // Если email-верификация отключена (SMTP off) — закрываем доступ к странице
  // даже по прямому URL. Без этого юзер мог бы вбить /forgot-password в адресную
  // строку и попасть на сброс пароля без проверки владельца аккаунта.
  // Источник флага — публичный orgContact (грузится через React Query, на
  // первом рендере undefined — редирект делаем только когда данные пришли).
  useEffect(() => {
    if (orgContact && orgContact.emailVerificationEnabled === false) {
      toast.error('Восстановление пароля недоступно — Email верификация отключена');
      navigate('/login', { replace: true });
    }
  }, [orgContact, navigate]);

  const onSubmit = async (data: FormValues) => {
    setIsPending(true);
    try {
      await forgot.mutateAsync(data.email);
      // Сообщение и редирект зависят от того, настроен ли SMTP на платформе.
      // Если включена email-верификация — нужен код из письма (полный flow).
      // Если выключена — сразу на форму нового пароля без шага с кодом.
      const verificationOn = orgContact?.emailVerificationEnabled !== false;
      if (verificationOn) {
        toast.success('Если такой email зарегистрирован, мы отправили на него код');
        navigate(`/reset-password?email=${encodeURIComponent(data.email)}`, { replace: true });
      } else {
        toast.success('Установите новый пароль');
        navigate(`/reset-password?email=${encodeURIComponent(data.email)}&skipCode=1`, {
          replace: true,
        });
      }
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось отправить код'));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* === ЛЕВАЯ ПАНЕЛЬ — единый стиль === */}
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
            Забыли пароль?
            <br />
            <span className="opacity-90">Не страшно — восстановим.</span>
          </h2>
          {/*
            Подзаголовок про "6-значный код" актуален только когда SMTP настроен
            и реально отправляются письма. В bypass-режиме (без SMTP) скрываем —
            юзер сразу попадает на форму нового пароля без всяких кодов.
          */}
          {orgContact?.emailVerificationEnabled !== false && (
            <p className="text-white/80 text-lg leading-relaxed">
              Введите email от аккаунта — мы отправим на него 6-значный код для смены пароля.
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
            <KeyRound className="size-7" />
          </div>

          {/*
            Когда подпись скрыта (bypass-режим без SMTP) — увеличиваем нижний
            отступ заголовка, чтобы расстояние до формы оставалось привычным.
          */}
          {orgContact?.emailVerificationEnabled !== false ? (
            <>
              <h1 className="font-display font-bold text-2xl mb-2">Восстановить пароль</h1>
              <p className="text-text-2 text-sm mb-6">
                Введите email вашего аккаунта — на него придёт код подтверждения.
              </p>
            </>
          ) : (
            <h1 className="font-display font-bold text-2xl mb-6">Восстановить пароль</h1>
          )}

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-3" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="pl-10"
                  placeholder="email@example.com"
                  {...form.register('email')}
                />
              </div>
              {form.formState.errors.email && (
                <p className="text-xs text-status-overdue mt-1">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <Button type="submit" disabled={isPending} className="w-full h-11">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {orgContact?.emailVerificationEnabled !== false ? 'Отправить код' : 'Продолжить'}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <Link
              to="/login"
              className="w-full inline-flex items-center justify-center gap-2 text-sm text-text-3 hover:text-text-2"
            >
              <ArrowLeft className="size-4" />
              Назад к авторизации
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
