import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';

type Tone = 'red' | 'blue' | 'amber' | 'green' | 'slate' | 'violet';

const TONE_HEADER: Record<Tone, string> = {
  red: 'bg-status-overdue-bg text-status-overdue',
  blue: 'bg-blue-soft text-blue',
  amber: 'bg-status-pending-bg text-status-pending',
  green: 'bg-status-active-bg text-status-active',
  slate: 'bg-surface-3 text-text-2',
  violet: 'bg-violet-100 text-violet-700',
};

const TONE_BADGE: Record<Tone, string> = {
  red: 'bg-status-overdue text-white',
  blue: 'bg-blue text-white',
  amber: 'bg-status-pending text-white',
  green: 'bg-status-active text-white',
  slate: 'bg-text-2 text-white',
  violet: 'bg-violet-600 text-white',
};

interface WidgetCardProps {
  title: string;
  Icon: LucideIcon;
  tone?: Tone;
  count?: number;
  isLoading?: boolean;
  emptyText?: string;
  /** Куда ведёт ссылка «Открыть всё». Если не задано — линк не показывается. */
  href?: string;
  /** Подпись для линка (по умолчанию «Открыть всё»). */
  linkLabel?: string;
  /** Дочерние строки. Когда `count > 0` — показывается; иначе — empty state. */
  children?: ReactNode;
  delay?: number;
}

export function WidgetCard({
  title,
  Icon,
  tone = 'slate',
  count,
  isLoading,
  emptyText = 'Пусто 🎉',
  href,
  linkLabel = 'Открыть всё',
  children,
  delay = 0,
}: WidgetCardProps) {
  const isEmpty = !isLoading && (count == null || count === 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-xl border bg-surface flex flex-col min-h-[280px]"
    >
      <div className="flex items-center justify-between gap-2 px-5 py-4 border-b">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              'size-8 rounded-md grid place-items-center flex-shrink-0',
              TONE_HEADER[tone],
            )}
          >
            <Icon className="size-4" />
          </div>
          <div className="font-display font-semibold truncate">{title}</div>
        </div>
        {count != null && count > 0 && (
          <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', TONE_BADGE[tone])}>
            {count}
          </span>
        )}
      </div>
      <div className="flex-1 px-5 py-3 space-y-2">
        {isLoading ? (
          <>
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </>
        ) : isEmpty ? (
          <div className="h-full grid place-items-center text-sm text-text-3 py-6">{emptyText}</div>
        ) : (
          children
        )}
      </div>
      {href && !isEmpty && !isLoading && (
        <Link
          to={href}
          className="px-5 py-3 border-t text-xs text-text-2 hover:text-blue hover:bg-surface-2 transition-colors flex items-center justify-between"
        >
          <span>{linkLabel}</span>
          <ArrowRight className="size-3.5" />
        </Link>
      )}
    </motion.div>
  );
}
