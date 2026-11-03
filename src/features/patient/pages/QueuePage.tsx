// Live queue tracker: token, now serving, patients ahead, doctor delay and when to leave home.
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarCheck, Check, Clock, DoorOpen, House, QrCode, Stethoscope, Users } from 'lucide-react';
import {
  buttonClasses,
  Card,
  DoctorStatusPill,
  ErrorState,
  Field,
  PageHeader,
  Select,
  SkeletonCard,
} from '@/components/ui';
import { useAppointment } from '@/hooks/queries/appointments';
import { useHospital } from '@/hooks/queries/directory';
import { useQueueEstimate } from '@/hooks/queries/queue';
import { useLocale } from '@/hooks/useLocale';
import { usePrefs } from '@/hooks/usePrefs';
import { cn } from '@/lib/cn';
import { formatDate, formatTime } from '@/lib/format';
import type { QueuePhase } from '@/types';
import { usePatientContext } from '../usePatientContext';

const PHASE_STYLE: Record<QueuePhase, string> = {
  relax: 'border-info/30 bg-info-soft text-info-ink',
  get_ready: 'border-warning/30 bg-warning-soft text-warning-ink',
  leave_now: 'border-warning bg-warning-soft text-warning-ink',
  waiting: 'border-primary/30 bg-primary-soft text-primary-ink',
  next: 'border-success/40 bg-success-soft text-success-ink',
  your_turn: 'border-success bg-success-soft text-success-ink',
  done: 'border-border bg-surface-sunken text-fg',
  closed: 'border-border bg-surface-sunken text-fg',
};

const TRAVEL_OPTIONS = [10, 15, 20, 30, 45, 60, 90];

