import { Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { User } from '@/lib/api/types';

/**
 * Точечный гард для admin-only веток внутри /admin (Аналитика, Настройки, Обзор).
 * Менеджер — редирект на /admin/today + toast. RequireStaff уже отфильтровал клиентов.
 */
export function RequireRole({
  role,
  children,
  fallback = '/admin/today',
}: {
  role: User['role'];
  children: React.ReactNode;
  fallback?: string;
}) {
  const user = useAuthStore((s) => s.user);
  const allowed = user?.role === role;

  useEffect(() => {
    if (user && !allowed) {
      toast.error('Раздел доступен только администратору');
    }
  }, [user, allowed]);

  if (!user) return null; // RequireStaff обязан был отработать раньше
  if (!allowed) return <Navigate to={fallback} replace />;
  return <>{children}</>;
}
