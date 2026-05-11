import { useEffect, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Eye, FileText, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { emailTemplatesApi } from '@/lib/api/endpoints';
import { apiErrorMessage } from '@/lib/api/client';

/**
 * Универсальные переменные — инжектятся бэком для ВСЕХ типов событий
 * (см. email.provider.ts → values). Добавляются в начало списка для каждого
 * шаблона, чтобы админ видел, что они доступны везде.
 */
const COMMON_PLACEHOLDERS: { name: string; description: string }[] = [
  {
    name: 'brandName',
    description: 'Название площадки из «Настройки → Общие → Название сайта»',
  },
];

/**
 * Доступные плейсхолдеры по типу события — показываем админу справа от редактора,
 * чтобы он не угадывал имена переменных.
 */
const SPECIFIC_PLACEHOLDERS: Record<string, { name: string; description: string }[]> = {
  INQUIRY_RECEIVED: [
    { name: 'orderNumber', description: 'Номер заявки' },
    { name: 'contactName', description: 'Имя обратившегося' },
    { name: 'contactPhone', description: 'Телефон' },
    { name: 'contactEmail', description: 'Email' },
    { name: 'equipmentName', description: 'Название оборудования (если выбрано)' },
    { name: 'inquiryNote', description: 'Комментарий клиента' },
  ],
  ORDER_CREATED: [
    { name: 'orderNumber', description: 'Номер заказа' },
    { name: 'source', description: 'Источник: MANUAL / WEB_CART / WEB_INQUIRY' },
    { name: 'clientName', description: 'Имя клиента' },
    { name: 'totalAmount', description: 'Сумма заказа в рублях' },
    { name: 'fromDate', description: 'Дата начала аренды' },
    { name: 'toDate', description: 'Дата окончания аренды' },
  ],
  ORDER_STATUS_CHANGED: [
    { name: 'orderNumber', description: 'Номер заказа' },
    { name: 'fromStatus', description: 'Прежний статус' },
    { name: 'toStatus', description: 'Новый статус' },
    { name: 'clientName', description: 'Имя клиента' },
  ],
  ORDER_OVERDUE: [
    { name: 'orderNumber', description: 'Номер заказа' },
    { name: 'clientName', description: 'Имя клиента' },
    { name: 'toDate', description: 'Дата, до которой надо было вернуть' },
  ],
  ORDER_RETURN_REMINDER: [
    { name: 'orderNumber', description: 'Номер заказа' },
    { name: 'clientName', description: 'Имя клиента' },
    { name: 'toDate', description: 'Дата возврата' },
    { name: 'daysLeft', description: 'Сколько дней до возврата (1 = завтра)' },
  ],
  ORDER_EXTENDED: [
    { name: 'orderNumber', description: 'Номер заказа' },
    { name: 'clientName', description: 'Имя клиента' },
    { name: 'addedDays', description: 'На сколько дней продлено' },
    { name: 'addedAmount', description: 'Доплата в рублях' },
    { name: 'newToDate', description: 'Новая дата возврата' },
  ],
  PASSWORD_RESET_CODE: [
    { name: 'clientName', description: 'Имя получателя' },
    { name: 'code', description: '6-значный одноразовый код' },
    { name: 'ttlMinutes', description: 'Срок действия в минутах (15)' },
  ],
  EMAIL_VERIFICATION_CODE: [
    { name: 'clientName', description: 'Имя получателя' },
    { name: 'code', description: '6-значный код подтверждения' },
    { name: 'ttlMinutes', description: 'Срок действия в минутах (15)' },
  ],
  DAILY_OPS_BRIEF: [
    { name: 'date', description: 'Дата сводки (YYYY-MM-DD)' },
    { name: 'pickupsCount', description: 'Количество выдач сегодня' },
    { name: 'returnsCount', description: 'Количество возвратов сегодня' },
    { name: 'overdueCount', description: 'Просрочек на руках' },
  ],
};

/**
 * Полный список плейсхолдеров для типа события: общие + специфичные. Если
 * специфичных нет (неизвестный тип) — возвращает только общие, чтобы админ
 * хотя бы видел brandName.
 */
const PLACEHOLDERS: Record<string, { name: string; description: string }[]> = Object.fromEntries(
  Object.entries(SPECIFIC_PLACEHOLDERS).map(([type, list]) => [
    type,
    [...COMMON_PLACEHOLDERS, ...list],
  ]),
);

export function SettingsEmailTemplatesPage() {
  const qc = useQueryClient();
  const { data: list } = useQuery({
    queryKey: ['email-templates'],
    queryFn: emailTemplatesApi.list,
  });

  const [activeType, setActiveType] = useState<string | null>(null);
  const [pendingType, setPendingType] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // При первом получении списка выбираем первый шаблон.
  useEffect(() => {
    if (list && list.length > 0 && !activeType) {
      setActiveType(list[0].eventType);
    }
  }, [list, activeType]);

  const { data: doc } = useQuery({
    queryKey: ['email-templates', activeType],
    queryFn: () => emailTemplatesApi.get(activeType!),
    enabled: !!activeType,
  });

  const [enabled, setEnabled] = useState(true);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [dirty, setDirty] = useState(false);

  // Сбрасываем форму при смене активного шаблона
  useEffect(() => {
    setSubject('');
    setBodyHtml('');
    setDirty(false);
  }, [activeType]);

  // Подгружаем при получении новых данных
  useEffect(() => {
    if (doc && doc.eventType === activeType) {
      setEnabled(doc.enabled);
      setSubject(doc.subject);
      setBodyHtml(doc.bodyHtml);
      setDirty(false);
    }
  }, [doc, activeType]);

  // Защита от ухода со страницы при несохранённых правках
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const update = useMutation({
    mutationFn: () => emailTemplatesApi.update(activeType!, { enabled, subject, bodyHtml }),
    onSuccess: () => {
      toast.success('Шаблон сохранён');
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['email-templates'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Не удалось сохранить')),
  });

  const handleSelectTemplate = (eventType: string) => {
    if (eventType === activeType) return;
    if (dirty) {
      setPendingType(eventType);
      return;
    }
    setActiveType(eventType);
  };

  const placeholders = activeType ? (PLACEHOLDERS[activeType] ?? []) : [];

  return (
    <>
      <PageHeader
        title="Шаблоны писем"
        description="Тема и тело каждого автоматического email-уведомления. Текст подставляется через плейсхолдеры {{переменная}}."
      />

      <div className="grid lg:grid-cols-[280px_1fr] gap-4">
        {/* Список шаблонов */}
        <nav className="rounded-xl border bg-surface p-2 h-fit">
          {(list ?? Array.from({ length: 8 })).map((t, i) =>
            t ? (
              <button
                key={t.eventType}
                type="button"
                onClick={() => handleSelectTemplate(t.eventType)}
                className={`w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors flex items-start gap-2 ${
                  activeType === t.eventType
                    ? 'bg-blue/15 text-blue font-medium'
                    : 'hover:bg-surface-2 text-text'
                }`}
              >
                <FileText className="size-4 flex-shrink-0 mt-0.5" />
                <span className="flex-1 leading-tight">
                  {t.label}
                  {!t.enabled && <span className="block text-xs text-text-3 mt-0.5">отключён</span>}
                </span>
              </button>
            ) : (
              <Skeleton key={i} className="h-10 mb-1" />
            ),
          )}
        </nav>

        {/* Редактор */}
        <div className="rounded-xl border bg-surface p-5 space-y-4">
          {!doc || doc.eventType !== activeType ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-96" />
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display font-semibold text-lg leading-tight">{doc.label}</h2>
                  <p className="text-text-3 text-xs mt-1 font-mono">{doc.eventType}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="tmpl-enabled" className="text-sm cursor-pointer">
                    Включён
                  </Label>
                  <Switch
                    id="tmpl-enabled"
                    checked={enabled}
                    onCheckedChange={(v) => {
                      setEnabled(v);
                      setDirty(true);
                    }}
                  />
                </div>
              </div>

              <div className="grid lg:grid-cols-[1fr_240px] gap-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="tmpl-subject">Тема письма</Label>
                    <Input
                      id="tmpl-subject"
                      value={subject}
                      onChange={(e) => {
                        setSubject(e.target.value);
                        setDirty(true);
                      }}
                      placeholder="Например: Новая заявка {{orderNumber}}"
                      className="mt-1.5 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <Label className="block mb-1.5">Тело письма</Label>
                    <RichTextEditor
                      key={activeType ?? 'none'}
                      value={bodyHtml}
                      onChange={(html) => {
                        setBodyHtml(html);
                        setDirty(true);
                      }}
                    />
                    <p className="text-xs text-text-3 mt-2">
                      Используйте плейсхолдеры справа — например <code>{'{{clientName}}'}</code>{' '}
                      будет заменено на имя клиента при отправке.
                    </p>
                  </div>
                </div>

                <aside className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-text-3">
                    Доступные переменные
                  </h3>
                  <div className="rounded-lg border bg-bg p-3 space-y-2">
                    {placeholders.length === 0 ? (
                      <p className="text-xs text-text-3 italic">
                        Для этого типа события переменных нет.
                      </p>
                    ) : (
                      placeholders.map((p) => (
                        <div
                          key={p.name}
                          className="cursor-pointer hover:bg-surface-2 rounded p-1.5 -m-1.5 transition-colors"
                          title="Скопировать в буфер"
                          onClick={() => {
                            navigator.clipboard
                              .writeText(`{{${p.name}}}`)
                              .then(() => toast.success(`{{${p.name}}} скопировано`))
                              .catch(() => {});
                          }}
                        >
                          <code className="text-xs font-mono text-blue">{`{{${p.name}}}`}</code>
                          <p className="text-xs text-text-3 leading-tight mt-0.5">
                            {p.description}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-text-3 leading-relaxed">
                    Кликните по переменной, чтобы скопировать. Если переменная отсутствует в событии
                    — подставится пустая строка.
                  </p>
                </aside>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewOpen(true)}
                    disabled={!subject.trim()}
                  >
                    <Eye className="size-4" /> Превью
                  </Button>
                  <p className="text-xs text-text-3">
                    Обновлено: {new Date(doc.updatedAt).toLocaleString('ru-RU')}
                    {dirty && (
                      <span className="ml-2 text-amber-700 font-medium">
                        • есть несохранённые изменения
                      </span>
                    )}
                  </p>
                </div>
                <Button
                  onClick={() => update.mutate()}
                  disabled={!dirty || update.isPending || !subject.trim()}
                >
                  {update.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Сохранить
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Подтверждение перехода с несохранёнными изменениями */}
      <Dialog open={!!pendingType} onOpenChange={(o) => !o && setPendingType(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-600" />
              Несохранённые изменения
            </DialogTitle>
            <DialogDescription>
              В текущем шаблоне есть правки. Если перейти к другому — изменения будут потеряны.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPendingType(null)}>
              Остаться
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingType) setActiveType(pendingType);
                setPendingType(null);
              }}
            >
              Перейти и потерять правки
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Подтверждение ухода со страницы */}
      <Dialog
        open={blocker.state === 'blocked'}
        onOpenChange={(o) => {
          if (!o && blocker.state === 'blocked') blocker.reset?.();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-600" />
              Несохранённые изменения
            </DialogTitle>
            <DialogDescription>
              На странице есть несохранённые правки шаблона. Если уйти — они будут потеряны.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => blocker.reset?.()}>
              Остаться
            </Button>
            <Button variant="destructive" onClick={() => blocker.proceed?.()}>
              Уйти и потерять правки
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Превью */}
      {activeType && previewOpen && (
        <PreviewDialog
          eventType={activeType}
          subject={subject}
          bodyHtml={bodyHtml}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </>
  );
}

function PreviewDialog({
  eventType,
  subject: _s,
  bodyHtml: _b,
  onClose,
}: {
  eventType: string;
  subject: string;
  bodyHtml: string;
  onClose: () => void;
}) {
  // Сервер сделает рендер на лету по последнему сохранённому шаблону.
  // Если есть несохранённые правки — показываем подсказку, что превью идёт по сохранённой версии.
  const { data, isLoading } = useQuery({
    queryKey: ['email-template-preview', eventType],
    queryFn: () => emailTemplatesApi.preview(eventType),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Превью письма</DialogTitle>
          <DialogDescription>
            Шаблон с подставленными примерами значений (как увидит получатель). Превью использует{' '}
            <b>сохранённую</b> версию шаблона.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3">
          {isLoading && <Skeleton className="h-64" />}
          {data && (
            <>
              <div className="rounded-md border bg-bg p-3">
                <p className="text-xs text-text-3 mb-1">Тема:</p>
                <p className="font-semibold">{data.subject}</p>
              </div>
              <div className="rounded-md border bg-bg p-4">
                <p className="text-xs text-text-3 mb-2">Тело:</p>
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: data.bodyHtml }}
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Закрыть</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
