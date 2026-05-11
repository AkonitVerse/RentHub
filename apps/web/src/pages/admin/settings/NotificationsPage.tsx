import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Bell,
  Calendar,
  Clock,
  Inbox,
  Loader2,
  Save,
  Send,
  Server,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/shared/PageHeader';
import { orgSettingsApi, type OrgSettings } from '@/lib/api/endpoints';
import { apiErrorMessage } from '@/lib/api/client';

// Form: набор полей которые редактируются. OrgSettings из API не содержит smtpPass
// (он скрыт ради безопасности — есть только smtpPassConfigured). Но в форме поле
// есть — для ввода нового пароля. Добавляем его в тип явно.
type Form = Partial<Omit<OrgSettings, 'id' | 'updatedAt'>> & {
  smtpPass?: string;
  /** Сигнал для бэка «стереть сохранённый пароль приложения». */
  clearSmtpPass?: boolean;
};

/**
 * Превращает data из API в начальное состояние формы.
 *
 * НИКАКИХ умных дефолтов поверх БД — что в БД, то и в форме. Это критически
 * важно: если перезаписывать поля при загрузке, юзер сохранит STARTTLS, а
 * после рефетча мы навяжем ему TLS обратно. Цикл «сохранил → перезатёрло».
 *
 * Рекомендованные пары (465+TLS / 587+STARTTLS) подставляются ТОЛЬКО
 * при клике пилюли-пресета — там осознанное действие юзера.
 *
 * Поле smtpPass всегда пустое — реальный пароль фронтенду не приходит,
 * редактируется через отдельный ввод.
 */
function computeEffectiveInitial(data: OrgSettings): Form {
  return {
    ...data,
    smtpPass: '',
  };
}

/**
 * «Чистое» состояние SMTP-полей для выбранного пресета.
 *
 * Идея: пока юзер просто кликает по пилюлькам почтовых сервисов, форма не
 * считается изменённой — это «примерка», а не правка. dirty=true должен
 * выскакивать только когда реально что-то введено сверху (логин, пароль, или
 * ручная корректировка host/port/TLS).
 *
 * Чтобы это работало, для каждого пресета определяем «какой бы выглядела форма
 * сразу после клика по нему, без правок»:
 *
 *  - Пилюля совпадает с тем, что в БД → pristine = сохранённые значения
 *    (т.е. effectiveInitial с умными дефолтами).
 *  - Пилюля другая → pristine = параметры пресета + пустой логин
 *    (старый логин на новый сервер не отправит, его всё равно надо менять).
 *
 * Сравнение form vs pristine даёт честный ответ «юзер реально что-то правил?».
 */
function getPristineSmtp(
  selectedId: string,
  savedId: string,
  effectiveInitial: Form,
): { smtpHost: string; smtpPort: number; smtpSecure: boolean; smtpUser: string } {
  if (selectedId === savedId) {
    // Возврат к сохранённому пресету — берём ТОЧНО что в БД (без подстановок).
    // Это критично: иначе сохранённый STARTTLS затирался бы обратно на TLS.
    return {
      smtpHost: effectiveInitial.smtpHost ?? '',
      smtpPort: effectiveInitial.smtpPort ?? 0,
      smtpSecure: effectiveInitial.smtpSecure ?? true,
      smtpUser: effectiveInitial.smtpUser ?? '',
    };
  }
  // Любой пресет (Яндекс/Gmail/Mail.ru/Свой), отличный от сохранённого:
  //  - host подставляем готовый (если есть в пресете)
  //  - порт ОСТАЁМ ПУСТЫМ — юзер сам введёт или оставит как есть
  //  - TLS всегда true (рекомендуемое значение)
  //  - логин очищается (старый под другой сервер не пойдёт)
  const p = SMTP_PROVIDERS.find((x) => x.id === selectedId);
  return {
    smtpHost: p?.host ?? '',
    smtpPort: 0,
    smtpSecure: true,
    smtpUser: '',
  };
}

