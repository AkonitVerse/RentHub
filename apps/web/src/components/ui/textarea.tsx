import * as React from 'react';
import { cn } from '@/lib/utils/cn';

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      // text-base (16px) — синхронно с Input: фикс iOS-зума на мобиле + WCAG.
      'flex min-h-[80px] w-full rounded-md border border-border bg-surface px-3 py-2 text-base',
      'placeholder:text-text-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/40 focus-visible:border-blue',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export { Textarea };
