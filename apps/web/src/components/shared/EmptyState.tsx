import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title = 'Нет данных',
  description = 'Здесь пока ничего нет. Добавьте первую запись, чтобы начать работу.',
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}
    >
      <div className="size-16 rounded-2xl bg-surface-3 grid place-items-center text-text-3 mb-4">
        {icon ?? <Inbox className="size-7" />}
      </div>
      <h3 className="font-display font-semibold text-lg">{title}</h3>
      <p className="text-sm text-text-2 mt-1 max-w-md">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
