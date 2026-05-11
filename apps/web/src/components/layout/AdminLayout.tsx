import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarHeart,
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  Calendar,
  BarChart3,
  Settings,
  Menu,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { notificationsApi } from '@/lib/api/endpoints';
import { useOrgContact } from '@/lib/hooks/queries';
import { Logo } from '@/components/shared/Logo';
import { QuickCreateMenu } from '@/components/shared/QuickCreateMenu';
import { UserMenu } from '@/components/layout/UserMenu';
import { cn } from '@/lib/utils/cn';
import type { User } from '@/lib/api/types';

interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
  badge?: 'overdue';
  /** Подсветка активного пункта по startsWith — для разделов с подмаршрутами. */
  matchPrefix?: string;
}

const MANAGER_NAV: NavItem[] = [
  { to: '/admin/today', label: 'Сегодня', Icon: CalendarHeart },
  {
    to: '/admin/orders',
    label: 'Заказы',
    Icon: ShoppingBag,
    badge: 'overdue',
    matchPrefix: '/admin/orders',
  },
  { to: '/admin/equipment', label: 'Оборудование', Icon: Package, matchPrefix: '/admin/equipment' },
  { to: '/admin/customers', label: 'Клиенты', Icon: Users, matchPrefix: '/admin/customers' },
  { to: '/admin/calendar', label: 'Календарь', Icon: Calendar },
];

const ADMIN_NAV: NavItem[] = [
  { to: '/admin/overview', label: 'Обзор', Icon: LayoutDashboard },
  {
    to: '/admin/orders',
    label: 'Заказы',
    Icon: ShoppingBag,
    badge: 'overdue',
    matchPrefix: '/admin/orders',
  },
  { to: '/admin/equipment', label: 'Оборудование', Icon: Package, matchPrefix: '/admin/equipment' },
  { to: '/admin/customers', label: 'Клиенты', Icon: Users, matchPrefix: '/admin/customers' },
  { to: '/admin/calendar', label: 'Календарь', Icon: Calendar },
  { to: '/admin/analytics', label: 'Аналитика', Icon: BarChart3, matchPrefix: '/admin/analytics' },
  { to: '/admin/settings', label: 'Настройки', Icon: Settings, matchPrefix: '/admin/settings' },
];

function getNav(role: User['role'] | undefined): NavItem[] {
  if (role === 'ADMIN') return ADMIN_NAV;
  return MANAGER_NAV;
}

export function AdminLayout() {
  const user = useAuthStore((s) => s.user);
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = useMemo(() => getNav(user?.role), [user?.role]);

  const { data: orgContact } = useOrgContact();
  const brandName = orgContact?.orgShortName?.trim() || 'RentHub';

  const { data: overdue } = useQuery({
    queryKey: ['notifications', 'overdue', 'count'],
    queryFn: notificationsApi.overdueCount,
    refetchInterval: 60_000,
  });

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="min-h-screen flex bg-bg">
      {/* === SIDEBAR === */}
      <aside
        className={cn(
          'hidden md:flex flex-col fixed top-0 left-0 h-screen border-r bg-surface z-30 transition-all duration-200',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <div
          className={cn(
            'h-16 flex items-center border-b',
            collapsed ? 'justify-center px-2' : 'px-4',
          )}
        >
          <Link to="/admin" className="flex items-center gap-2.5 min-w-0">
            <Logo className="size-9 flex-shrink-0" />
            {!collapsed && (
              <div className="font-display font-bold text-lg leading-none truncate">
                {brandName}
              </div>
            )}
          </Link>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {nav.map((it) => (
            <NavLinkItem
              key={it.to}
              item={it}
              collapsed={collapsed}
              overdueCount={overdue?.count ?? 0}
            />
          ))}
        </nav>
        <div className="border-t p-2">
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs text-text-3 hover:bg-surface-3"
          >
            <Menu className="size-4" />
            {!collapsed && <span>Свернуть</span>}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 bg-black/50 z-40"
              onClick={closeMobile}
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="md:hidden fixed top-0 left-0 h-screen w-64 bg-surface border-r z-50 flex flex-col"
            >
              <div className="h-16 flex items-center px-4 border-b">
                <Link to="/admin" className="flex items-center gap-2.5" onClick={closeMobile}>
                  <Logo className="size-9" />
                  <div className="font-display font-bold text-lg">{brandName}</div>
                </Link>
              </div>
              <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                {nav.map((it) => (
                  <NavLinkItem
                    key={it.to}
                    item={it}
                    collapsed={false}
                    overdueCount={overdue?.count ?? 0}
                    onNavigate={closeMobile}
                  />
                ))}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* === CONTENT === */}
      <div
        className={cn(
          'flex-1 min-w-0 transition-[margin] duration-200',
          collapsed ? 'md:ml-16' : 'md:ml-60',
        )}
      >
        <header className="sticky top-0 z-20 h-16 glass border-b flex items-center justify-between px-4 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </Button>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <QuickCreateMenu />
            <div className="pl-2 sm:pl-3 sm:border-l">
              <UserMenu />
            </div>
          </div>
        </header>
        <div className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

interface NavLinkItemProps {
  item: NavItem;
  collapsed: boolean;
  overdueCount: number;
  onNavigate?: () => void;
}

function NavLinkItem({ item, collapsed, overdueCount, onNavigate }: NavLinkItemProps) {
  const { to, label, Icon, badge, matchPrefix } = item;
  const location = useLocation();
  const isActive = matchPrefix
    ? location.pathname.startsWith(matchPrefix)
    : location.pathname === to;

  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={cn(
        'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActive ? 'bg-blue text-white' : 'text-text-2 hover:bg-surface-3 hover:text-text',
        collapsed && 'justify-center px-2',
      )}
      title={collapsed ? label : undefined}
    >
      <Icon className="size-4 flex-shrink-0" />
      {!collapsed && <span className="truncate flex-1">{label}</span>}
      {badge === 'overdue' && overdueCount > 0 && !collapsed && (
        <Badge variant="destructive" className="ml-auto px-1.5 py-0 h-5 text-[10px]">
          {overdueCount}
        </Badge>
      )}
      {badge === 'overdue' && overdueCount > 0 && collapsed && (
        <span className="absolute top-0.5 right-0.5 size-2 rounded-full bg-status-overdue" />
      )}
    </NavLink>
  );
}
