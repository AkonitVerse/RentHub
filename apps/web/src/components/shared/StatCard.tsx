import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: { value: string; positive?: boolean };
  Icon?: LucideIcon;
  accent?: 'blue' | 'green' | 'orange' | 'red';
  className?: string;
}

const ACCENTS: Record<NonNullable<StatCardProps['accent']>, string> = {
  blue: 'bg-blue-soft text-blue',
  green: 'bg-status-active-bg text-status-active',
  orange: 'bg-status-pending-bg text-status-pending',
  red: 'bg-status-overdue-bg text-status-overdue',
};

export function StatCard({ label, value, delta, Icon, accent = 'blue', className }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border bg-surface p-5 shadow-card hover:shadow-card-hover transition-shadow',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-medium text-text-3 uppercase tracking-wide">{label}</div>
        {Icon && (
          <div className={cn('size-10 rounded-lg grid place-items-center', ACCENTS[accent])}>
            <Icon className="size-5" />
          </div>
        )}
      </div>
      <div className="font-display text-2xl sm:text-3xl font-bold mt-2 price">{value}</div>
      {delta && (
        <div
          className={cn(
            'text-xs mt-1',
            delta.positive ? 'text-status-active' : 'text-status-overdue',
          )}
        >
          {delta.positive ? '↑' : '↓'} {delta.value}
        </div>
      )}
    </motion.div>
  );
}
