import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Globe,
  Image as ImageIcon,
  Phone,
  AtSign,
  MapPin,
  Clock,
  Loader2,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Logo } from '@/components/shared/Logo';
import { PageHeader } from '@/components/shared/PageHeader';
import { orgSettingsApi, type OrgSettings } from '@/lib/api/endpoints';
import { apiErrorMessage } from '@/lib/api/client';

// Поле orgName специально не редактируется в UI: пока договоров и реквизитов на витрине
// нет — поле бесполезно. Колонка в БД сохраняется на будущее (под печатные документы),
// но мы её не отправляем при сохранении, чтобы не затирать возможные данные.
type OrgFields = Pick<
  OrgSettings,
  'orgShortName' | 'orgPhone' | 'orgEmail' | 'orgAddress' | 'orgHours'
>;

const ORG_KEYS: (keyof OrgFields)[] = [
  'orgShortName',
  'orgPhone',
  'orgEmail',
  'orgAddress',
  'orgHours',
];

const EMPTY_FORM: OrgFields = {
  orgShortName: '',
  orgPhone: '',
  orgEmail: '',
  orgAddress: '',
  orgHours: '',
};

/**
 * Раздел «Организация» — контактные реквизиты для витрины и подписи писем.
 *
 * Поля без юридической нагрузки (ИНН/ОГРНИП). Когда платформа дорастёт до
 * генерации печатных договоров — добавим их отдельной миграцией.
 */
