import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils/cn';
import { orgSettingsApi } from '@/lib/api/endpoints';

type LogoProps = {
  className?: string;
  /** Aria-label для скринридеров. По умолчанию — «Логотип». */
  label?: string;
};

/**
 * Логотип платформы. Если в OrgSettings задан кастомный логотип
 * (загружен через «Настройки → Общие») — рисуется он. Иначе — встроенный
 * SVG-куб как дефолт.
 *
 * Запрашивает публичный эндпоинт `/org-settings/contact` (без авторизации),
 * чтобы работать в том числе на витрине и странице логина для гостей.
 * Кэшируется TanStack Query — один сетевой запрос на сессию.
 */
export function Logo({ className, label = 'Логотип' }: LogoProps) {
  const { data } = useQuery({
    queryKey: ['org-contact'],
    queryFn: orgSettingsApi.contact,
    staleTime: 5 * 60_000, // 5 минут — логотип меняется редко
  });

  if (data?.logoPath) {
    return (
      <img src={data.logoPath} alt={label} className={cn('size-9 object-contain', className)} />
    );
  }

  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn('size-9', className)} aria-label={label}>
      <polygon
        points="16,2 28,9 28,23 16,30 4,23 4,9"
        stroke="#c0c0c0"
        strokeWidth="1.5"
        fill="none"
      />
      <polygon points="16,10 24,14.5 16,19 8,14.5" fill="#4a4a4a" />
      <polygon points="16,19 24,14.5 24,22 16,26.5" fill="#2a2a2a" />
      <polygon points="16,19 8,14.5 8,22 16,26.5" fill="#383838" />
    </svg>
  );
}
