import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { orgSettingsApi } from '@/lib/api/endpoints';
import { toast } from 'sonner';

/**
 * Раздел «Публичная информация» — редактирование контента страницы "Условия аренды".
 * Это информационная страница для клиентов, не связанная с юридическими документами.
 */
export function PublicInfoPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  const { data: settings, isLoading, refetch } = useQuery({
    queryKey: ['org-settings'],
    queryFn: () => orgSettingsApi.get(),
  });

  // Синхронизируем локальное состояние с загруженными данными
  // Но НЕ сбрасываем isDirty, если пользователь уже начал редактировать
  useEffect(() => {
    if (settings && !isDirty) {
      setTitle(settings.rentalTermsTitle || 'Условия аренды');
      setContent(settings.rentalTermsContent || '');
    }
  }, [settings, isDirty]);

  const saveMutation = useMutation({
    mutationFn: () =>
      orgSettingsApi.update({ rentalTermsTitle: title, rentalTermsContent: content }),
    onSuccess: () => {
      // Явно обновляем кэш с новыми данными
      queryClient.setQueryData(['rental-terms'], { title, content });
      queryClient.invalidateQueries({ queryKey: ['org-settings'] });
      refetch();
      setIsDirty(false);
      toast.success('Условия аренды сохранены');
    },
    onError: () => {
      toast.error('Не удалось сохранить изменения');
    },
  });

  const handleTitleChange = (value: string) => {
    setTitle(value);
    setIsDirty(true);
  };

  const handleContentChange = (html: string) => {
    // Удаляем пустые теги (TipTap оставляет <p><br></p> когда редактор пустой)
    const cleaned = html.replace(/<p><br><\/p>/g, '').trim();
    setContent(cleaned);
    setIsDirty(true);
  };

  const handleSave = () => {
    saveMutation.mutate();
  };

  return (
    <>
      <PageHeader
        title="Публичная информация"
        description="Информационные страницы для клиентов: условия аренды, описание процессов, правила работы."
      />

      <div className="space-y-6">
        <div className="rounded-xl border bg-surface p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="font-semibold text-lg">Условия аренды</h2>
              <p className="text-sm text-text-3 mt-1">
                Информационная страница для клиентов витрины. Опишите процесс аренды, правила
                работы, требования к клиентам и другую полезную информацию.
              </p>
            </div>
            <Button
              onClick={handleSave}
              disabled={!isDirty || saveMutation.isPending || isLoading}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  Сохранить
                </>
              )}
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <div className="h-10 rounded-md bg-surface-2 animate-pulse" />
              <div className="h-[400px] rounded-md bg-surface-2 animate-pulse" />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="rental-terms-title">Заголовок</Label>
                <Input
                  id="rental-terms-title"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Условия аренды"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label>Содержимое</Label>
                <div className="mt-1.5">
                  <RichTextEditor
                    value={content}
                    onChange={handleContentChange}
                    placeholder="Введите текст страницы..."
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-blue-soft border-blue/20 p-4">
          <p className="text-sm text-blue-dark">
            <strong>Примечание:</strong> Здесь вы редактируете контент информационной страницы
            «Условия аренды», которая отображается на витрине для всех посетителей. Опишите
            процесс аренды, требования к клиентам, правила возврата оборудования и другую
            полезную информацию о работе вашего сервиса.
          </p>
        </div>
      </div>
    </>
  );
}
