import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { orgSettingsApi } from '@/lib/api/endpoints';
import { useOrgContact } from '@/lib/hooks/queries';

export function RentalTermsPage() {
  const { data: orgContact } = useOrgContact();
  const brandName = orgContact?.orgShortName?.trim() || 'RentHub';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['rental-terms'],
    queryFn: () => orgSettingsApi.rentalTerms(),
  });

  const pageTitle = data?.title || 'Условия аренды';

  useEffect(() => {
    const original = document.title;
    document.title = `${pageTitle} — ${brandName}`;
    return () => {
      document.title = original;
    };
  }, [pageTitle, brandName]);

  return (
    <>
      {isLoading && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-64 mt-6" />
          </div>
        </div>
      )}

      {isError && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="rounded-xl border bg-surface p-6 flex items-start gap-3">
            <AlertTriangle className="size-5 text-status-overdue flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold">Не удалось загрузить страницу</h2>
              <p className="text-sm text-text-3 mt-1">Попробуйте обновить страницу позже.</p>
            </div>
          </div>
        </div>
      )}

      {data && (
        <article className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <h1 className="font-display font-bold text-3xl sm:text-4xl mb-6">{pageTitle}</h1>
          {data.content.trim() ? (
            <div
              className="max-w-none [&_h2]:font-bold [&_h2]:text-xl [&_h2]:mt-6 [&_h2]:mb-3 [&_h3]:font-semibold [&_h3]:text-lg [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:mb-3 [&_li]:ml-5 [&_ul]:list-disc [&_ol]:list-decimal"
              dangerouslySetInnerHTML={{ __html: data.content }}
            />
          ) : (
            <p className="text-text-3">Информация отсутствует.</p>
          )}
        </article>
      )}
    </>
  );
}
