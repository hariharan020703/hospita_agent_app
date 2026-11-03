import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-surface-sunken', className)} />;
}

/** Placeholder block with a screen-reader "Loading" announcement. */
export function SkeletonList({
  rows = 4,
  className,
  rowClassName,
}: {
  rows?: number;
  className?: string;
  rowClassName?: string;
}) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite" className={cn('space-y-3', className)}>
      <span className="sr-only">{t('states.loading')}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={cn('h-16 w-full rounded-xl', rowClassName)} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <div role="status" className={cn('space-y-3 rounded-xl border bg-surface p-5', className)}>
      <span className="sr-only">{t('states.loading')}</span>
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}