export default function QueuePage() {
  const { t } = useTranslation(['patient', 'common']);
  const { lang, doctorName } = useLocale();
  const { id } = useParams();
  const { today } = usePatientContext();
  const hospital = useHospital();
  const travelPref = usePrefs((s) => s.travelMins);
  const setTravel = usePrefs((s) => s.setTravelMins);
  const travelMins = travelPref ?? hospital.data?.travel.defaultMins ?? 30;
  const appointment = useAppointment(id);
  const estimate = useQueueEstimate(id, travelMins);
  const [announcement, setAnnouncement] = useState('');
  const lastAnnounced = useRef('');

  const e = estimate.data;
  const a = appointment.data;
  const phaseTitle = e ? t(`queue.phases.${e.phase}.title`) : '';

  useEffect(() => {
    if (!e) return;
    const key = `${e.phase}|${e.patientsAhead}|${e.leaveBy ?? ''}`;
    if (lastAnnounced.current && key !== lastAnnounced.current) {
      setAnnouncement(t('queue.announce', { phase: phaseTitle, count: e.patientsAhead }));
    }
    lastAnnounced.current = key;
  }, [e, phaseTitle, t]);

  if (appointment.isPending || estimate.isPending) return <SkeletonCard />;
  if (appointment.isError) return <ErrorState error={appointment.error} onRetry={() => void appointment.refetch()} />;
  if (estimate.isError) return <ErrorState error={estimate.error} onRetry={() => void estimate.refetch()} />;
  if (!a || !e) return null;

  const room = a.room;
  const checkedIn = e.checkedIn || e.phase === 'done';
  const steps = [
    { id: 'booked', icon: CalendarCheck, done: true, active: false },
    {
      id: 'leave',
      icon: House,
      done: checkedIn,
      active: !checkedIn && (e.phase === 'leave_now' || e.phase === 'get_ready'),
    },
    { id: 'checkin', icon: DoorOpen, done: checkedIn, active: false },
    { id: 'consult', icon: Stethoscope, done: e.phase === 'done', active: e.phase === 'your_turn' },
  ] as const;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('queue.title')}
        breadcrumbs={[
          { label: t('appointments.title'), to: '/app/appointments' },
          { label: a.token, to: `/app/appointments/${a.id}` },
          { label: t('queue.title') },
        ]}
      />
      <div aria-live="assertive" className="sr-only">
        {announcement}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm font-medium text-fg-muted">{t('queue.token')}</p>
            <p className="text-5xl font-extrabold tracking-tight text-fg tabular">{a.token}</p>
            <p className="mt-1 text-sm text-fg-muted">
              {doctorName(a)} · {t('common:room', { room })}
            </p>
          </div>
          <DoctorStatusPill status={e.doctorStatus} delayMins={e.delayMins} size="md" />
        </div>
        <div className={cn('border-t-2 px-5 py-4', PHASE_STYLE[e.phase])}>
          <p className="text-xl font-bold">{phaseTitle}</p>
          <p className="mt-1 text-fg">
            {t(`queue.phases.${e.phase}.body`, { time: e.leaveBy ? formatTime(e.leaveBy, lang) : '', room })}
          </p>
        </div>
      </Card>

      {a.date > today ? (
        <p className="rounded-xl border bg-surface p-4 text-sm text-fg">
          {t('queue.notToday', { date: formatDate(a.date, lang, 'weekday'), time: formatTime(a.start, lang) })}
        </p>
      ) : (
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { icon: Stethoscope, label: t('queue.nowServing'), value: e.nowServing ?? t('queue.noneServing') },
            { icon: Users, label: t('queue.ahead'), value: String(e.patientsAhead) },
            { icon: Clock, label: t('queue.expected'), value: formatTime(e.expectedStart, lang) },
            ...(e.leaveBy ? [{ icon: House, label: t('queue.leaveBy'), value: formatTime(e.leaveBy, lang) }] : []),
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-xl border bg-surface p-4">
              <dt className="flex items-center gap-1.5 text-sm text-fg-muted">
                <Icon aria-hidden className="h-4 w-4" />
                {label}
              </dt>
              <dd className="mt-1 text-2xl font-bold text-fg tabular">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <ol
          aria-label={t('queue.progress')}
          className="grid grid-cols-4 gap-2 lg:rounded-xl lg:border lg:bg-surface lg:p-5"
        >
          {steps.map(({ id: step, icon: Icon, done, active }) => (
            <li
              key={step}
              aria-current={active ? 'step' : undefined}
              className="flex flex-col items-center gap-1.5 text-center"
            >
              <span
                className={cn(
                  'grid h-10 w-10 place-items-center rounded-full',
                  done
                    ? 'bg-primary text-primary-fg'
                    : active
                      ? 'bg-primary-soft text-primary-ink ring-2 ring-primary'
                      : 'bg-surface-sunken text-fg-subtle',
                )}
              >
                {done ? <Check aria-hidden className="h-5 w-5" /> : <Icon aria-hidden className="h-5 w-5" />}
              </span>
              <span className={cn('text-xs leading-tight', active || done ? 'font-semibold text-fg' : 'text-fg-muted')}>
                {t(`queue.steps.${step}`)}
              </span>
            </li>
          ))}
        </ol>

        {!checkedIn && (
          <Card className="space-y-3 p-4">
            <Field label={t('queue.travelTime')} hint={t('settings.travelHint')}>
              {(c) => (
                <Select
                  {...c}
                  value={String(travelMins)}
                  onChange={(ev) => setTravel(Number(ev.target.value))}
                  options={TRAVEL_OPTIONS.map((m) => ({
                    value: String(m),
                    label: t('queue.travelValue', { count: m }),
                  }))}
                />
              )}
            </Field>
            <p className="text-sm text-fg-muted">{t('queue.checkInHint')}</p>
            <Link to={`/app/appointments/${a.id}`} className={buttonClasses('outline')}>
              <QrCode aria-hidden className="h-4 w-4" />
              {t('queue.showCode')}
            </Link>
          </Card>
        )}
      </div>
      <p className="text-center text-xs text-fg-subtle">
        {t('queue.updated', {
          time: new Date(estimate.dataUpdatedAt).toLocaleTimeString(lang === 'ta' ? 'ta-IN' : 'en-IN', {
            hour: 'numeric',
            minute: '2-digit',
          }),
        })}
      </p>
    </div>
  );
}
