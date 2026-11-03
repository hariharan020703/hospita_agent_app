// Cards inside the conversation: the triage result, doctor and time choices, booking confirmation, queue status,
// appointments. Only the latest card can be tapped; older ones stay as a record of the conversation.
import { useTranslation } from 'react-i18next';
import { CalendarCheck2, Clock, Gauge, Siren, Ticket } from 'lucide-react';
import { Avatar, Badge, DepartmentIcon, type BadgeTone } from '@/components/ui';
import { cn } from '@/lib/cn';
import { todayIso } from '@/lib/clock';
import { formatCurrency, formatTime } from '@/lib/format';
import { useDepartments } from '@/hooks/queries/directory';
import { useAgentText } from '@/hooks/useAgentText';
import { useLocale } from '@/hooks/useLocale';
import { useRelativeDay } from '@/hooks/useRelativeDay';
import { EscalatedNotice } from '@/features/triage/EmergencyScreen';
import type { ChatCard, ChatCommand, DoctorOption, TriageResult, Urgency } from '@/types';
import { DepartmentPicker } from './DepartmentPicker';

const URGENCY_TONE: Record<Urgency, BadgeTone> = { routine: 'info', soon: 'warning', emergency: 'danger' };

function Box({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('space-y-3 rounded-2xl border bg-surface p-4 shadow-xs', className)}>{children}</div>;
}

export function TriageResultCard({ result, size = 'md' }: { result: TriageResult; size?: 'md' | 'lg' }) {
  const { t } = useTranslation('triage');
  const { l } = useLocale();
  const render = useAgentText();
  const departments = useDepartments();
  const department = departments.data?.find((d) => d.id === result.departmentId);
  const big = size === 'lg';
  const low = result.confidence < 70;
  return (
    <Box className="border-2 border-primary/40">
      <p className={cn('font-semibold uppercase tracking-wide text-primary-ink', big ? 'text-sm' : 'text-xs')}>
        {t('result.title')}
      </p>
      <div className="flex items-center gap-3">
        {department && <DepartmentIcon icon={department.icon} boxed className={big ? 'h-12 w-12' : undefined} />}
        <div className="min-w-0">
          <h3 className={cn('font-bold text-fg', big ? 'text-2xl' : 'text-xl')}>
            {department ? l(department.name) : result.departmentId}
          </h3>
          {department && (
            <p className={cn('text-fg-muted', big ? 'text-base' : 'text-sm')}>
              {t('result.location', { wing: l(department.wing), floor: department.floor })}
            </p>
          )}
        </div>
      </div>
      <dl className={cn('grid grid-cols-2 gap-3', big ? 'text-base' : 'text-sm')}>
        <div>
          <dt className="text-fg-muted">{t('result.urgency')}</dt>
          <dd className="mt-1">
            <Badge tone={URGENCY_TONE[result.urgency]} size="md" icon={result.urgency === 'emergency' ? Siren : Clock}>
              {t(`urgency.${result.urgency}`)}
            </Badge>
          </dd>
        </div>
        <div>
          <dt className="text-fg-muted">{t('result.confidence')}</dt>
          <dd className="mt-1 flex items-center gap-2">
            <Gauge aria-hidden className={cn('h-4 w-4', low ? 'text-warning' : 'text-primary')} />
            <span className="font-semibold tabular text-fg">{result.confidence}%</span>
            <span aria-hidden className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-sunken">
              <span
                className={cn('block h-full rounded-full', low ? 'bg-warning' : 'bg-primary')}
                style={{ width: `${result.confidence}%` }}
              />
            </span>
          </dd>
        </div>
      </dl>
      {result.reasons.length > 0 && (
        <p className={cn('text-fg', big ? 'text-base' : 'text-sm')}>
          <span className="font-semibold">{t('result.because')} </span>
          {result.reasons.map(render).join(' + ')}
        </p>
      )}
      <p className={cn('rounded-lg bg-surface-sunken px-3 py-2 text-fg-muted', big ? 'text-sm' : 'text-xs')}>
        {t('result.notDiagnosis')}
      </p>
    </Box>
  );
}

