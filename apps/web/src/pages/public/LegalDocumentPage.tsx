import { useEffect } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { legalApi } from '@/lib/api/endpoints';
import { useOrgContact } from '@/lib/hooks/queries';

const ALLOWED_SLUGS = ['terms', 'personal-data', 'privacy'];

const RELATED: Array<{ slug: string; label: string }> = [
  { slug: 'terms', label: 'Условия использования' },
  { slug: 'personal-data', label: 'Согласие на обработку персональных данных' },
  { slug: 'privacy', label: 'Политика обработки персональных данных' },
];

export function LegalDocumentPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: orgContact } = useOrgContact();
  const brandName = orgContact?.orgShortName?.trim() || 'RentHub';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['legal', slug],
    queryFn: () => legalApi.get(slug!),
    enabled: !!slug && ALLOWED_SLUGS.includes(slug),
  });

  useEffect(() => {
    const original = document.title;
    if (data?.title) document.title = `${data.title} — ${brandName}`;
    return () => {
      document.title = original;
    };
  }, [data?.title, brandName]);

  if (slug && !ALLOWED_SLUGS.includes(slug)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-64 mt-6" />
        </div>
      )}

      {isError && (
        <div className="rounded-xl border bg-surface p-6 flex items-start gap-3">
          <AlertTriangle className="size-5 text-status-overdue flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold">Не удалось загрузить документ</h2>
            <p className="text-sm text-text-3 mt-1">Попробуйте обновить страницу позже.</p>
          </div>
        </div>
      )}

      {data && (
        <div className="grid lg:grid-cols-[1fr_260px] gap-8 lg:gap-12">
          <article className="min-w-0">
            <h1 className="font-display font-bold text-3xl sm:text-4xl mb-6">{data.title}</h1>
            <div
              className="prose prose-sm sm:prose max-w-none"
              // Контент приходит из админки и проверяется при сохранении.
              dangerouslySetInnerHTML={{ __html: data.content }}
            />
          </article>

          {/* Связанные документы — sticky-сайдбар, чтобы быстро прыгнуть в другой документ */}
          <aside className="lg:sticky lg:top-20 lg:self-start order-first lg:order-last">
            <div className="rounded-xl border bg-surface p-2">
              <nav className="flex flex-col gap-1">
                {RELATED.map((r) => {
                  const isActive = r.slug === data.slug;
                  return (
                    <Link
                      key={r.slug}
                      to={`/legal/${r.slug}`}
                      // replace: переключение между документами не плодит историю —
                      // системная «назад» в браузере вернёт пользователя туда, откуда
                      // он вообще пришёл на эту страницу, а не будет крутить по доками.
                      replace
                      aria-current={isActive ? 'page' : undefined}
                      className={
                        isActive
                          ? 'rounded-md px-3 py-2 text-sm font-medium bg-blue-soft text-blue cursor-default'
                          : 'rounded-md px-3 py-2 text-sm text-text-2 hover:bg-surface-3 hover:text-text transition-colors'
                      }
                    >
                      {r.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
