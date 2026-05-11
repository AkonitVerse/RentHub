import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';

/**
 * Гард для всей staff-зоны (/admin/*). Пускает ADMIN и MANAGER.
 * Клиенты (USER) перенаправляются на /me/profile, неавторизованные — на /login.
 */
export function RequireStaff({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const isLoading = useAuthStore((s) => s.isLoading);
  const location = useLocation();

  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="size-8 animate-spin text-blue" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    return <Navigate to="/me/profile" replace />;
  }

  return <>{children}</>;
}
