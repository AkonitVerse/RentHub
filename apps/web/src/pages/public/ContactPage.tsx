import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Mail,
  MessageSquare,
  Phone,
  MapPin,
  Loader2,
  ShoppingBag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  useCart,
  useCheckout,
  useCreateInquiry,
  useEquipment,
  useOrgContact,
} from '@/lib/hooks/queries';
import { useAuthStore } from '@/lib/stores/auth-store';
import { fmtRub } from '@/lib/utils/format';
import { formatPhoneInput } from '@/lib/utils/phone';
import { apiErrorMessage } from '@/lib/api/client';

const schema = z.object({
  name: z.string().min(2, 'Введите имя'),
  phone: z.string().regex(/^\+7\d{10}$/, 'Введите телефон полностью: +7 (XXX) XXX-XX-XX'),
  email: z.string().email('Некорректный email').optional().or(z.literal('')),
  address: z.string().optional(),
  deliveryMethod: z.enum(['PICKUP', 'DELIVERY']),
  message: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function ContactPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const equipmentId = params.get('equipmentId') ? Number(params.get('equipmentId')) : undefined;
  const { data: equipment } = useEquipment(equipmentId);
  const { data: cart } = useCart();

  const createInquiry = useCreateInquiry();
  const checkout = useCheckout();
  const { data: orgContact } = useOrgContact();
  const [submitted, setSubmitted] = useState(false);

  const orgPhoneFormatted = orgContact?.orgPhone
    ? formatPhoneInput(orgContact.orgPhone).trim()
    : '';
  const orgEmail = orgContact?.orgEmail?.trim() ?? '';
  const orgAddress = orgContact?.orgAddress?.trim() ?? '';
  const orgHours = orgContact?.orgHours?.trim() ?? '';
  const hasAnyContact = !!(orgPhoneFormatted || orgEmail || orgAddress);

  const cartHasLines = (cart?.lines.length ?? 0) > 0;
  const currentUser = useAuthStore((s) => s.user);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      deliveryMethod: 'PICKUP',
      // Автоподстановка контактных данных из профиля залогиненного пользователя.
      // Это снимает риск рассинхрона: User.phone и Order.contactPhone совпадают.
      name: currentUser?.name ?? '',
      phone: currentUser?.phone ?? '',
      email: currentUser?.email ?? '',
    },
  });

  // Когда пользователь залогинится после открытия страницы — подтянуть данные.
  useEffect(() => {
    if (currentUser) {
      if (currentUser.name) setValue('name', currentUser.name);
      if (currentUser.phone) setValue('phone', currentUser.phone);
      if (currentUser.email) setValue('email', currentUser.email);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const onSubmit = async (data: FormValues) => {
    try {
      if (cartHasLines) {
        if (cart?.hasIssues) {
          toast.error(
            'Есть проблемы с доступностью или ценами в корзине. Откройте корзину и проверьте.',
          );
          return;
        }
        const result = await checkout.mutateAsync({
          clientData: {
            name: data.name,
            phone: data.phone,
            email: data.email || undefined,
          },
          deliveryMethod: data.deliveryMethod,
          // Адрес доставки → Order.address (адрес конкретного заказа).
          // У Client нет своего адреса — только контакты (имя/телефон/email).
          address: data.address || undefined,
          contactPhone: data.phone,
          contactEmail: data.email || undefined,
          notes: data.message || undefined,
        });
        toast.success(`Заказ ${result.orderNumber} оформлен`);
        reset();
        navigate(`/checkout/success?orderId=${result.orderId}&orderNumber=${result.orderNumber}`);
        return;
      }

      // Инквайри-заявка с витрины (создаёт DRAFT-заказ)
      await createInquiry.mutateAsync({
        name: data.name,
        phone: data.phone,
        email: data.email || undefined,
        equipmentId,
        message:
          [data.message, equipment ? `Интересует: ${equipment.name}` : '']
            .filter(Boolean)
            .join('\n') || undefined,
      });
      toast.success('Заявка отправлена');
      reset();
      navigate('/checkout/success?inquiry=1');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось отправить'));
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring' }}
          className="size-16 rounded-full bg-status-active-bg text-status-active grid place-items-center mx-auto mb-6"
        >
          <CheckCircle2 className="size-8" />
        </motion.div>
        <h1 className="font-display font-bold text-3xl">Спасибо!</h1>
        <p className="text-text-2 mt-3">
          Ваша заявка получена. Менеджер свяжется в течение 30 минут.
        </p>
        <div className="mt-6 flex gap-3 justify-center">
          <Button onClick={() => setSubmitted(false)}>Отправить ещё одну</Button>
          <Button variant="outline" onClick={() => navigate('/catalog')}>
            К каталогу
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title={cartHasLines ? 'Оформление заказа' : 'Запрос на аренду'}
        description={
          cartHasLines
            ? 'Контакты для подтверждения и доставки. После оформления свяжемся с вами.'
            : 'Заполните форму — менеджер свяжется в течение 30 минут.'
        }
      />

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <motion.form
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onSubmit={handleSubmit(onSubmit)}
          className="rounded-xl border bg-surface p-6 space-y-4"
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Имя *</Label>
              <Input id="name" {...register('name')} placeholder="Иван Иванов" className="mt-1.5" />
              {errors.name && (
                <p className="text-xs text-status-overdue mt-1">{errors.name.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="phone">Телефон *</Label>
              <PhoneInput
                id="phone"
                value={watch('phone') ?? ''}
                onChange={(canonical) =>
                  setValue('phone', canonical, { shouldDirty: true, shouldValidate: true })
                }
                className="mt-1.5"
              />
              {errors.phone && (
                <p className="text-xs text-status-overdue mt-1">{errors.phone.message}</p>
              )}
            </div>
          </div>
          <div>
            <Label htmlFor="email">Email (необязательно)</Label>
            <Input
              id="email"
              {...register('email')}
              placeholder="email@example.com"
              type="email"
              className="mt-1.5"
            />
            {errors.email && (
              <p className="text-xs text-status-overdue mt-1">{errors.email.message}</p>
            )}
          </div>

          {cartHasLines && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Способ получения</Label>
                <Select
                  value={watch('deliveryMethod')}
                  onValueChange={(v) =>
                    setValue('deliveryMethod', v as 'PICKUP' | 'DELIVERY', {
                      shouldValidate: true,
                    })
                  }
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
                <Label htmlFor="address">Адрес доставки</Label>
                <Input
                  id="address"
                  {...register('address')}
                  placeholder="Если выбрана доставка"
                  className="mt-1.5"
                />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="message">Комментарий</Label>
            <Textarea
              id="message"
              {...register('message')}
              rows={4}
              placeholder="Когда нужно, на сколько, особые требования…"
              className="mt-1.5"
            />
          </div>

          {equipment && !cartHasLines && (
            <div className="rounded-lg bg-blue-soft p-3 text-sm">
              <div className="text-text-3 text-xs">Запрос по оборудованию</div>
              <div className="font-semibold mt-1">{equipment.name}</div>
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={
              createInquiry.isPending || checkout.isPending || (cartHasLines && cart?.hasIssues)
            }
            className="w-full"
          >
            {createInquiry.isPending || checkout.isPending ? (
              <Loader2 className="animate-spin size-4" />
            ) : cartHasLines ? (
              <ShoppingBag className="size-4" />
            ) : (
              <MessageSquare className="size-4" />
            )}
            {cartHasLines ? 'Оформить заказ' : 'Отправить заявку'}
          </Button>
          {cartHasLines && cart?.hasIssues && (
            <p className="text-xs text-status-overdue text-center">
              В корзине есть позиции, недоступные на выбранные даты. Откройте корзину и проверьте
              отметки доступности.
            </p>
          )}
          <p className="text-xs text-text-3 text-center">
            Нажимая «{cartHasLines ? 'Оформить' : 'Отправить'}», вы соглашаетесь с обработкой
            персональных данных
          </p>
        </motion.form>

        <div className="space-y-4">
          {cartHasLines && cart && (
            <div className="rounded-xl border bg-surface p-5">
              <h3 className="font-semibold mb-3">
                В заявке ({cart.totalQty} {cart.totalQty === 1 ? 'единица' : 'единиц'})
              </h3>
              <ul className="divide-y">
                {cart.lines.map((line, idx) => {
                  const fromStr = new Date(line.fromDate).toLocaleDateString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                  });
                  const toStr = new Date(line.toDate).toLocaleDateString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                  });
                  return (
                    <li key={`${line.catalogItemId}-${idx}`} className="py-3">
                      <div className="text-sm font-medium">{line.name}</div>
                      <div className="text-xs text-text-3">
                        {fromStr} – {toStr} • {line.qty} × {line.days} сут ×{' '}
                        {fmtRub(line.unitPriceNet)}
                      </div>
                      {!line.available && (
                        <div className="text-xs text-status-overdue mt-1">
                          ⚠ Свободно {line.freeQty} из {line.qty}
                        </div>
                      )}
                      <div className="text-xs font-medium mt-1 text-right">
                        {fmtRub(line.sumAmount)}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t mt-3 pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-text-3">Сумма аренды</span>
                  <span className="font-display font-bold price">{fmtRub(cart.totalAmount)}</span>
                </div>
                {cart.totalDeposit > 0 && (
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-text-3">Залоги</span>
                    <span className="font-mono">{fmtRub(cart.totalDeposit)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {hasAnyContact ? (
            <div className="rounded-xl border bg-surface p-5 space-y-3">
              <h3 className="font-semibold">Контакты</h3>
              {orgPhoneFormatted && (
                <div className="flex items-start gap-3 text-sm">
                  <Phone className="size-4 text-text-3 mt-0.5" />
                  <div>
                    <a
                      href={`tel:${orgContact?.orgPhone ?? ''}`}
                      className="font-medium hover:text-blue"
                    >
                      {orgPhoneFormatted}
                    </a>
                    {orgHours && (
                      <div className="text-text-3 text-xs whitespace-pre-line">{orgHours}</div>
                    )}
                  </div>
                </div>
              )}
              {orgEmail && (
                <div className="flex items-start gap-3 text-sm">
                  <Mail className="size-4 text-text-3 mt-0.5" />
                  <a href={`mailto:${orgEmail}`} className="font-medium break-all hover:text-blue">
                    {orgEmail}
                  </a>
                </div>
              )}
              {orgAddress && (
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="size-4 text-text-3 mt-0.5" />
                  <div className="font-medium leading-snug whitespace-pre-line">{orgAddress}</div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
