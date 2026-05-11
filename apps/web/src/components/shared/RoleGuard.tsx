import type { ReactNode } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { User } from '@/lib/api/types';

interface RoleGuardProps {
  /** Минимально допустимая роль (по умолчанию 'ADMIN'). */
  role?: User['role'];
  /** 'hide' — не рендерить детей; 'disable' — рендерить как disabled с tooltip. По умолчанию 'hide'. */
  mode?: 'hide' | 'disable';
  children: ReactNode;
  fallback?: ReactNode;
  /** Подсказка для mode='disable' (вешается через title). */
  tooltip?: string;
}

/**
 * Скрывает или disablit детей в зависимости от роли пользователя.
 * Используется для admin-only кнопок и секций (Удалить, Управление пользователями и т.д.).
 */
export function RoleGuard({
  role = 'ADMIN',
  mode = 'hide',
  children,
  fallback = null,
  tooltip,
}: RoleGuardProps) {
  const user = useAuthStore((s) => s.user);
  const allowed = user?.role === role;

  if (allowed) return <>{children}</>;
  if (mode === 'hide') return <>{fallback}</>;

  return (
    <span
      className="opacity-50 pointer-events-none select-none"
      title={tooltip ?? 'Доступно только администратору'}
      aria-disabled
    >
      {children}
    </span>
  );
}
