import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/stores/auth-store';
import { landingPathForRole } from '@/lib/stores/auth-store';

/**
 * Редиректит /admin → /admin/today (manager) или /admin/overview (admin).
 * RequireStaff обязан был отработать раньше — здесь user точно есть.
 */
export function AdminRoleRedirect() {
  const user = useAuthStore((s) => s.user);
  const target = user ? landingPathForRole(user.role) : '/login';
  return <Navigate to={target} replace />;
}
