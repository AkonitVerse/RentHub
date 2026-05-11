import { useAuthStore } from '@/lib/stores/auth-store';

/** Текущий пользователь */
export const useCurrentUser = () => useAuthStore((s) => s.user);

/** true если ADMIN */
export const useIsAdmin = () => useAuthStore((s) => s.user?.role === 'ADMIN');

/** true если ADMIN или MANAGER */
export const useIsStaff = () =>
  useAuthStore((s) => s.user?.role === 'ADMIN' || s.user?.role === 'MANAGER');

/** Текстовое описание роли */
export const roleLabel = (role?: string): string => {
  switch (role) {
    case 'ADMIN':
      return 'Администратор';
    case 'MANAGER':
      return 'Менеджер';
    case 'USER':
      return 'Клиент';
    default:
      return '—';
  }
};
