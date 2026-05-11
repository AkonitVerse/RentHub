import { Outlet, NavLink } from 'react-router-dom';
import { Boxes, FolderTree, Layers, Package } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const TABS: { to: string; label: string; Icon: LucideIcon }[] = [
  { to: '/admin/equipment/catalog', label: 'Каталог', Icon: Package },
  { to: '/admin/equipment/stock', label: 'Инвентарь', Icon: Boxes },
  { to: '/admin/equipment/categories', label: 'Категории', Icon: FolderTree },
  { to: '/admin/equipment/pricing', label: 'Тарифы', Icon: Layers },
];

/**
 * Объединённый раздел «Оборудование» — табы Каталог / Инвентарь / Категории / Тарифы.
 * Дочерние страницы рендерят свои PageHeader с локальным заголовком и actions.
 */
export function EquipmentLayout() {
  return (
    <div>
      <nav className="flex gap-1 border-b mb-6 -mx-1 px-1 flex-wrap">
        {TABS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={false}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-blue text-blue'
                  : 'border-transparent text-text-2 hover:text-text hover:border-border-2',
              )
            }
          >
            <Icon className="size-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
