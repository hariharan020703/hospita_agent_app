import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <>
      <Loader2 aria-hidden className={cn('h-4 w-4 shrink-0 animate-spin', className)} />
      {label && <span className="sr-only">{label}</span>}
    </>
  );
}
