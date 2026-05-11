import { useQuery } from '@tanstack/react-query';
import { ExternalLink, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { legalApi } from '@/lib/api/endpoints';

interface LegalDocDialogProps {
  slug: string | null;
  onClose: () => void;
}

/**
 * Модальное окно с юр-документом. Используется в формах (регистрация, оформление
 * заказа) — клик по ссылке открывает документ поверх формы, ввод не теряется.
 */
export function LegalDocDialog({ slug, onClose }: LegalDocDialogProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['legal', slug],
    queryFn: () => legalApi.get(slug!),
    enabled: !!slug,
  });

  return (
    <Dialog open={!!slug} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{data?.title ?? 'Загрузка…'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 border-y py-4">
          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-32 mt-4" />
            </div>
          )}

          {isError && (
            <div className="flex items-start gap-3 text-sm">
              <AlertTriangle className="size-5 text-status-overdue flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Не удалось загрузить документ</p>
                <p className="text-text-3 mt-1">
                  Попробуйте позже или откройте на отдельной странице.
                </p>
              </div>
            </div>
          )}

          {data && (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: data.content }}
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          {data && (
            <Button asChild variant="ghost" size="sm">
              <a href={`/legal/${data.slug}`} target="_blank" rel="noopener">
                <ExternalLink className="size-4" /> Открыть в новой вкладке
              </a>
            </Button>
          )}
          <Button onClick={onClose} className="ml-auto">
            Закрыть
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
