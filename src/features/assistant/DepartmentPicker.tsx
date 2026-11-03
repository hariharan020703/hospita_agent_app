// Manual department choice: the normal flow when the triage agent (or the orchestrator) is paused.
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { DepartmentIcon, EmptyState, ErrorState, SkeletonList } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useDepartments } from '@/hooks/queries/directory';
import { useLocale } from '@/hooks/useLocale';

export function DepartmentPicker({
  onPick,
  size = 'md',
  className,
}: {
  onPick: (departmentId: string) => void;
  size?: 'md' | 'lg';
  className?: string;
}) {
  const { t } = useTranslation('triage');
  const { l } = useLocale();
  const departments = useDepartments();
  const big = size === 'lg';
  if (departments.isPending) return <SkeletonList rows={4} />;
  if (departments.isError) return <ErrorState error={departments.error} onRetry={() => void departments.refetch()} />;
  const bookable = departments.data.filter((d) => d.active && d.bookable);
  if (bookable.length === 0) return <EmptyState title={t('picker.empty')} />;
  return (
    <ul className={cn('grid gap-2 sm:grid-cols-2', className)}>
      {bookable.map((d) => (
        <li key={d.id}>
          <button
            type="button"
            onClick={() => onPick(d.id)}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl border bg-surface p-3 text-left hover:border-primary/60 hover:bg-primary-soft/30',
              big ? 'min-h-16 text-lg' : 'min-h-12',
            )}
          >
            <DepartmentIcon icon={d.icon} boxed />
            <span className="min-w-0 flex-1 font-semibold text-fg">{l(d.name)}</span>
            <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-fg-subtle" />
          </button>
        </li>
      ))}
    </ul>
  );
}
