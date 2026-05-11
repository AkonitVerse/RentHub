import { Outlet, NavLink, Link } from 'react-router-dom';
import { AlertTriangle, ShieldCheck, Bell, Settings, FileText, Info, Mail } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useOrgContact } from '@/lib/hooks/queries';
import { cn } from '@/lib/utils/cn';

const SECTIONS: { to: string; label: string; Icon: LucideIcon }[] = [
  { to: '/admin/settings/organization', label: 'Общие', Icon: Settings },
  { to: '/admin/settings/users', label: 'Сотрудники', Icon: ShieldCheck },
  { to: '/admin/settings/notifications', label: 'Уведомления', Icon: Bell },
  { to: '/admin/settings/email-templates', label: 'Шаблоны писем', Icon: Mail },
  { to: '/admin/settings/public', label: 'Публичная информация', Icon: Info },
  { to: '/admin/settings/legal', label: 'Правовая информация', Icon: FileText },
];

/**
 * Layout раздела «Настройки» с боковой подменюшкой.
 * Доступен только администратору (RequireRole оборачивает целиком).
 */
export function SettingsLayout() {
  const { data: orgContact } = useOrgContact();
  const verificationOff = orgContact?.emailVerificationEnabled === false;

  return (
    <div className="flex flex-col gap-4">
      {/*
        Баннер о выключенной email-верификации показываем только в разделе
        «Настройки» — здесь админ всё равно настраивает SMTP, баннер служит
        напоминанием прямо в контексте. На остальных страницах админки не
        дёргаем глаз.
      */}
      {verificationOff && (
        <div className="rounded-lg border border-status-overdue/30 bg-status-overdue/10 p-3 sm:p-4">
          <div className="flex items-start gap-3 text-sm">
            <AlertTriangle className="size-5 text-status-overdue flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-status-overdue">
              <span className="font-semibold">Email верификация отключена</span> — настройте SMTP,
              чтобы включить безопасную регистрацию и восстановление пароля.
            </div>
            <Link
              to="/admin/settings/notifications"
              className="text-status-overdue font-medium hover:underline whitespace-nowrap"
            >
              Настроить SMTP →
            </Link>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Сайдбар «всегда на одном месте». Точная привязка чтобы НЕ двигался:
            - top-24 (96px) = высота шапки h-16 (64px) + lg-padding p-8 (32px).
              Изначально aside рисуется на 96px от viewport top. Если sticky
              top тоже 96px, условие «прилипания» выполнено сразу — aside
              никогда не сдвигается со страницей.
            - lg:self-start: не растягивается по высоте flex-row.
            - lg:max-h + overflow-y-auto: если пунктов станет очень много —
              скролл внутри aside, не выталкивание контента. */}
        <aside className="lg:w-56 flex-shrink-0 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <div className="text-xs uppercase tracking-wide text-text-3 font-medium mb-3 px-1">
            Настройки
          </div>
          <nav className="flex lg:flex-col gap-1 overflow-x-auto -mx-1 px-1 lg:mx-0 lg:px-0">
            {SECTIONS.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors',
                    isActive
                      ? 'bg-blue text-white'
                      : 'text-text-2 hover:bg-surface-3 hover:text-text',
                  )
                }
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>
        {/* Ширину каждая страница задаёт сама — формам нужна узкая (~900px,
          чтобы поля не растягивались), а WYSIWYG-редакторам (шаблоны писем,
          юр. документы) — полная ширина для удобной работы с контентом. */}
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
