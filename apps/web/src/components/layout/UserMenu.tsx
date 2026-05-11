import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LayoutDashboard, LogIn, LogOut, Store, User as UserIcon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/lib/stores/auth-store';

export function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const inAdmin = location.pathname.startsWith('/admin');

  if (!user) {
    return (
      <Link
        to="/login"
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface hover:bg-surface-2 px-2 py-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/40"
      >
        <span className="size-7 rounded-full bg-surface-3 grid place-items-center text-text-2">
          <LogIn className="size-3.5" strokeWidth={2.2} />
        </span>
        <span className="hidden md:block text-sm font-medium pr-1">Авторизация</span>
      </Link>
    );
  }

  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isStaff = user.role === 'ADMIN' || user.role === 'MANAGER';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface hover:bg-surface-2 px-2 py-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/40">
          <Avatar className="size-7">
            <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden md:block text-sm font-medium max-w-[120px] truncate">
            {user.name}
          </span>
          <ChevronDown className="size-3.5 text-text-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="font-medium text-text text-sm normal-case tracking-normal">
            {user.name}
          </div>
          <div className="text-xs text-text-3 font-mono mt-0.5 normal-case tracking-normal">
            {user.email}
          </div>
          <div className="text-xs text-text-4 mt-0.5 normal-case tracking-normal">
            {user.role === 'ADMIN'
              ? 'Администратор'
              : user.role === 'MANAGER'
                ? 'Менеджер'
                : 'Клиент'}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* Личный профиль — для всех ролей. Здесь можно сменить email / пароль. */}
        <DropdownMenuItem asChild>
          <Link to="/me/profile" className="cursor-pointer">
            <UserIcon className="size-4" />
            {isStaff ? 'Мой профиль' : 'Личный кабинет'}
          </Link>
        </DropdownMenuItem>
        {isStaff && inAdmin && (
          <DropdownMenuItem asChild>
            <Link to="/" className="cursor-pointer">
              <Store className="size-4" />
              Открыть витрину
            </Link>
          </DropdownMenuItem>
        )}
        {isStaff && !inAdmin && (
          <DropdownMenuItem asChild>
            <Link to="/admin" className="cursor-pointer">
              <LayoutDashboard className="size-4" />
              Админ-панель
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer text-status-overdue focus:text-status-overdue"
        >
          <LogOut className="size-4" />
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
