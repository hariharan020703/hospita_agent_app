// Today's queue for one doctor: waiting (checked in), then expected (booked), then done (collapsed). Anyone still
// to be seen has their pre-visit summary one tap away, so it can be read before they reach the front of the queue.
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarX, ChevronDown, Sparkles } from 'lucide-react';
import { Card, CardHeader, Drawer, EmptyState, IconButton, StatusPill } from '@/components/ui';
import { useLocale } from '@/hooks/useLocale';
import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/format';
import type { AppointmentView, DoctorQueue } from '@/types';
import { clockTime } from '../utils';
import { PreVisitSummaryPanel } from './PreVisitSummary';

type Group = 'waiting' | 'expected' | 'done';

function QueueRow({
  appointment: a,
  group,
  onSummary,
}: {
  appointment: AppointmentView;
  group: Group;
  onSummary?: (appointment: AppointmentView) => void;
}) {
  const { t } = useTranslation('doctor');
  const { lang } = useLocale();
  const detail =
    group === 'waiting' && a.checkedInAt
      ? t('queue.checkedIn', { slot: formatTime(a.start, lang), time: formatTime(clockTime(a.checkedInAt), lang) })
      : group === 'done' && a.completedAt
        ? t('queue.finished', { slot: formatTime(a.start, lang), time: formatTime(clockTime(a.completedAt), lang) })
        : t('queue.slot', { time: formatTime(a.start, lang) });
  return (
    <li className="flex items-center gap-3 px-4 py-3 sm:px-5">
      <span className="w-20 shrink-0 font-mono text-sm font-semibold text-fg tabular">{a.token}</span>
      <div className="min-w-0 flex-1">
        <Link
          to={`/doctor/patients/${a.patientId}`}
          className="font-medium text-fg hover:text-primary-ink hover:underline"
        >
          {a.patientName}
        </Link>
        <p className="text-xs text-fg-muted">{detail}</p>
      </div>
      {onSummary && (
        <IconButton
          icon={Sparkles}
          size="sm"
          label={t('summary.openFor', { name: a.patientName })}
          onClick={() => onSummary(a)}
        />
      )}
      <StatusPill status={a.status} />
    </li>
  );
}

function GroupHeading({ id, title, count }: { id: string; title: string; count: number }) {
  return (
    <h3 id={id} className="flex items-center gap-2 bg-surface-muted px-4 py-2 text-sm font-semibold text-fg sm:px-5">
      {title}
      <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-fg-muted tabular">{count}</span>
    </h3>
  );
}

function QueueGroup({
  group,
  items,
  empty,
  onSummary,
}: {
  group: 'waiting' | 'expected';
  items: AppointmentView[];
  empty: string;
  onSummary: (appointment: AppointmentView) => void;
}) {
  const { t } = useTranslation('doctor');
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <GroupHeading id={headingId} title={t(`queue.${group}`)} count={items.length} />
      {items.length === 0 ? (
        <p className="px-4 py-3 text-sm text-fg-muted sm:px-5">{empty}</p>
      ) : (
        <ul className="divide-y">
          {items.map((a) => (
            <QueueRow key={a.id} appointment={a} group={group} onSummary={onSummary} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function QueueList({ queue }: { queue: DoctorQueue }) {
  const { t } = useTranslation('doctor');
  const [showDone, setShowDone] = useState(false);
  const [summaryFor, setSummaryFor] = useState<AppointmentView | null>(null);
  const doneHeadingId = useId();
  const doneListId = useId();
  const total = (queue.current ? 1 : 0) + queue.waiting.length + queue.expected.length + queue.done.length;

  return (
    <Card className="overflow-hidden">
      <CardHeader title={t('queue.title')} />
      {total === 0 ? (
        <div className="p-4 sm:p-5">
          <EmptyState icon={CalendarX} title={t('queue.emptyTitle')} body={t('queue.emptyBody')} className="border-0" />
        </div>
      ) : (
        <div className="divide-y">
          <QueueGroup group="waiting" items={queue.waiting} empty={t('queue.emptyWaiting')} onSummary={setSummaryFor} />
          <QueueGroup
            group="expected"
            items={queue.expected}
            empty={t('queue.emptyExpected')}
            onSummary={setSummaryFor}
          />
          <section aria-labelledby={doneHeadingId}>
            <h3 id={doneHeadingId}>
              <button
                type="button"
                aria-expanded={showDone}
                aria-controls={doneListId}
                onClick={() => setShowDone((v) => !v)}
                className="flex min-h-11 w-full items-center gap-2 bg-surface-muted px-4 py-2 text-left text-sm font-semibold text-fg hover:bg-surface-sunken sm:px-5"
              >
                <ChevronDown
                  aria-hidden
                  className={cn('h-4 w-4 shrink-0 transition-transform', !showDone && '-rotate-90')}
                />
                {t('queue.done')}
                <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-fg-muted tabular">
                  {queue.done.length}
                </span>
              </button>
            </h3>
            <div id={doneListId} hidden={!showDone}>
              {queue.done.length === 0 ? (
                <p className="px-4 py-3 text-sm text-fg-muted sm:px-5">{t('queue.emptyDone')}</p>
              ) : (
                <ul className="divide-y">
                  {queue.done.map((a) => (
                    <QueueRow key={a.id} appointment={a} group="done" />
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}
      <Drawer
        open={summaryFor !== null}
        onClose={() => setSummaryFor(null)}
        title={t('summary.drawerTitle', { name: summaryFor?.patientName ?? '' })}
        description={summaryFor ? `${summaryFor.token} · ${summaryFor.reason ?? ''}` : undefined}
      >
        {summaryFor && <PreVisitSummaryPanel key={summaryFor.id} appointment={summaryFor} />}
      </Drawer>
    </Card>
  );
}
