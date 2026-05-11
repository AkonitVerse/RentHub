import { cn } from '@/lib/utils/cn';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-4 mb-6', className)}>
      <div className="min-w-0">
        <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight">{title}</h1>
        {description && <p className="text-text-2 text-sm sm:text-base mt-1">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </header>
  );
}
