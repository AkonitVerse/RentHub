import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        // text-base (16px) — стандарт по WCAG/iOS: при <16px Safari автоматически
        // зумит страницу при фокусе на input, что раздражает на мобиле.
        'flex h-10 w-full rounded-lg border border-border bg-surface px-3.5 py-2 text-base transition-colors',
        'placeholder:text-text-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/30 focus-visible:ring-offset-1 focus-visible:ring-offset-bg focus-visible:border-blue',
        'disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-sm file:font-medium',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
