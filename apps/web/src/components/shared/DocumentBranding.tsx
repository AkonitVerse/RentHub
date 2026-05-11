import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { orgSettingsApi } from '@/lib/api/endpoints';

/**
 * Синхронизирует <title> вкладки и favicon с настройками платформы из
 * OrgSettings. Дефолты — встроенные в index.html (RentHub + /favicon.svg).
 *
 * Логика:
 *  - Название вкладки: «{orgShortName} — аренда оборудования». Если поле в
 *    БД пустое — fallback на «RentHub», как в остальных местах (Logo, email).
 *  - Favicon: если загружен кастомный логотип (`logoPath`) — используем его,
 *    иначе оставляем дефолтный /favicon.svg.
 *
 * Компонент ничего не рендерит, монтируется один раз в App.tsx.
 * Запрос /org-settings/contact публичный — работает в том числе для гостей
 * на витрине и странице логина.
 */
export function DocumentBranding() {
  const { data } = useQuery({
    queryKey: ['org-contact'],
    queryFn: orgSettingsApi.contact,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!data) return;

    // === <title> ===
    const brand = data.orgShortName?.trim() || 'RentHub';
    document.title = `${brand} — аренда оборудования`;

    // === favicon ===
    // Меняем href у <link rel="icon">. Если кастомного логотипа нет —
    // возвращаем встроенный /favicon.svg (актуально если сначала был
    // кастомный, потом юзер сбросил).
    const iconHref = data.logoPath ?? '/favicon.svg';
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    if (link.getAttribute('href') !== iconHref) {
      link.setAttribute('href', iconHref);
      // Тип нужно убрать когда грузим png/jpg вместо svg, иначе браузер
      // может проигнорировать иконку из-за несоответствия Content-Type.
      if (data.logoPath) {
        link.removeAttribute('type');
      } else {
        link.setAttribute('type', 'image/svg+xml');
      }
    }
  }, [data]);

  return null;
}
