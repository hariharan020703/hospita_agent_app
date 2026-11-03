// The doctor's leave and blocked-time requests with their approval status.
import { useTranslation } from 'react-i18next';
import { Ban, CalendarCheck2, CheckCircle2, Clock3, Plane, XCircle } from 'lucide-react';
import { Badge, EmptyState, ErrorState, SkeletonList, type BadgeTone } from '@/components/ui';
import { useLeaves } from '@/hooks/queries/directory';
import { useLocale } from '@/hooks/useLocale';
import { formatDate, formatTime } from '@/lib/format';
import type { Leave, LeaveStatus } from '@/types';

const STATUS: Record<LeaveStatus, { tone: BadgeTone; icon: typeof Clock3 }> = {
  pending: { tone: 'warning', icon: Clock3 },
  approved: { tone: 'success', icon: CheckCircle2 },
  rejected: { tone: 'neutral', icon: XCircle },
};

function LeaveItem({ leave }: { leave: Leave }) {
  const { t } = useTranslation('doctor');
  const { lang } = useLocale();
  const status = STATUS[leave.status];
  const KindIcon = leave.kind === 'block' ? Ban : Plane;
  const when =
    leave.kind === 'block'
      ? t('leave.blockWhen', {
          date: formatDate(leave.from, lang, 'weekday'),
          start: leave.startTime ? formatTime(leave.startTime, lang) : '',
          end: leave.endTime ? formatTime(leave.endTime, lang) : '',
        })
      : leave.from === leave.to
        ? formatDate(leave.from, lang, 'weekday')
        : t('leave.range', {
            from: formatDate(leave.from, lang, 'weekday'),
            to: formatDate(leave.to, lang, 'weekday'),
          });
  return (
    <li className="flex flex-wrap items-start gap-3 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-sunken text-fg-muted">
        <KindIcon aria-hidden className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-fg">
          {t(`leave.kinds.${leave.kind}`)} · <span className="tabular">{when}</span>
        </p>
        <p className="text-sm text-fg-muted">{leave.reason}</p>
      </div>
      <Badge tone={status.tone} icon={status.icon} size="md">
        {t(`leave.status.${leave.status}`)}
      </Badge>
    </li>
  );
}

export function LeaveList({ doctorId, today }: { doctorId: string; today: string }) {
  const { t } = useTranslation('doctor');
  const leaves = useLeaves({ doctorId });

  if (leaves.isPending) return <SkeletonList rows={3} rowClassName="h-14" />;
  if (leaves.isError) return <ErrorState error={leaves.error} onRetry={() => void leaves.refetch()} />;
  if (leaves.data.length === 0) {
    return <EmptyState icon={CalendarCheck2} title={t('leave.emptyTitle')} body={t('leave.emptyBody')} />;
  }

  const upcoming = leaves.data.filter((lv) => lv.to >= today);
  const past = leaves.data.filter((lv) => lv.to < today).reverse();
  return (
    <div className="space-y-4">
      <section aria-labelledby="leave-upcoming">
        <h3 id="leave-upcoming" className="text-sm font-semibold text-fg-muted">
          {t('leave.upcoming')}
        </h3>
        {upcoming.length === 0 ? (
          <p className="py-3 text-sm text-fg-muted">{t('leave.noUpcoming')}</p>
        ) : (
          <ul className="divide-y">
            {upcoming.map((leave) => (
              <LeaveItem key={leave.id} leave={leave} />
            ))}
          </ul>
        )}
      </section>
      {past.length > 0 && (
        <section aria-labelledby="leave-past">
          <h3 id="leave-past" className="text-sm font-semibold text-fg-muted">
            {t('leave.past')}
          </h3>
          <ul className="divide-y opacity-80">
            {past.map((leave) => (
              <LeaveItem key={leave.id} leave={leave} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
