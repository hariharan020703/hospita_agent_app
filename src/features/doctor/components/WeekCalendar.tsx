// One week, Monday to Sunday: OPD sessions, holidays, leave or blocked time, and booked appointments per day.
import { useTranslation } from 'react-i18next';
import { Ban, CalendarOff, Plane } from 'lucide-react';
import { Badge, Skeleton } from '@/components/ui';
import { useLocale } from '@/hooks/useLocale';
import { cn } from '@/lib/cn';
import { formatDate, formatTime, formatWeekday } from '@/lib/format';
import { weekdayOf } from '@/lib/time';
import type { AppointmentView, Holiday, Leave, WeeklyHours } from '@/types';
import { byDateTime } from '../utils';

const LISTED = 5;

function LeaveBadge({ leave }: { leave: Leave }) {
  const { t } = useTranslation('doctor');
  const { lang } = useLocale();
  const approved = leave.status === 'approved';
  if (leave.kind === 'block') {
    const times = {
      start: leave.startTime ? formatTime(leave.startTime, lang) : '',
      end: leave.endTime ? formatTime(leave.endTime, lang) : '',
    };
    return (
      <Badge tone={approved ? 'warning' : 'neutral'} icon={Ban}>
        {t(approved ? 'schedule.blocked' : 'schedule.blockRequested', times)}
      </Badge>
    );
  }
  return (
    <Badge tone={approved ? 'warning' : 'neutral'} icon={Plane}>
      {t(approved ? 'schedule.onLeave' : 'schedule.leaveRequested')}
    </Badge>
  );
}

export function WeekCalendar({
  days,
  weekly,
  appointments,
  appointmentsLoading,
  leaves,
  holidays,
  today,
}: {
  days: readonly string[];
  weekly: WeeklyHours;
  appointments: readonly AppointmentView[];
  appointmentsLoading: boolean;
  leaves: readonly Leave[];
  holidays: readonly Holiday[];
  today: string;
}) {
  const { t } = useTranslation(['doctor', 'common']);
  const { lang, l } = useLocale();
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {days.map((date) => {
        const sessions = weekly[weekdayOf(date)];
        const holiday = holidays.find((h) => h.date === date);
        const dayLeaves = leaves.filter((lv) => lv.status !== 'rejected' && lv.from <= date && date <= lv.to);
        const booked = appointments.filter((a) => a.date === date && a.status !== 'cancelled').sort(byDateTime);
        const isToday = date === today;
        return (
          <li
            key={date}
            aria-current={isToday ? 'date' : undefined}
            className={cn(
              'flex min-w-0 flex-col gap-3 rounded-xl border bg-surface p-3',
              isToday && 'border-primary ring-1 ring-primary',
              date < today && 'bg-surface-muted',
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-1">
              <h3 className="text-sm font-semibold text-fg">
                {formatWeekday(date, lang, 'long')}
                <span className="block font-normal text-fg-muted">{formatDate(date, lang, 'short')}</span>
              </h3>
              {isToday && <Badge tone="primary">{t('common:dates.today')}</Badge>}
            </div>

            {(holiday || dayLeaves.length > 0) && (
              <div className="flex flex-col items-start gap-1">
                {holiday && (
                  <Badge tone="info" icon={CalendarOff}>
                    {t('schedule.holiday', { name: l(holiday.name) })}
                  </Badge>
                )}
                {dayLeaves.map((leave) => (
                  <LeaveBadge key={leave.id} leave={leave} />
                ))}
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-fg-muted">{t('schedule.sessions')}</p>
              {sessions.length > 0 ? (
                <ul className="mt-1 space-y-0.5 text-sm text-fg tabular">
                  {sessions.map((range) => (
                    <li key={range.start}>
                      {t('schedule.range', { start: formatTime(range.start, lang), end: formatTime(range.end, lang) })}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-fg-subtle">{t('schedule.noSessions')}</p>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-fg-muted">{t('schedule.appointments')}</p>
              {appointmentsLoading ? (
                <div className="mt-1 space-y-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : booked.length === 0 ? (
                <p className="mt-1 text-sm text-fg-subtle">{t('schedule.noAppointments')}</p>
              ) : (
                <>
                  <p className="mt-1 text-sm font-semibold text-fg">
                    {t('schedule.bookedCount', { count: booked.length })}
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs text-fg-muted">
                    {booked.slice(0, LISTED).map((a) => (
                      <li key={a.id} className="break-words">
                        <span className="font-medium text-fg tabular">{formatTime(a.start, lang)}</span> {a.patientName}
                      </li>
                    ))}
                  </ul>
                  {booked.length > LISTED && (
                    <p className="mt-1 text-xs text-fg-muted">
                      {t('schedule.more', { count: booked.length - LISTED })}
                    </p>
                  )}
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
