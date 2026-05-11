import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

interface BulkActionBarProps {
  /** Сколько элементов выделено. Полоса показывается при > 0. */
  count: number;
  /** Снять всё выделение. */
  onClear: () => void;
  /** Действия в правой части полосы. */
  children: ReactNode;
  /** Доп. контент сразу после счётчика (например, "Сумма: 12 345 ₽"). */
  meta?: ReactNode;
  className?: string;
}

/**
 * Sticky-полоса массовых действий снизу страницы (Gmail/Linear-style).
 * Появляется при выделении ≥1 строки чекбоксом.
 */
export function BulkActionBar({ count, onClear, children, meta, className }: BulkActionBarProps) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 320 }}
          className={cn(
            'fixed left-1/2 -translate-x-1/2 bottom-6 z-40',
            'rounded-full border border-border-2 bg-text text-bg shadow-popover',
            'flex items-center gap-3 pl-5 pr-2 py-1.5 max-w-[calc(100vw-2rem)]',
            className,
          )}
        >
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onClear}
            className="text-bg/70 hover:text-bg hover:bg-white/10 size-7 -ml-3"
            title="Снять выделение"
          >
            <X className="size-3.5" />
          </Button>
          <div className="text-sm font-medium whitespace-nowrap">
            Выделено: <span className="font-mono">{count}</span>
          </div>
          {meta && <div className="text-xs text-bg/70 whitespace-nowrap">{meta}</div>}
          <div className="flex items-center gap-1 ml-2">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
