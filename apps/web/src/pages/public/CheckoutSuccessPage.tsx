import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, ChevronRight, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useOrgContact } from '@/lib/hooks/queries';
import { formatPhoneInput } from '@/lib/utils/phone';

export function CheckoutSuccessPage() {
  const [params] = useSearchParams();
  const orderNumber = params.get('orderNumber') ?? '—';
  const orderId = params.get('orderId');
  const isInquiry = params.get('inquiry') === '1';
  const user = useAuthStore((s) => s.user);
  const { data: orgContact } = useOrgContact();
  const phoneFormatted = orgContact?.orgPhone ? formatPhoneInput(orgContact.orgPhone).trim() : '';

  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 180 }}
        className="size-20 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mx-auto mb-6"
      >
        <CheckCircle2 className="size-10" />
      </motion.div>

      <h1 className="font-display font-bold text-3xl">
        {isInquiry ? 'Заявка отправлена!' : 'Заказ оформлен!'}
      </h1>
      <p className="text-text-2 mt-3 text-base">
        {isInquiry ? (
          <>
            Менеджер свяжется с вами в течение 30 минут для уточнения деталей и подбора
            оборудования.
          </>
        ) : (
          <>
            Номер заказа: <span className="font-mono font-semibold text-text">{orderNumber}</span>
            <br />
            Менеджер свяжется в течение 30 минут для подтверждения и согласования выдачи.
          </>
        )}
      </p>

      <div className="mt-10 space-y-3">
        {user && orderId && !isInquiry && (
          <Button asChild size="lg" className="w-full">
            <Link to={`/me/orders/${orderId}`}>
              Перейти к заказу <ChevronRight className="size-4" />
            </Link>
          </Button>
        )}
        {user && (
          <Button asChild size="lg" variant="outline" className="w-full">
            <Link to="/me/profile?tab=orders">Все мои заказы</Link>
          </Button>
        )}
        <Button asChild size="lg" variant="outline" className="w-full">
          <Link to="/catalog">Вернуться в каталог</Link>
        </Button>
      </div>

      {!user && (
        <div className="mt-8 rounded-xl border bg-blue-soft p-5 text-sm">
          <p className="font-medium">Хотите видеть статус заказа онлайн?</p>
          <p className="text-text-3 mt-1">
            Зарегистрируйтесь — мы свяжем ваши прошлые и будущие заказы с аккаунтом по номеру
            телефона.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link to="/login">Создать аккаунт</Link>
          </Button>
        </div>
      )}

      {phoneFormatted && (
        <p className="text-xs text-text-3 mt-10 flex items-center justify-center gap-1.5">
          <Phone className="size-3.5" />
          <a href={`tel:${orgContact?.orgPhone ?? ''}`} className="hover:text-text">
            {phoneFormatted}
          </a>{' '}
          — если что-то срочное
        </p>
      )}
    </div>
  );
}
