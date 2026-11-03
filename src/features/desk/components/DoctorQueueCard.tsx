// One doctor's live queue on the OPD board: status, now serving, waiting list, collapsible expected list, done count.
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Stethoscope } from 'lucide-react';
import { Badge, DoctorStatusPill, StatusPill } from '@/components/ui';
import { useLocale } from '@/hooks/useLocale';
import { cn } from '@/lib/cn';
import { formatPhone, formatTime } from '@/lib/format';
import { toMinutes } from '@/lib/time';
import type { AppointmentView, Department, DoctorQueue } from '@/types';
import { clockTimeOf, matchesQuery } from '../deskUtils';
import { RowActionButtons } from './RowActions';

/** Minutes past the slot before a booked patient is flagged as "not arrived yet". */
const LATE_AFTER_MINS = 15;

function QueueRow({
  appointment: a,
  highlight,
  nowMins,
}: {
  appointment: AppointmentView;
  highlight: boolean;
  nowMins: number;
}) {
  const { t } = useTranslation(['desk', 'common']);
  const { lang } = useLocale();
  const overdue = a.status === 'booked' && nowMins > toMinutes(a.start) + LATE_AFTER_MINS;
  return (
    <li
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2',
        highlight && 'bg-primary-soft/60 ring-1 ring-primary/40',
      )}
    >
      <span className="w-20 shrink-0 font-mono text-sm font-bold text-fg tabular">{a.token}</span>
      <div className="min-w-[8rem] flex-1">
        <p className="break-words font-medium text-fg">{a.patientName}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-fg-muted">
          <span>{t('card.slotAt', { time: formatTime(a.start, lang) })}</span>
          {a.checkedInAt && a.status === 'checked_in' && (
            <span>{t('card.arrivedAt', { time: formatTime(clockTimeOf(a.checkedInAt), lang) })}</span>
          )}
          <span className="tabular">{formatPhone(a.patientPhone)}</span>
          <span>{t(`channel.${a.source}`)}</span>
        </p>
        {overdue && (
          <Badge tone="warning" className="mt-1">
            {t('card.notArrived')}
          </Badge>
        )}
      </div>
      <RowActionButtons appointment={a} />
    </li>
  );
}

export function DoctorQueueCard({
  queue,
  department,
  query,
  nowMins,
}: {
  queue: DoctorQueue;
  department: Department | undefined;
  /** Normalised search term; when set, lists show only matching patients and matches are highlighted. */
  query: string;
  nowMins: number;
}) {
  const { t } = useTranslation(['desk', 'common']);
  const { lang, l, doctorName } = useLocale();
  const headingId = useId();
  const expectedId = useId();
  const [showExpected, setShowExpected] = useState(false);

  const searching = query.length > 0;
  const match = (a: AppointmentView) => searching && matchesQuery(a, query);
  const waiting = searching ? queue.waiting.filter(match) : queue.waiting;
  const expected = searching ? queue.expected.filter(match) : queue.expected;
  const seen = searching ? queue.done.filter(match) : [];
  const expanded = showExpected || (searching && expected.length > 0);
  const completed = queue.done.filter((a) => a.status === 'completed').length;
  const noShows = queue.done.length - completed;
  const { day, current } = queue;

  return (
    <article aria-labelledby={headingId} className="flex flex-col rounded-xl border bg-surface shadow-xs">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <h3 id={headingId} className="font-semibold text-fg">
            {doctorName(queue)}
          </h3>
          <p className="text-sm text-fg-muted">
            {l(department?.name)} · {t('common:room', { room: queue.room })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <DoctorStatusPill status={day.status} delayMins={day.delayMins} />
          {day.status === 'on_break' && day.breakUntil && (
            <span className="text-xs text-fg-muted">
              {t('card.backAt', { time: formatTime(day.breakUntil, lang) })}
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 space-y-4 p-4">
        <section aria-label={t('card.nowServing')}>
          <h4 className="text-xs font-semibold text-fg-muted">{t('card.nowServing')}</h4>
          {current ? (
            <div
              className={cn(
                'mt-1 flex flex-wrap items-center gap-3 rounded-lg bg-success-soft px-3 py-2',
                match(current) && 'ring-2 ring-primary',
              )}
            >
              <Stethoscope aria-hidden className="h-5 w-5 shrink-0 text-success-ink" />
              <span className="font-mono text-lg font-bold text-fg tabular">{current.token}</span>
              <span className="min-w-0 flex-1 break-words font-medium text-fg">{current.patientName}</span>
              {current.calledAt && (
                <span className="text-xs text-fg-muted">
                  {t('card.calledAt', { time: formatTime(clockTimeOf(current.calledAt), lang) })}
                </span>
              )}
            </div>
          ) : (
            <p className="mt-1 text-sm text-fg-subtle">{t('card.nobodyInConsultation')}</p>
          )}
        </section>

        <section>
          <h4 className="flex items-center gap-2 text-xs font-semibold text-fg-muted">
            {t('card.waiting')}
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-primary-ink tabular">
              {searching ? `${waiting.length}/${queue.waiting.length}` : queue.waiting.length}
            </span>
          </h4>
          {waiting.length === 0 ? (
            <p className="mt-1 text-sm text-fg-subtle">{t('card.noneWaiting')}</p>
          ) : (
            <ol className="mt-1 space-y-0.5">
              {waiting.map((a) => (
                <QueueRow key={a.id} appointment={a} highlight={searching} nowMins={nowMins} />
              ))}
            </ol>
          )}
        </section>

        <section>
          {queue.expected.length === 0 ? (
            <>
              <h4 className="text-xs font-semibold text-fg-muted">{t('card.expected')}</h4>
              <p className="mt-1 text-sm text-fg-subtle">{t('card.noneExpected')}</p>
            </>
          ) : (
            <>
              <h4>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={expectedId}
                  onClick={() => setShowExpected((v) => !v)}
                  className="-mx-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-primary-ink hover:bg-surface-sunken"
                >
                  <ChevronDown
                    aria-hidden
                    className={cn('h-4 w-4 shrink-0 transition-transform', expanded && 'rotate-180')}
                  />
                  {expanded
                    ? t('card.hideExpected', { count: expected.length })
                    : t('card.showExpected', { count: expected.length })}
                </button>
              </h4>
              <div id={expectedId} hidden={!expanded}>
                {expected.length === 0 ? (
                  <p className="mt-1 text-sm text-fg-subtle">{t('card.noneExpected')}</p>
                ) : (
                  <ol className="mt-1 space-y-0.5">
                    {expected.map((a) => (
                      <QueueRow key={a.id} appointment={a} highlight={searching} nowMins={nowMins} />
                    ))}
                  </ol>
                )}
              </div>
            </>
          )}
        </section>

        {seen.length > 0 && (
          <section>
            <h4 className="text-xs font-semibold text-fg-muted">{t('card.seenToday')}</h4>
            <ul className="mt-1 space-y-1">
              {seen.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-primary-soft/60 px-2 py-2 ring-1 ring-primary/40"
                >
                  <span className="w-20 shrink-0 font-mono text-sm font-bold text-fg tabular">{a.token}</span>
                  <span className="min-w-0 flex-1 break-words font-medium text-fg">{a.patientName}</span>
                  <StatusPill status={a.status} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <footer className="border-t px-4 py-2 text-sm text-fg-muted">
        {t('card.doneSummary', { completed, noShow: noShows })}
      </footer>
    </article>
  );
}
