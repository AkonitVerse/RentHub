import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  Mail,
  ShoppingBag,
  User as UserIcon,
  Plus,
  Copy,
  ExternalLink,
  Building2,
  MapPin,
  FileText,
  Landmark,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { OrderStatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { useClient } from '@/lib/hooks/queries';
import { fmtRub, fmtDate, fmtPhone, fmtDateTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

type ClientTab = 'profile' | 'orders';

const TABS: { value: ClientTab; label: string; Icon: typeof UserIcon }[] = [
  { value: 'profile', label: 'Профиль', Icon: UserIcon },
  { value: 'orders', label: 'Заказы', Icon: ShoppingBag },
];

export function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: client, isLoading } = useClient(Number(id));
  const [tab, setTab] = useState<ClientTab>('profile');

  if (isLoading) return <Skeleton className="h-96" />;
  if (!client) return <div className="text-center py-20">Клиент не найден</div>;

  const isCompany = client.clientType === 'COMPANY';

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/admin/customers')}
        className="mb-4"
      >
        <ArrowLeft className="size-4" /> К списку
      </Button>

      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'size-16 rounded-2xl text-white grid place-items-center font-display font-bold text-2xl',
              isCompany ? 'bg-amber-500' : 'bg-blue',
            )}
          >
            {isCompany ? (
              <Building2 className="size-8" />
            ) : (
              client.name
                .split(' ')
                .map((p) => p[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-bold text-3xl">{client.name}</h1>
              <Badge variant={isCompany ? 'outline' : 'secondary'} className="text-xs">
                {isCompany ? 'Юр. лицо' : 'Физ. лицо'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-text-3">с {fmtDate(client.createdAt)}</span>
              {isCompany && client.inn && (
                <span className="text-sm text-text-3 font-mono">ИНН {client.inn}</span>
              )}
            </div>
          </div>
        </div>
        <Button asChild>
          <Link to={`/admin/orders/new?clientId=${client.id}`}>
            <Plus className="size-4" /> Создать заказ
          </Link>
        </Button>
      </div>

      <nav className="flex gap-1 border-b mb-6 -mx-1 px-1 overflow-x-auto">
        {TABS.map(({ value, label, Icon }) => {
          const isActive = tab === value;
          const count = value === 'orders' ? (client.orders?.length ?? 0) : null;
          return (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={cn(
                'flex items-center gap-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-blue text-blue'
                  : 'border-transparent text-text-2 hover:text-text hover:border-border-2',
              )}
            >
              <Icon className="size-4" />
              {label}
              {count != null && count > 0 && (
                <span className="rounded-full px-1.5 py-0 text-[10px] font-mono bg-surface-3 text-text-2">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {tab === 'profile' && (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Контакты */}
          <div className="rounded-xl border bg-surface p-5">
            <h3 className="font-display font-semibold mb-3">Контакты</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-text-2">
                <Phone className="size-4" />
                {fmtPhone(client.phone)}
                {isCompany && <span className="text-text-3 text-xs">(основной)</span>}
              </div>
              {client.email && (
                <div className="flex items-center gap-2 text-text-2">
                  <Mail className="size-4" /> {client.email}
                </div>
              )}
            </div>
          </div>

          {/* Статистика */}
          <div className="rounded-xl border bg-surface p-5">
            <h3 className="font-display font-semibold mb-3">Статистика</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-text-3">Всего заказов</div>
                <div className="font-display font-bold text-2xl">{client.orders?.length ?? 0}</div>
              </div>
              <div>
                <div className="text-xs text-text-3">Общая сумма</div>
                <div className="font-display font-bold text-2xl price">
                  {fmtRub(client.totalSpent ?? 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Реквизиты юрлица */}
          {isCompany && (
            <>
              <div className="rounded-xl border bg-surface p-5">
                <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
                  <FileText className="size-4" /> Реквизиты
                </h3>
                <div className="space-y-2 text-sm">
                  {client.inn && (
                    <div className="flex justify-between">
                      <span className="text-text-3">ИНН</span>
                      <span className="font-mono">{client.inn}</span>
                    </div>
                  )}
                  {client.kpp && (
                    <div className="flex justify-between">
                      <span className="text-text-3">КПП</span>
                      <span className="font-mono">{client.kpp}</span>
                    </div>
                  )}
                  {client.ogrn && (
                    <div className="flex justify-between">
                      <span className="text-text-3">
                        {client.ogrn.length === 15 ? 'ОГРНИП' : 'ОГРН'}
                      </span>
                      <span className="font-mono">{client.ogrn}</span>
                    </div>
                  )}
                  {client.legalAddress && (
                    <div>
                      <span className="text-text-3 text-xs">Юридический адрес</span>
                      <div className="flex items-start gap-2 mt-0.5">
                        <MapPin className="size-3.5 text-text-3 mt-0.5 shrink-0" />
                        <span>{client.legalAddress}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Контактное лицо */}
              {client.contactPerson && (
                <div className="rounded-xl border bg-surface p-5">
                  <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
                    <UserIcon className="size-4" /> Контактное лицо
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="font-medium">{client.contactPerson}</div>
                    {client.contactPosition && (
                      <div className="text-text-3">{client.contactPosition}</div>
                    )}
                    {client.contactPhone && (
                      <div className="flex items-center gap-2 text-text-2">
                        <Phone className="size-3.5" />
                        {fmtPhone(client.contactPhone)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Банковские реквизиты */}
              {(client.bankAccount || client.bankBik || client.bankName) && (
                <div className="rounded-xl border bg-surface p-5 lg:col-span-2">
                  <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
                    <Landmark className="size-4" /> Банковские реквизиты
                  </h3>
                  <div className="grid sm:grid-cols-3 gap-4 text-sm">
                    {client.bankAccount && (
                      <div>
                        <span className="text-text-3 text-xs">Расчётный счёт</span>
                        <div className="font-mono">{client.bankAccount}</div>
                      </div>
                    )}
                    {client.bankBik && (
                      <div>
                        <span className="text-text-3 text-xs">БИК</span>
                        <div className="font-mono">{client.bankBik}</div>
                      </div>
                    )}
                    {client.bankName && (
                      <div>
                        <span className="text-text-3 text-xs">Банк</span>
                        <div>{client.bankName}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'orders' && (
        <div className="rounded-xl border bg-surface overflow-hidden">
          <div className="p-5 border-b flex items-center justify-between">
            <h2 className="font-display font-semibold flex items-center gap-2">
              <ShoppingBag className="size-5" /> История заказов
            </h2>
            <Button asChild variant="outline" size="sm">
              <Link to={`/admin/orders/new?clientId=${client.id}`}>
                <Plus className="size-4" /> Новый
              </Link>
            </Button>
          </div>
          {!client.orders || client.orders.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag className="size-7" />}
              title="Заказов ещё нет"
              description="Этот клиент ни разу ничего не арендовал"
              action={
                <Button asChild>
                  <Link to={`/admin/orders/new?clientId=${client.id}`}>
                    <Plus className="size-4" /> Создать заказ
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-text-3 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Номер</th>
                    <th className="text-left px-4 py-3 font-medium">Дата</th>
                    <th className="text-left px-4 py-3 font-medium">Период</th>
                    <th className="text-left px-4 py-3 font-medium">Адрес доставки</th>
                    <th className="text-right px-4 py-3 font-medium">Сумма</th>
                    <th className="text-left px-4 py-3 font-medium">Статус</th>
                    <th className="text-right px-4 py-3 font-medium w-24">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {client.orders.map((o) => (
                    <tr key={o.id} className="hover:bg-surface-2 group">
                      <td className="px-4 py-3">
                        <Link to={`/admin/orders/${o.id}`} className="font-mono text-blue">
                          {o.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-2 whitespace-nowrap">
                        {fmtDateTime(o.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {fmtDate(o.fromDate)} → {fmtDate(o.toDate)}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-2 max-w-[240px]">
                        {o.deliveryMethod === 'DELIVERY' ? (
                          o.address ? (
                            <span className="line-clamp-2" title={o.address}>
                              {o.address}
                            </span>
                          ) : (
                            <span className="text-text-3 italic">—</span>
                          )
                        ) : (
                          <span className="text-text-3">Самовывоз</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">
                        {fmtRub(o.totalAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={o.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                          <Link
                            to={`/admin/orders/new?duplicateFrom=${o.id}`}
                            className="size-7 grid place-items-center rounded hover:bg-surface-3"
                            title="Повторить с новыми датами"
                          >
                            <Copy className="size-3.5" />
                          </Link>
                          <Link
                            to={`/admin/orders/${o.id}`}
                            className="size-7 grid place-items-center rounded hover:bg-surface-3"
                            title="Открыть"
                          >
                            <ExternalLink className="size-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