function DoctorLine({ doctor, withSlot = true }: { doctor: DoctorOption; withSlot?: boolean }) {
  const { t } = useTranslation('triage');
  const { lang, doctorName } = useLocale();
  const day = useRelativeDay(todayIso());
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3 text-left">
      <Avatar name={doctor.name} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-fg">{doctorName(doctor)}</span>
        <span className="block text-sm text-fg-muted">
          {[
            withSlot ? t('cards.nextFree', { day: day(doctor.date), time: formatTime(doctor.start, lang) }) : '',
            formatCurrency(doctor.fee, lang),
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
    </span>
  );
}

export function ChatCardView({
  card,
  interactive,
  onCommand,
  onPickDepartment,
  hospitalPhone,
  size = 'md',
}: {
  card: ChatCard;
  interactive: boolean;
  onCommand: (command: ChatCommand, label: string) => void;
  onPickDepartment: (departmentId: string) => void;
  hospitalPhone?: string | undefined;
  size?: 'md' | 'lg';
}) {
  const { t } = useTranslation('triage');
  const { lang, doctorName } = useLocale();
  const day = useRelativeDay(todayIso());
  const when = (date: string, start: string) => `${day(date)}, ${formatTime(start, lang)}`;

  switch (card.kind) {
    case 'triage_result':
      return <TriageResultCard result={card.result} size={size} />;

    case 'doctor_options':
      return (
        <ul className="space-y-2">
          {card.options.map((doctor) => (
            <li key={doctor.doctorId}>
              <button
                type="button"
                disabled={!interactive}
                onClick={() =>
                  onCommand(
                    { type: 'pick_doctor', doctorId: doctor.doctorId },
                    `${doctorName(doctor)} · ${when(doctor.date, doctor.start)}`,
                  )
                }
                className="flex w-full items-center gap-3 rounded-xl border bg-surface p-3 hover:border-primary/60 hover:bg-primary-soft/30 disabled:cursor-default disabled:hover:border-border disabled:hover:bg-surface"
              >
                <DoctorLine doctor={doctor} />
              </button>
            </li>
          ))}
        </ul>
      );

    case 'slots':
      return (
        <Box>
          <DoctorLine doctor={card.doctor} withSlot={false} />
          <p className="text-sm font-semibold text-fg">{day(card.date)}</p>
          {card.starts.length === 0 ? (
            <p className="text-sm text-fg-muted">{t('cards.noTimes')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {card.starts.map((start) => (
                <button
                  key={start}
                  type="button"
                  disabled={!interactive}
                  onClick={() => onCommand({ type: 'pick_slot', date: card.date, start }, when(card.date, start))}
                  className="min-h-11 rounded-lg border border-border-strong px-3 text-sm font-semibold text-fg tabular hover:border-primary hover:bg-primary-soft disabled:opacity-60"
                >
                  {formatTime(start, lang)}
                </button>
              ))}
            </div>
          )}
        </Box>
      );

    case 'confirm_booking':
      return (
        <Box>
          <DoctorLine doctor={card.doctor} withSlot={false} />
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-fg-muted">{t('cards.when')}</dt>
              <dd className="font-semibold text-fg">{when(card.doctor.date, card.doctor.start)}</dd>
            </div>
            <div>
              <dt className="text-fg-muted">{t('cards.room')}</dt>
              <dd className="font-semibold text-fg">{card.doctor.room}</dd>
            </div>
          </dl>
        </Box>
      );

    case 'booked':
      return (
        <Box className="border-success/40 bg-success-soft/40">
          <p className="flex items-center gap-2 font-semibold text-success-ink">
            <CalendarCheck2 aria-hidden className="h-5 w-5" />
            {t('cards.booked')}
          </p>
          <div className="flex items-end justify-between gap-3">
            <DoctorLine doctor={card.doctor} withSlot={false} />
            <div className="text-right">
              <p className="text-xs text-fg-muted">{t('cards.token')}</p>
              <p className="text-2xl font-extrabold tracking-tight text-fg tabular">{card.token}</p>
            </div>
          </div>
          <p className="text-sm text-fg">
            {when(card.doctor.date, card.doctor.start)} · {t('cards.roomValue', { room: card.doctor.room })} ·{' '}
            {t('cards.ref', { ref: card.bookingRef })}
          </p>
        </Box>
      );

    case 'queue_status':
      return (
        <Box>
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-fg">
              {doctorName({
                doctorName: card.doctorName,
                ...(card.doctorNameTa ? { doctorNameTa: card.doctorNameTa } : {}),
              })}
            </p>
            <p className="inline-flex items-center gap-1.5 font-mono text-lg font-bold text-fg">
              <Ticket aria-hidden className="h-4 w-4 text-primary" />
              {card.token}
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-fg-muted">{t('cards.ahead')}</dt>
              <dd className="text-xl font-bold tabular text-fg">{card.patientsAhead}</dd>
            </div>
            <div>
              <dt className="text-fg-muted">{t('cards.expected')}</dt>
              <dd className="text-xl font-bold tabular text-fg">{formatTime(card.expectedStart, lang)}</dd>
            </div>
            <div>
              <dt className="text-fg-muted">{card.checkedIn ? t('cards.checkedIn') : t('cards.leaveBy')}</dt>
              <dd className="text-xl font-bold tabular text-fg">
                {card.checkedIn ? '✓' : card.leaveBy ? formatTime(card.leaveBy, lang) : '—'}
              </dd>
            </div>
          </dl>
        </Box>
      );

    case 'appointments':
      return (
        <ul className="divide-y rounded-2xl border bg-surface">
          {card.items.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="min-w-0">
                <span className="block font-semibold text-fg">
                  {doctorName({
                    doctorName: a.doctorName,
                    ...(a.doctorNameTa ? { doctorNameTa: a.doctorNameTa } : {}),
                  })}
                </span>
                <span className="block text-fg-muted">{when(a.date, a.start)}</span>
              </span>
              <span className="font-mono font-semibold text-fg">{a.token}</span>
            </li>
          ))}
        </ul>
      );

    case 'confirm_cancel':
      return (
        <Box>
          <p className="text-sm text-fg">
            <span className="font-mono font-semibold">{card.token}</span> · {when(card.date, card.start)}
          </p>
        </Box>
      );

    case 'escalated':
      return <EscalatedNotice reason={card.reason} hospitalPhone={hospitalPhone} size={size} />;

    case 'emergency':
      return (
        <p className="flex items-center gap-2 rounded-xl bg-danger px-4 py-3 font-semibold text-white">
          <Siren aria-hidden className="h-5 w-5 shrink-0" />
          {t('cards.emergency')}
        </p>
      );

    case 'department_picker':
      return interactive ? <DepartmentPicker onPick={onPickDepartment} size={size} /> : null;
  }
}
