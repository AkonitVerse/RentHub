import { useEffect, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ExternalLink, FileText, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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
import { legalApi } from '@/lib/api/endpoints';
import { apiErrorMessage } from '@/lib/api/client';

const SLUGS = ['terms', 'personal-data', 'privacy'];

export function LegalPage() {
  const [activeSlug, setActiveSlug] = useState<string>(SLUGS[0]);
  // Куда хочет переключиться пользователь, если в текущем документе есть несохранённые
  // изменения — после подтверждения совершаем переход.
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: list } = useQuery({
    queryKey: ['legal', 'list'],
    queryFn: legalApi.list,
  });

  const { data: doc, isLoading } = useQuery({
    queryKey: ['legal', activeSlug],
    queryFn: () => legalApi.get(activeSlug),
    // Не показывать прошлые данные (другого документа), пока грузится новый.
    placeholderData: undefined,
  });

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [dirty, setDirty] = useState(false);

  // Блокируем навигацию по приложению (например, клик на «Пользователи» в боковом
  // меню), если есть несохранённые правки — открываем то же самое модальное окно.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );

  // Защита от закрытия вкладки / перезагрузки страницы с несохранёнными правками.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // современные браузеры покажут стандартный системный диалог
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // При смене активного документа сразу очищаем поля, чтобы не мелькал
  // прошлый текст до загрузки нового.
  useEffect(() => {
    setTitle('');
    setContent('');
    setDirty(false);
  }, [activeSlug]);

  // Когда новые данные пришли — заполняем поля.
  useEffect(() => {
    if (doc && doc.slug === activeSlug) {
      setTitle(doc.title);
      setContent(doc.content);
      setDirty(false);
    }
  }, [doc, activeSlug]);

  const update = useMutation({
    mutationFn: () => legalApi.update(activeSlug, { title, content }),
    onSuccess: () => {
      toast.success('Документ сохранён');
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['legal'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Не удалось сохранить')),
  });

  return (
    <>
      <PageHeader
        title="Правовая информация"
        description="Условия использования, согласие на обработку персональных данных, политика обработки персональных данных. Текст показывается клиентам на витрине."
      />

      <div className="grid lg:grid-cols-[240px_1fr] gap-4">
        {/* Список документов */}
        <nav className="rounded-xl border bg-surface p-2 h-fit">
          {(list ?? SLUGS.map((s) => ({ slug: s, title: '...', updatedAt: '' }))).map((d) => (
            <button
              key={d.slug}
              type="button"
              onClick={() => {
                if (d.slug === activeSlug) return;
                if (dirty) {
                  setPendingSlug(d.slug);
                  return;
                }
                setActiveSlug(d.slug);
              }}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors flex items-start gap-2 ${
                activeSlug === d.slug
                  ? 'bg-blue/15 text-blue font-medium'
                  : 'hover:bg-surface-2 text-text'
              }`}
            >
              <FileText className="size-4 flex-shrink-0 mt-0.5" />
              <span className="flex-1 leading-tight">{d.title || d.slug}</span>
            </button>
          ))}
        </nav>

        {/* Редактор */}
        <div className="rounded-xl border bg-surface p-5 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-96" />
            </div>
          ) : doc ? (
            <>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <Label htmlFor="legal-title">Заголовок</Label>
                  <Input
                    id="legal-title"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setDirty(true);
                    }}
                    className="mt-1.5"
                  />
                </div>
                <div className="flex flex-col gap-1 pt-5">
                  <Button
                    asChild={!dirty}
                    variant="outline"
                    size="sm"
                    onClick={
                      dirty
                        ? () =>
                            toast.warning(
                              'На сайте отображается сохранённая версия. Сохраните правки, чтобы увидеть их там.',
                            )
                        : undefined
                    }
                    title={dirty ? 'Сохраните правки, чтобы увидеть их на сайте' : undefined}
                  >
                    {dirty ? (
                      <>
                        <ExternalLink className="size-4" /> Посмотреть на сайте
                      </>
                    ) : (
                      <a href={`/legal/${doc.slug}`} target="_blank" rel="noopener">
                        <ExternalLink className="size-4" /> Посмотреть на сайте
                      </a>
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <Label className="block mb-1.5">Содержимое</Label>
                <RichTextEditor
                  // key=slug — пересоздаём редактор при смене документа,
                  // иначе TipTap может оставить хвосты прошлого содержимого.
                  key={activeSlug}
                  value={content}
                  onChange={(html) => {
                    setContent(html);
                    setDirty(true);
                  }}
                />
                <p className="text-xs text-text-3 mt-2">
                  Используйте панель сверху для форматирования: заголовки, списки, ссылки.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <p className="text-xs text-text-3">
                  Обновлено: {new Date(doc.updatedAt).toLocaleString('ru-RU')}
                  {dirty && (
                    <span className="ml-2 text-amber-700 font-medium">
                      • есть несохранённые изменения
                    </span>
                  )}
                </p>
                <Button
                  onClick={() => update.mutate()}
                  disabled={!dirty || update.isPending || !title.trim()}
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
          ) : null}
        </div>
      </div>

      {/* Подтверждение перехода с несохранёнными изменениями */}
      <Dialog open={!!pendingSlug} onOpenChange={(o) => !o && setPendingSlug(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-600" />
              Несохранённые изменения
            </DialogTitle>
            <DialogDescription>
              В текущем документе есть правки, которые ещё не сохранены. Если перейти к другому
              документу — изменения будут потеряны.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPendingSlug(null)}>
              Остаться
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingSlug) setActiveSlug(pendingSlug);
                setPendingSlug(null);
              }}
            >
              Перейти и потерять правки
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Подтверждение ухода со страницы (клик по другому пункту меню админки и т.п.) */}
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
              На странице есть несохранённые правки документа. Если уйти — они будут потеряны.
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
    </>
  );
}
