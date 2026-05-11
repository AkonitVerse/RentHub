import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('animate-spin', className)} />;
}

export function FullPageSpinner() {
  return (
    <div className="min-h-[40vh] grid place-items-center">
      <Spinner className="size-8 text-blue" />
    </div>
  );
}
