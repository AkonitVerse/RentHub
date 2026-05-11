import { Plus, ShoppingBag, Users, Package, Boxes } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Глобальная кнопка `+` в шапке. Открывает dropdown с быстрым созданием
 * основных сущностей. На малых экранах превращается в иконку.
 */
export function QuickCreateMenu() {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="hidden sm:inline-flex" title="Быстрое создание">
          <Plus className="size-4" />
          <span>Создать</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuTrigger asChild>
        <Button size="icon" className="sm:hidden" title="Быстрое создание">
          <Plus className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Быстрое создание</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/admin/orders/new')}>
          <ShoppingBag className="size-4" />
          <span>Заказ</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/admin/customers')}>
          <Users className="size-4" />
          <span>Клиент</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/admin/equipment/catalog/new')}>
          <Package className="size-4" />
          <span>Карточка оборудования</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/admin/equipment/stock')}>
          <Boxes className="size-4" />
          <span>Единица инвентаря</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