export function SettingsOrganizationPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['org-settings'],
    queryFn: orgSettingsApi.get,
  });

  const [form, setForm] = useState<OrgFields>(EMPTY_FORM);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) {
      // Если в БД название не задано — подставляем дефолтный бренд `RentHub`,
      // чтобы пользователь сразу видел, что отображается на сайте, и мог редактировать.
      // Этот fallback совпадает с FALLBACK_NAME в PublicLayout/AdminLayout — поведение
      // согласовано: то, что пишется в input, то и видно на витрине.
      const effectiveName = data.orgShortName?.trim() || 'RentHub';
      setForm({
        orgShortName: effectiveName,
        orgPhone: data.orgPhone ?? '',
        orgEmail: data.orgEmail ?? '',
        orgAddress: data.orgAddress ?? '',
        orgHours: data.orgHours ?? '',
      });
      setDirty(false);
    }
  }, [data]);

  const update = useMutation({
    mutationFn: () => {
      // Отправляем только разрешённые ключи — backend whitelist отбраковывает лишнее.
      const payload: Partial<OrgFields> = {};
      for (const k of ORG_KEYS) payload[k] = form[k];
      return orgSettingsApi.update(payload);
    },
    onSuccess: () => {
      toast.success('Реквизиты сохранены');
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['org-settings'] });
      // Витрина (footer / страница «Контакты») кэширует контакты отдельно — сбрасываем,
      // чтобы пользователь сразу увидел новые данные без перезагрузки.
      qc.invalidateQueries({ queryKey: ['org', 'contact'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Не удалось сохранить')),
  });

  const setField = <K extends keyof OrgFields>(key: K, value: OrgFields[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  // ====== ЛОГОТИП ======
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadLogo = useMutation({
    mutationFn: (file: File) => orgSettingsApi.uploadLogo(file),
    onSuccess: () => {
      toast.success('Логотип обновлён');
      // Инвалидируем оба запроса — admin-получает org-settings, витрина — org-contact.
      qc.invalidateQueries({ queryKey: ['org-settings'] });
      qc.invalidateQueries({ queryKey: ['org-contact'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Не удалось загрузить логотип')),
  });
  const deleteLogo = useMutation({
    mutationFn: () => orgSettingsApi.deleteLogo(),
    onSuccess: () => {
      toast.success('Логотип сброшен на встроенный');
      qc.invalidateQueries({ queryKey: ['org-settings'] });
      qc.invalidateQueries({ queryKey: ['org-contact'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Не удалось сбросить логотип')),
  });
  const onLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadLogo.mutate(file);
    // Сбрасываем input чтобы при повторной загрузке того же файла снова сработал onChange.
    e.target.value = '';
  };

  if (isLoading || !data) {
    return (
      <>
        <PageHeader title="Общие" description="Название сайта и контактные данные" />
        <Skeleton className="h-96" />
      </>
    );
  }

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Общие"
        description="Название сайта и контактные данные. Подставляются в шапку сайта, страницу «Контакты» и подпись писем."
      />

      <div className="space-y-4">
        {/* === Логотип === */}
        <div className="rounded-xl border bg-surface p-5 space-y-4">
          <div className="flex items-center gap-3">
            <ImageIcon className="size-5 text-text-3" />
            <div className="flex-1">
              <h3 className="font-semibold">Логотип</h3>
              <p className="text-text-3 text-xs mt-0.5">
                Отображается в шапке витрины, админки и на странице входа. Если не загружать свой —
                используется встроенный.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="size-20 rounded-lg border bg-surface-2 grid place-items-center flex-shrink-0">
              <Logo className="size-14" />
            </div>
            <div className="flex flex-col gap-2 flex-1">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadLogo.isPending || deleteLogo.isPending}
                >
                  {uploadLogo.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  Загрузить логотип
                </Button>
                {data.logoPath && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteLogo.mutate()}
                    disabled={uploadLogo.isPending || deleteLogo.isPending}
                  >
                    {deleteLogo.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                    Сбросить на встроенный
                  </Button>
                )}
              </div>
              <p className="text-xs text-text-3">
                PNG, JPG, WebP или SVG. Максимум 2 МБ. Рекомендуется квадратное изображение.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.svg"
                className="hidden"
                onChange={onLogoFileChange}
              />
            </div>
          </div>
        </div>

        {/* === Название сайта === */}
        <div className="rounded-xl border bg-surface p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Globe className="size-5 text-text-3" />
            <div className="flex-1">
              <h3 className="font-semibold">Название сайта</h3>
              <p className="text-text-3 text-xs mt-0.5">
                Отображается в шапке сайта, во вкладке браузера и в подписи писем.
              </p>
            </div>
          </div>
          <div>
            <Label htmlFor="org-short">Название сайта</Label>
            <Input
              id="org-short"
              value={form.orgShortName}
              onChange={(e) => setField('orgShortName', e.target.value)}
              placeholder="Платформа для онлайн-аренды оборудования"
              className="mt-1.5"
            />
          </div>
        </div>

        {/* === Контакты === */}
        <div className="rounded-xl border bg-surface p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Phone className="size-5 text-text-3" />
            <div className="flex-1">
              <h3 className="font-semibold">Контакты</h3>
              <p className="text-text-3 text-xs mt-0.5">
                Видны клиентам на витрине (страница «Контакты», подвал) и в подписи писем.
              </p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="org-phone">Телефон</Label>
              <PhoneInput
                id="org-phone"
                value={form.orgPhone}
                onChange={(canonical) => setField('orgPhone', canonical)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="org-email">Email</Label>
              <div className="mt-1.5 relative">
                <AtSign className="size-4 text-text-3 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  id="org-email"
                  type="email"
                  value={form.orgEmail}
                  onChange={(e) => setField('orgEmail', e.target.value)}
                  placeholder="info@example.com"
                  className="pl-9 font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* === Адрес === */}
        <div className="rounded-xl border bg-surface p-5 space-y-3">
          <div className="flex items-center gap-3">
            <MapPin className="size-5 text-text-3" />
            <div className="flex-1">
              <h3 className="font-semibold">Адрес</h3>
              <p className="text-text-3 text-xs mt-0.5">
                Пункт выдачи / офис. Многострочное поле — можно указать ориентир, этаж и т.п.
              </p>
            </div>
          </div>
          <Textarea
            value={form.orgAddress}
            onChange={(e) => setField('orgAddress', e.target.value)}
            placeholder="г. Москва, ул. Лесная, 5, офис 12"
            rows={3}
          />
        </div>

        {/* === График работы === */}
        <div className="rounded-xl border bg-surface p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Clock className="size-5 text-text-3" />
            <div className="flex-1">
              <h3 className="font-semibold">График работы</h3>
              <p className="text-text-3 text-xs mt-0.5">
                В свободной форме — отображается на витрине и в письмах как есть.
              </p>
            </div>
          </div>
          <Textarea
            value={form.orgHours}
            onChange={(e) => setField('orgHours', e.target.value)}
            placeholder={'Пн–Пт 9:00–19:00\nСб 10:00–17:00\nВс — выходной'}
            rows={3}
          />
        </div>
      </div>

      {/* === Sticky save bar === */}
      <div className="sticky bottom-0 mt-6 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-bg/80 backdrop-blur border-t flex items-center justify-end gap-3">
        {dirty && <span className="text-xs text-text-3">Есть несохранённые изменения</span>}
        <Button onClick={() => update.mutate()} disabled={!dirty || update.isPending}>
          {update.isPending ? (
            <Loader2 className="size-4 mr-2 animate-spin" />
          ) : (
            <Save className="size-4 mr-2" />
          )}
          Сохранить
        </Button>
      </div>
    </div>
  );
}
