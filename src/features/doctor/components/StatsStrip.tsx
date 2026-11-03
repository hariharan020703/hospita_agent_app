import { useTranslation } from 'react-i18next';
import { CalendarClock, CheckCircle2, UserX, Users } from 'lucide-react';
import type { DoctorQueue } from '@/types';

/** Today's numbers. Each tile is its own polite live region so a change is read out with its label. */
export function StatsStrip({ queue }: { queue: DoctorQueue }) {
  const { t } = useTranslation('doctor');
  const stats = [
    { id: 'seen', icon: CheckCircle2, value: queue.done.filter((a) => a.status === 'completed').length },
    { id: 'waiting', icon: Users, value: queue.waiting.length },
    { id: 'expected', icon: CalendarClock, value: queue.expected.length },
    { id: 'noShows', icon: UserX, value: queue.done.filter((a) => a.status === 'no_show').length },
  ] as const;
  return (
    <section aria-labelledby="doctor-stats-title">
      <h2 id="doctor-stats-title" className="sr-only">
        {t('stats.title')}
      </h2>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ id, icon: Icon, value }) => (
          <div key={id} aria-live="polite" aria-atomic="true" className="rounded-xl border bg-surface p-4 shadow-xs">
            <dt className="flex items-center gap-1.5 text-sm text-fg-muted">
              <Icon aria-hidden className="h-4 w-4 shrink-0" />
              {t(`stats.${id}`)}
            </dt>
            <dd className="mt-1 text-3xl font-bold text-fg tabular">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