/**
 * Поля формы, которые сравниваем «как есть» с effectiveInitial.
 * SMTP-поля сюда НЕ входят — для них отдельная логика через pristine
 * (зависит от выбранного пресета). senderName/senderEmail тоже исключены —
 * UI их не показывает, они тащатся прозрачно из data в payload.
 */
const NON_SMTP_DIFF_KEYS: (keyof Form)[] = [
  'overdueCheckEnabled',
  'overdueCheckEveryMinutes',
  'dailyBriefEnabled',
  'dailyBriefHour',
  'dailyBriefMinute',
  'returnReminderEnabled',
  'returnReminderHour',
  'returnReminderMinute',
  'returnReminderDaysBefore',
  'inquiryExpireEnabled',
  'inquiryExpireHour',
  'inquiryExpireMinute',
  'inquiryExpireAfterDays',
  'timezone',
  'staffEmails',
];

export function SettingsNotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['org-settings'],
    queryFn: orgSettingsApi.get,
  });

  // Что показываем при свежей загрузке + база для сравнения «есть ли правки».
  const effectiveInitial = useMemo<Form | null>(
    () => (data ? computeEffectiveInitial(data) : null),
    [data],
  );

  // Какой пресет соответствует тому, что СОХРАНЕНО в БД. Если host пустой —
  // получим «custom», и это правильно: пустую конфигурацию не привязываем к Gmail.
  const savedPresetId = useMemo(
    () => (data ? detectProvider(data.smtpHost ?? '').id : 'custom'),
    [data],
  );

  const [form, setForm] = useState<Form>({});
  // UI-стейт: какой пресет выбрал юзер кликом. null = «как в БД».
  // Не часть form — переключение пилюль само по себе НЕ должно делать форму dirty.
  const [explicitChoice, setExplicitChoice] = useState<string | null>(null);
  // Локальный буфер пароля. В form.smtpPass он тоже зеркалируется для отправки.
  // Зачем отдельно: пустая строка в form == «не менять», а в input должен
  // показываться плейсхолдер. Разделяем «значение в форме» и «введено ли что-то».
  const [smtpPass, setSmtpPass] = useState('');

  // При получении/обновлении data — сбрасываем форму к pristine.
  useEffect(() => {
    if (effectiveInitial) {
      setForm(effectiveInitial);
      setExplicitChoice(null);
      setSmtpPass('');
    }
  }, [effectiveInitial]);

  const selectedPresetId = explicitChoice ?? savedPresetId;

  /**
   * dirty — есть ли РЕАЛЬНЫЕ правки, требующие сохранения.
   *
   * Считается через сравнение, а не флагом:
   *  - Введён пароль → dirty.
   *  - SMTP-поля отличаются от pristine ВЫБРАННОГО пресета → dirty
   *    (но «просто переключил пилюлю» pristine === form → false).
   *  - Любое не-SMTP поле отличается от effectiveInitial → dirty.
   */
  const dirty = useMemo(() => {
    if (!effectiveInitial) return false;

    if (smtpPass) return true;

    // Пилюля сменена И в БД есть сохранённый пароль → есть что сохранять
    // (как минимум — стереть старый пароль). Без этой проверки кнопка
    // «Сохранить» не появлялась бы при простом переключении на чистую пилюлю.
    if (selectedPresetId !== savedPresetId && data?.smtpPassConfigured) return true;

    const pristine = getPristineSmtp(selectedPresetId, savedPresetId, effectiveInitial);
    if ((form.smtpHost ?? '') !== pristine.smtpHost) return true;
    if ((form.smtpPort ?? 0) !== pristine.smtpPort) return true;
    if ((form.smtpSecure ?? false) !== pristine.smtpSecure) return true;
    if ((form.smtpUser ?? '') !== pristine.smtpUser) return true;

    for (const k of NON_SMTP_DIFF_KEYS) {
      const a = form[k];
      const b = effectiveInitial[k];
      if (typeof a === 'string' && typeof b === 'string') {
        if (a.trim() !== b.trim()) return true;
      } else if (a !== b) {
        return true;
      }
    }
    return false;
  }, [form, smtpPass, effectiveInitial, selectedPresetId, savedPresetId, data]);

  /**
   * Серверный DTO принимает только конкретные поля. На фронт приходит и эти поля,
   * и метаданные (id, createdAt, updatedAt, smtpPassConfigured). При отправке
   * фильтруем только разрешённые ключи, иначе backend отклонит payload.
   */
  const ALLOWED_KEYS: (keyof Form)[] = [
    'overdueCheckEnabled',
    'overdueCheckEveryMinutes',
    'dailyBriefEnabled',
    'dailyBriefHour',
    'dailyBriefMinute',
    'returnReminderEnabled',
    'returnReminderHour',
    'returnReminderMinute',
    'returnReminderDaysBefore',
    'inquiryExpireEnabled',
    'inquiryExpireHour',
    'inquiryExpireMinute',
    'inquiryExpireAfterDays',
    'timezone',
    'senderName',
    'senderEmail',
    'staffEmails',
    'smtpHost',
    'smtpPort',
    'smtpUser',
    'smtpPass',
    'smtpSecure',
  ];

  const buildPayload = (): Form => {
    const out: Form = {};
    for (const k of ALLOWED_KEYS) {
      const v = form[k];
      if (v !== undefined) (out as Record<string, unknown>)[k] = v;
    }
    // Нормализация порта при сохранении. Тумблер TLS/STARTTLS — главный
    // выбор юзера, порт подгоняется под него:
    //
    //  1. Порт пуст (0)             → подставить стандартный (465 для TLS, 587 для STARTTLS).
    //  2. TLS=true  + порт=587      → подменить на 465 (перевёрнутая стандартная пара —
    //                                  такой комбинации в природе нет, юзер ошибся).
    //  3. TLS=false + порт=465      → подменить на 587 (то же самое в обратную сторону).
    //  4. Кастомный порт (2525,1025,25...) → ОСТАВИТЬ как есть. Если у юзера
    //     экзотический SMTP-сервер на нестандартном порту — он явно знает
    //     что делает, не ломаем ему гибкость.
    //
    // После сохранения юзер видит реальное значение в поле; не будет
    // молчаливого рассинхрона «выбрал TLS, а в БД 587».
    const port = out.smtpPort ?? 0;
    const secure = out.smtpSecure ?? false;
    if (port <= 0) {
      out.smtpPort = secure ? 465 : 587;
    } else if (secure && port === 587) {
      out.smtpPort = 465;
    } else if (!secure && port === 465) {
      out.smtpPort = 587;
    }
    // Логика пароля:
    //  - юзер ввёл новый → отправляем его (бэк сохранит)
    //  - юзер не вводил, пилюля = сохранённой → НЕ отправляем (бэк не тронет)
    //  - юзер не вводил, пилюля СМЕНЕНА → шлём clearSmtpPass=true
    //    (старый пароль был для другого SMTP-сервера, в новом контексте мусор)
    delete out.smtpPass;
    delete out.clearSmtpPass;
    if (smtpPass) {
      out.smtpPass = smtpPass;
    } else if (selectedPresetId !== savedPresetId) {
      out.clearSmtpPass = true;
    }
    return out;
  };

  const update = useMutation({
    mutationFn: () => orgSettingsApi.update(buildPayload()),
    onSuccess: () => {
      toast.success('Настройки сохранены, расписание обновлено');
      qc.invalidateQueries({ queryKey: ['org-settings'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Не удалось сохранить')),
  });

  const setField = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /**
   * Клик по пилюле — выставляет explicitChoice и подгоняет form под pristine
   * этого пресета. dirty останется false, пока юзер не введёт что-то сверх.
   */
  const applyProvider = (id: string) => {
    if (!effectiveInitial) return;
    setExplicitChoice(id);
    const pristine = getPristineSmtp(id, savedPresetId, effectiveInitial);
    setForm((prev) => ({
      ...prev,
      smtpHost: pristine.smtpHost,
      smtpPort: pristine.smtpPort,
      smtpSecure: pristine.smtpSecure,
      smtpUser: pristine.smtpUser,
      smtpPass: '',
    }));
    setSmtpPass('');
  };

  const cancel = () => {
    if (!effectiveInitial) return;
    setForm(effectiveInitial);
    setExplicitChoice(null);
    setSmtpPass('');
  };

  if (isLoading || !data || !effectiveInitial) {
    return (
      <div className="max-w-4xl">
        <PageHeader title="Уведомления" description="Расписание автоматических задач" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Уведомления"
        description="Расписание автоматических задач, часовой пояс, получатели и SMTP-сервер для отправки писем."
      />

      <div className="space-y-4">
        <SettingCard
          icon={<AlertTriangle className="size-5" />}
          title="Проверка просрочек"
          description="Заказы со статусом «Активный» и истёкшим сроком возврата автоматически переходят в «Просрочен». Клиенту и менеджеру уходит уведомление."
          enabled={form.overdueCheckEnabled ?? true}
          onToggle={(v) => setField('overdueCheckEnabled', v)}
        >
          <NumberField
            label="Период проверки (минут)"
            min={1}
            max={60}
            value={form.overdueCheckEveryMinutes ?? 10}
            onChange={(v) => setField('overdueCheckEveryMinutes', v)}
            hint="Допустимо: 1–60. Минимальная задержка перевода в OVERDUE."
          />
        </SettingCard>

        <SettingCard
          icon={<Bell className="size-5" />}
          title="Утренняя сводка менеджерам"
          description="Каждый день в указанное время менеджеры получают сводку: сколько сегодня выдач, возвратов и заказов с просрочкой на руках."
          enabled={form.dailyBriefEnabled ?? true}
          onToggle={(v) => setField('dailyBriefEnabled', v)}
        >
          <TimeField
            label="Время отправки"
            hour={form.dailyBriefHour ?? 8}
            minute={form.dailyBriefMinute ?? 0}
            onChange={(h, m) => {
              setField('dailyBriefHour', h);
              setField('dailyBriefMinute', m);
            }}
          />
        </SettingCard>

        <SettingCard
          icon={<Clock className="size-5" />}
          title="Напоминание клиенту о возврате"
          description="Клиент получает email о приближающейся дате возврата по активным заказам."
          enabled={form.returnReminderEnabled ?? true}
          onToggle={(v) => setField('returnReminderEnabled', v)}
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <TimeField
              label="Время отправки"
              hour={form.returnReminderHour ?? 9}
              minute={form.returnReminderMinute ?? 0}
              onChange={(h, m) => {
                setField('returnReminderHour', h);
                setField('returnReminderMinute', m);
              }}
            />
            <NumberField
              label="За сколько дней"
              min={0}
              max={14}
              value={form.returnReminderDaysBefore ?? 1}
              onChange={(v) => setField('returnReminderDaysBefore', v)}
              hint="0 — в день возврата · 1 — за день · до 14"
            />
          </div>
        </SettingCard>

        <SettingCard
          icon={<Inbox className="size-5" />}
          title="Автоотмена входящих заявок"
          description="Заявки с витрины (DRAFT), на которые менеджер не отреагировал, автоматически отменяются. Заявки от менеджера не трогаются."
          enabled={form.inquiryExpireEnabled ?? true}
          onToggle={(v) => setField('inquiryExpireEnabled', v)}
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <TimeField
              label="Время проверки"
              hour={form.inquiryExpireHour ?? 3}
              minute={form.inquiryExpireMinute ?? 0}
              onChange={(h, m) => {
                setField('inquiryExpireHour', h);
                setField('inquiryExpireMinute', m);
              }}
            />
            <NumberField
              label="Через сколько дней"
              min={1}
              max={365}
              value={form.inquiryExpireAfterDays ?? 30}
              onChange={(v) => setField('inquiryExpireAfterDays', v)}
              hint="1–365 дней с момента создания"
            />
          </div>
        </SettingCard>

        <div className="rounded-xl border bg-surface p-5">
          <div className="flex items-center gap-3 mb-3">
            <Calendar className="size-5 text-text-3" />
            <div className="flex-1">
              <h3 className="font-semibold">Часовой пояс</h3>
              <p className="text-text-3 text-xs mt-0.5">
                Все времена выше указаны в этом часовом поясе.
              </p>
            </div>
          </div>
          <TimezoneCombobox
            value={form.timezone ?? 'Europe/Moscow'}
            onChange={(v) => setField('timezone', v)}
          />
          <p className="text-xs text-text-3 mt-1.5">
            Все часовые пояса России. В этом времени работают все автоматические задачи и
            расписания.
          </p>
        </div>

        {/* Отправитель писем = автоматически:
            - Email = SMTP-логин (см. поле «Email-ящик» в блоке SMTP ниже)
            - Имя = «Название сайта» из «Настройки → Общие»
            Отдельных полей нет — иначе пользователь дублирует то, что уже задал в Общих. */}

        {/* === Получатели для STAFF-уведомлений === */}
        <div className="rounded-xl border bg-surface p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Users className="size-5 text-text-3" />
            <div className="flex-1">
              <h3 className="font-semibold">Email-адреса менеджеров</h3>
              <p className="text-text-3 text-xs mt-0.5">
                Сюда приходят уведомления для персонала: новые заявки, новые заказы, утренняя
                сводка, уведомления о просрочке.
              </p>
            </div>
          </div>
          <Input
            value={form.staffEmails ?? ''}
            onChange={(e) => setField('staffEmails', e.target.value)}
            placeholder="manager@example.com, ops@example.com"
            className="font-mono text-sm"
          />
          <p className="text-xs text-text-3">
            Несколько адресов — через запятую, точку с запятой или с новой строки.
          </p>
        </div>

        {/* === SMTP === */}
        <SmtpBlock
          data={data}
          form={form}
          setField={setField}
          smtpPass={smtpPass}
          setSmtpPass={setSmtpPass}
          selectedPresetId={selectedPresetId}
          savedPresetId={savedPresetId}
          applyProvider={applyProvider}
        />

        <div className="sticky bottom-4 z-10 mt-6">
          <div
            className={`rounded-xl border bg-surface shadow-lg p-3 flex items-center justify-between gap-3 transition-opacity ${
              dirty ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <span className="text-sm text-text-2">
              Есть несохранённые изменения. После сохранения расписание перезапустится.
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={cancel} disabled={update.isPending}>
                Отмена
              </Button>
              <Button onClick={() => update.mutate()} disabled={update.isPending || !dirty}>
                {update.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Сохранить
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingCard({
  icon,
  title,
  description,
  enabled,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-surface p-5">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-lg bg-surface-2 grid place-items-center text-text-2 flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h3 className="font-semibold leading-tight">{title}</h3>
              <p className="text-text-3 text-xs mt-1 leading-relaxed">{description}</p>
            </div>
            <Switch checked={enabled} onCheckedChange={onToggle} />
          </div>
          {enabled && children && <div className="mt-4 pt-4 border-t">{children}</div>}
        </div>
      </div>
    </div>
  );
}

function TimeField({
  label,
  hour,
  minute,
  onChange,
}: {
  label: string;
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
}) {
  const value = `${pad(hour)}:${pad(minute)}`;
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type="time"
        value={value}
        onChange={(e) => {
          const [h, m] = e.target.value.split(':').map((x) => parseInt(x, 10));
          if (Number.isFinite(h) && Number.isFinite(m)) onChange(h, m);
        }}
        className="mt-1.5 w-32 font-mono"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  hint?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
        }}
        className="mt-1.5 w-28 font-mono"
      />
      {hint && <p className="text-xs text-text-3 mt-1">{hint}</p>}
    </div>
  );
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Преднастройки популярных почтовых провайдеров. Все требуют
 * «пароль приложения» (application password) — обычный пароль аккаунта не подойдёт.
 */
interface SmtpProvider {
  id: string;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  /** Куда послать админа за app password */
  appPasswordUrl: string;
  hint: string;
}
const SMTP_PROVIDERS: SmtpProvider[] = [
  {
    id: 'yandex',
    name: 'Яндекс Почта',
    host: 'smtp.yandex.ru',
    port: 465,
    secure: true,
    appPasswordUrl: 'https://id.yandex.ru/security/enter-passwords',
    hint: 'Включите «Пароли приложений» в Яндекс ID, создайте пароль для «Почта», вставьте сюда.',
  },
  {
    id: 'mail-ru',
    name: 'Mail.ru',
    host: 'smtp.mail.ru',
    port: 465,
    secure: true,
    appPasswordUrl: 'https://account.mail.ru/user/2-step-auth/passwords/',
    hint: 'В настройках безопасности Mail.ru создайте пароль для внешних программ.',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    // Gmail работает и на 465 (TLS), и на 587 (STARTTLS).
    // 465+TLS стабильнее в РФ — некоторые провайдеры блокируют исходящий 587.
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    appPasswordUrl: 'https://myaccount.google.com/apppasswords',
    hint: 'Требуется включённая 2-факторная аутентификация в аккаунте Google. Затем создайте «Пароль приложения» по ссылке ниже и введите его сюда (без пробелов).',
  },
  {
    id: 'custom',
    name: 'Свой / другой',
    host: '',
    port: 0,
    secure: false,
    appPasswordUrl: '',
    hint: 'Введите параметры вручную. Уточните их у вашего почтового провайдера или хостинга.',
  },
];

function detectProvider(host: string): SmtpProvider {
  const found = SMTP_PROVIDERS.find((p) => p.host && host.toLowerCase().includes(p.host));
  return found ?? SMTP_PROVIDERS[SMTP_PROVIDERS.length - 1]; // custom
}

function SmtpBlock({
  data,
  form,
  setField,
  smtpPass,
  setSmtpPass,
  selectedPresetId,
  savedPresetId,
  applyProvider,
}: {
  data: OrgSettings;
  form: Form;
  setField: <K extends keyof Form>(key: K, value: Form[K]) => void;
  smtpPass: string;
  setSmtpPass: (v: string) => void;
  selectedPresetId: string;
  savedPresetId: string;
  applyProvider: (id: string) => void;
}) {
  // «(уже задан)» и точечный плейсхолдер показываем ТОЛЬКО когда выбрана
  // та же пилюля что в БД. На другой пилюле сохранённый пароль не релевантен —
  // он от старого сервера, к новому SMTP не подойдёт. Поле выглядит чистым.
  const showSavedPassword = data.smtpPassConfigured && selectedPresetId === savedPresetId;
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);

  const provider =
    SMTP_PROVIDERS.find((p) => p.id === selectedPresetId) ??
    SMTP_PROVIDERS[SMTP_PROVIDERS.length - 1];
  const isCustom = provider.id === 'custom';

  const sendTest = async () => {
    if (!testEmail) {
      toast.error('Введите email для теста');
      return;
    }
    setTesting(true);
    try {
      await orgSettingsApi.testEmail(testEmail);
      toast.success(`Тестовое письмо отправлено на ${testEmail}`);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось отправить'));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-xl border bg-surface p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Server className="size-5 text-text-3" />
        <div className="flex-1">
          <h3 className="font-semibold">SMTP-сервер</h3>
          <p className="text-text-3 text-xs mt-0.5">
            Параметры SMTP-сервера для исходящей почты. Используются для автоматической рассылки
            уведомлений от платформы.
          </p>
        </div>
      </div>

      {/* Выбор провайдера в виде «таблеток» */}
      <div>
        <Label className="block mb-2">Почтовый сервис</Label>
        <div className="flex flex-wrap gap-2">
          {SMTP_PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyProvider(p.id)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                provider.id === p.id
                  ? 'bg-blue text-white border-blue'
                  : 'bg-surface text-text-2 border-border hover:bg-surface-2'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
        {!isCustom && (
          <div className="mt-3 rounded-md bg-blue/5 border border-blue/20 p-3 text-sm">
            <p className="text-text-2">{provider.hint}</p>
            {provider.appPasswordUrl && (
              <a
                href={provider.appPasswordUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-blue hover:underline text-xs"
              >
                Создать пароль приложения →
              </a>
            )}
          </div>
        )}
      </div>

      {/* Поля сервера/порта/TLS всегда редактируются — даже для пресетов.
          Клик на пресет авто-заполнит «правильную» пару (Яндекс=smtp.yandex.ru:465+TLS),
          но если у юзера в сети заблокирован 465 — он может вручную переключить
          на 587+STARTTLS, не выходя из пресета. Гибкость + удобство. */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <Label htmlFor="smtp-host">Адрес сервера</Label>
          <Input
            id="smtp-host"
            value={form.smtpHost ?? ''}
            onChange={(e) => setField('smtpHost', e.target.value)}
            placeholder="smtp.example.com"
            className="mt-1.5 font-mono text-sm"
          />
        </div>
        <div>
          <Label htmlFor="smtp-port">Порт</Label>
          <Input
            id="smtp-port"
            type="number"
            min={0}
            max={65535}
            // Пустое значение разрешено — на бэк уйдёт 0, что трактуется как
            // «не задано» (см. email.provider.ts: row?.smtpPort > 0 ? ... : fallback).
            // Удобно когда юзер хочет почистить и подумать, не блокируя UI.
            value={form.smtpPort ? form.smtpPort : ''}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') {
                setField('smtpPort', 0);
                return;
              }
              const v = parseInt(raw, 10);
              if (!Number.isFinite(v)) return;
              setField('smtpPort', v);
              // Автосвязки с TLS НЕТ намеренно: ручной ввод порта не должен
              // дёргать тумблер. Иначе нельзя собрать нестандартные комбинации
              // (TLS на 587 / STARTTLS на 465 / TLS на 2323). «Стандартную»
              // пару выставляет только клик по пилюле-пресету.
            }}
            placeholder="Порт"
            className="mt-1.5 font-mono"
          />
          <p className="text-xs text-text-3 mt-1 leading-relaxed">
            При пустом поле или нестандартной паре автокоррекция по протоколу:
            <br />
            TLS — порт 465 / STARTTLS — порт 587
            <br />
            Свой порт (2525, 1025 и т.п.) — без изменений.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="smtp-user">Email-ящик</Label>
          <Input
            id="smtp-user"
            value={form.smtpUser ?? ''}
            onChange={(e) => setField('smtpUser', e.target.value)}
            placeholder="your@example.com"
            className="mt-1.5 font-mono text-sm"
            autoComplete="off"
          />
          <p className="text-xs text-text-3 mt-1">
            Логин для SMTP. В заголовке письма у пользователя отобразится только «Название сайта»
            (из «Настройки → Общие → Название сайта»).
          </p>
        </div>
        <div>
          <Label htmlFor="smtp-pass">
            Пароль приложения{' '}
            {showSavedPassword && (
              <span className="text-text-3 font-normal text-xs">(уже задан)</span>
            )}
          </Label>
          <Input
            id="smtp-pass"
            type="password"
            value={smtpPass}
            onChange={(e) => {
              setSmtpPass(e.target.value);
              setField('smtpPass', e.target.value);
            }}
            placeholder={showSavedPassword ? '••••••••' : 'app password'}
            className="mt-1.5 font-mono text-sm"
            autoComplete="new-password"
          />
          <p className="text-xs text-text-3 mt-1">
            {showSavedPassword
              ? 'Оставьте пустым, чтобы не менять.'
              : selectedPresetId !== savedPresetId
                ? 'При сохранении на другой почтовой службе старый пароль будет удалён.'
                : 'Пароль приложения вашей почтовой службы.'}
          </p>
        </div>
      </div>

      {/* Тумблер TLS полностью независим: меняет только TLS, порт не трогает.
          Никаких автосвязей. Хочешь стандартную пару (465+TLS / 587+STARTTLS) —
          бери через клик пилюли-пресета. Хочешь любую другую комбинацию —
          собирай руками: щёлкнул тумблер, ввёл нужный порт, сохранил. */}
      <label className="flex items-center gap-2 cursor-pointer">
        <Switch
          checked={form.smtpSecure ?? false}
          onCheckedChange={(v) => setField('smtpSecure', v)}
        />
        <span className="text-sm">{form.smtpSecure ? 'TLS' : 'STARTTLS'}</span>
      </label>
      <div className="rounded-md border bg-bg p-3 mt-2">
        <div className="flex items-center gap-2 mb-2">
          <Send className="size-4 text-text-3" />
          <p className="text-sm font-medium">Проверка соединения</p>
        </div>
        <p className="text-xs text-text-3 mb-2">
          Отправит тестовое письмо текущими сохранёнными настройками. Если внесли правки — сначала
          нажмите «Сохранить», затем тестируйте.
        </p>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="ваш@email.ru"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="font-mono text-sm flex-1"
          />
          <Button onClick={sendTest} disabled={testing || !testEmail}>
            {testing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Отправить тест
          </Button>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Выбор часового пояса
// =====================================================

/**
 * Значимые часовые пояса с русскими названиями.
 *
 * Сначала идут все 11 часовых поясов России (с UTC+2 по UTC+12), затем
 * UTC и ключевые мировые столицы. Платформа ориентирована на российский
 * рынок аренды, поэтому полный список 400+ IANA-зон избыточен — основная
 * масса юзеров укажет одну из российских.
 *
 * IANA-имя в `id` сохраняется в БД и используется бэкендом. Русское
 * название и UTC-смещение — только для отображения.
 */
interface TimezoneOption {
  id: string; // IANA-идентификатор (что хранится в БД)
  name: string; // Что видит юзер
  offset: string; // Для отображения, например «UTC+3»
}

const TIMEZONES: TimezoneOption[] = [
  // Все часовые пояса России — отсортировано по смещению (запад → восток).
  // Платформа ориентирована на российский рынок, поэтому покрываем только
  // местные зоны. UTC добавлен как универсальный fallback.
  // Формат смещения — стандартный ISO 8601 ±HH:MM с префиксом UTC.
  { id: 'UTC', name: 'UTC (всемирное координированное)', offset: 'UTC+00:00' },
  { id: 'Europe/Kaliningrad', name: 'Калининград', offset: 'UTC+02:00' },
  { id: 'Europe/Moscow', name: 'Москва', offset: 'UTC+03:00' },
  { id: 'Europe/Samara', name: 'Самара, Ижевск', offset: 'UTC+04:00' },
  { id: 'Asia/Yekaterinburg', name: 'Екатеринбург, Уфа', offset: 'UTC+05:00' },
  { id: 'Asia/Omsk', name: 'Омск', offset: 'UTC+06:00' },
  { id: 'Asia/Krasnoyarsk', name: 'Красноярск, Новосибирск', offset: 'UTC+07:00' },
  { id: 'Asia/Irkutsk', name: 'Иркутск, Улан-Удэ', offset: 'UTC+08:00' },
  { id: 'Asia/Yakutsk', name: 'Якутск, Чита', offset: 'UTC+09:00' },
  { id: 'Asia/Vladivostok', name: 'Владивосток, Хабаровск', offset: 'UTC+10:00' },
  { id: 'Asia/Magadan', name: 'Магадан, Сахалин', offset: 'UTC+11:00' },
  { id: 'Asia/Kamchatka', name: 'Камчатка, Чукотка', offset: 'UTC+12:00' },
];

function TimezoneCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Выберите часовой пояс" />
      </SelectTrigger>
      <SelectContent className="max-h-[360px]">
        <SelectGroup>
          {TIMEZONES.map((tz) => (
            <SelectItem key={tz.id} value={tz.id}>
              <span className="flex items-center gap-2">
                <span>{tz.name}</span>
                <span className="text-xs text-text-3">({tz.offset})</span>
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
