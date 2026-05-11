import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, type RegisterInput } from '../api/endpoints';
import type { User } from '../api/types';

/**
 * Результат регистрации:
 *  - requiresVerification:true → SMTP настроен, код отправлен на email,
 *    фронт ведёт на /verify-email. User в БД ещё не создан, появится только
 *    после ввода правильного кода.
 *  - requiresVerification:false → SMTP не настроен на платформе, бэк создал
 *    User напрямую и выдал JWT-cookies. Фронт сразу делает редирект на
 *    landing-страницу по роли.
 */
export type RegisterResult =
  | { requiresVerification: true; email: string }
  | { requiresVerification: false; user: User };

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: RegisterInput) => Promise<RegisterResult>;
  /** Подтверждение email кодом — создаёт User в БД и логинит. */
  verifyEmail: (email: string, code: string) => Promise<User>;
  /** Переотправка кода подтверждения на email. */
  resendVerification: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  setUser: (u: User | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,
      isInitialized: false,
      setUser: (u) => set({ user: u }),
      login: async (email, password) => {
        set({ isLoading: true });
        try {
          await authApi.login(email, password);
          const me = await authApi.me();
          set({ user: me, isInitialized: true });
          return me;
        } finally {
          set({ isLoading: false });
        }
      },
      register: async (data) => {
        set({ isLoading: true });
        try {
          // Бэк отвечает по-разному в зависимости от того, настроен ли SMTP:
          //  - настроен → создаёт pending + код, возвращает {requiresVerification:true,email}
          //  - не настроен → создаёт User сразу + JWT-cookies, возвращает {requiresVerification:false,...}
          const result = await authApi.register(data);
          if (result.requiresVerification) {
            return { requiresVerification: true, email: result.email };
          }
          // SMTP off — User уже залогинен на бэке через cookies. Достаём
          // полные данные и сохраняем в стор, чтобы интерфейс сразу обновился.
          const me = await authApi.me();
          set({ user: me, isInitialized: true });
          return { requiresVerification: false, user: me };
        } finally {
          set({ isLoading: false });
        }
      },
      verifyEmail: async (email, code) => {
        set({ isLoading: true });
        try {
          // Бэк проверяет код, создаёт User, выдаёт JWT в cookie.
          await authApi.verifyEmail(email, code);
          const me = await authApi.me();
          set({ user: me, isInitialized: true });
          return me;
        } finally {
          set({ isLoading: false });
        }
      },
      resendVerification: async (email) => {
        await authApi.resendVerification(email);
      },
      logout: async () => {
        try {
          await authApi.logout();
        } catch {
          /* ignore */
        }
        set({ user: null });
      },
      fetchMe: async () => {
        set({ isLoading: true });
        try {
          const me = await authApi.me();
          set({ user: me, isInitialized: true });
        } catch {
          set({ user: null, isInitialized: true });
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'renthub-auth',
      partialize: (s) => ({ user: s.user }),
    },
  ),
);

/**
 * Куда отправлять пользователя после успешного логина — определяется ролью.
 * - ADMIN  → /admin/overview (бизнес-метрики)
 * - MANAGER → /admin/today    (операционный воркстейшен)
 * - USER   → /me/profile      (личный кабинет клиента)
 */
export function landingPathForRole(role: User['role']): string {
  if (role === 'ADMIN') return '/admin/overview';
  if (role === 'MANAGER') return '/admin/today';
  return '/me/profile';
}
