import { useEffect, useState } from 'react';
import { Outlet, Link, NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CartPopover } from './CartPopover';
import { CookieBanner } from './CookieBanner';
import { UserMenu } from './UserMenu';
import { Logo } from '@/components/shared/Logo';
import { useOrgContact } from '@/lib/hooks/queries';
import { useAuthStore } from '@/lib/stores/auth-store';
import { formatPhoneInput } from '@/lib/utils/phone';
import { cn } from '@/lib/utils/cn';

const FALLBACK_NAME = 'RentHub';
const FALLBACK_TAGLINE = 'аренда оборудования';

const NAV = [
  { to: '/', label: 'Главная', end: true },
  { to: '/catalog', label: 'Каталог' },
  { to: '/rental-terms', label: 'Условия аренды' },
  { to: '/contact', label: 'Контакты' },
];

export function PublicLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: contact } = useOrgContact();
  const currentUser = useAuthStore((s) => s.user);
  // Сотрудники (админ/менеджер) не пользуются клиентской корзиной — они оформляют
  // заказы через админку. Прячем иконку, чтобы не путать.
  const isStaff = currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER';

  // Единственное название бренда — используется везде (шапка, футер, подпись писем).
  // Поле orgName зарезервировано в БД под будущие печатные документы, в UI не задаётся.
  const shortName = contact?.orgShortName?.trim() || FALLBACK_NAME;
  const phoneFormatted = contact?.orgPhone ? formatPhoneInput(contact.orgPhone).trim() : '';
  const email = contact?.orgEmail?.trim() ?? '';
  const address = contact?.orgAddress?.trim() ?? '';
  const hours = contact?.orgHours?.trim() ?? '';

  // Заголовок вкладки браузера — используем краткое название организации.
  useEffect(() => {
    document.title = shortName ? `${shortName} — аренда оборудования` : `${FALLBACK_NAME} — аренда`;
  }, [shortName]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 glass border-b">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-6">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Открыть меню"
            >
              <Menu className="size-5" />
            </Button>
            <Link to="/" className="flex items-center gap-3">
              <Logo className="size-11" />
              <div className="hidden sm:block">
                <div className="font-display font-bold text-xl leading-none">{shortName}</div>
                <div className="text-xs text-text-3 leading-none mt-1">{FALLBACK_TAGLINE}</div>
              </div>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                className={({ isActive }) =>
                  cn(
                    'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'text-blue bg-blue-soft'
                      : 'text-text-2 hover:text-text hover:bg-surface-3',
                  )
                }
              >
                {it.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <UserMenu />
            {!isStaff && <CartPopover />}
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden fixed inset-0 bg-black/50 z-40"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="md:hidden fixed top-0 left-0 h-screen w-72 max-w-[85vw] bg-surface border-r z-50 flex flex-col"
            >
              <div className="h-16 flex items-center justify-between px-4 border-b">
                <Link
                  to="/"
                  className="flex items-center gap-2.5"
                  onClick={() => setMobileOpen(false)}
                >
                  <Logo className="size-10" />
                  <div className="font-display font-bold text-lg">{shortName}</div>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Закрыть меню"
                >
                  <X className="size-5" />
                </Button>
              </div>
              <nav className="flex-1 p-3 space-y-1">
                {NAV.map((it) => (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    end={it.end}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'block px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-blue text-white'
                          : 'text-text-2 hover:bg-surface-3 hover:text-text',
                      )
                    }
                  >
                    {it.label}
                  </NavLink>
                ))}
                <div className="pt-3 mt-3 border-t">
                  <NavLink
                    to="/me/profile"
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'block px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-blue text-white'
                          : 'text-text-2 hover:bg-surface-3 hover:text-text',
                      )
                    }
                  >
                    Личный кабинет
                  </NavLink>
                </div>
              </nav>
              {(phoneFormatted || hours) && (
                <div className="p-4 border-t text-xs text-text-3 space-y-1">
                  {phoneFormatted && <div>{phoneFormatted}</div>}
                  {hours && <div className="whitespace-pre-line">{hours}</div>}
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-16 border-t bg-surface">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="sm:col-span-2">
            <div className="flex items-center gap-2.5">
              <Logo className="size-9" />
              <div className="font-display font-bold text-xl">{shortName}</div>
            </div>
            <p className="mt-3 text-sm text-text-2 max-w-md">
              Аренда оборудования. Прозрачные тарифы, быстрая обработка заявок, самовывоз и
              доставка.
            </p>
          </div>
          <div>
            <div className="text-sm font-semibold mb-3">Информация</div>
            <ul className="space-y-2 text-sm text-text-2">
              <li>
                <Link to="/legal/terms" className="hover:text-text">
                  Условия использования
                </Link>
              </li>
              <li>
                <Link to="/legal/personal-data" className="hover:text-text">
                  Согласие на обработку персональных данных
                </Link>
              </li>
              <li>
                <Link to="/legal/privacy" className="hover:text-text">
                  Политика обработки персональных данных
                </Link>
              </li>
              <li>
                <Link to="/rental-terms" className="hover:text-text">
                  Условия аренды
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="text-sm font-semibold mb-3">Контакты</div>
            <ul className="space-y-2 text-sm text-text-2">
              {phoneFormatted && (
                <li>
                  <a href={`tel:${contact?.orgPhone ?? ''}`} className="hover:text-text">
                    {phoneFormatted}
                  </a>
                </li>
              )}
              {email && (
                <li>
                  <a href={`mailto:${email}`} className="hover:text-text break-all">
                    {email}
                  </a>
                </li>
              )}
              {address && <li className="whitespace-pre-line">{address}</li>}
              {hours && <li className="whitespace-pre-line text-text-3 text-xs">{hours}</li>}
              {/*
                Если контакты не заполнены — ничего не показываем посетителю.
                Раньше тут была подсказка "добавьте в админке" — это инструкция
                админу, на публичной витрине ей делать нечего.
              */}
            </ul>
          </div>
        </div>
      </footer>

      <CookieBanner />
    </div>
  );
}
