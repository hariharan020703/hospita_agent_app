// Doctor and appointment summary cards shared by the patient, kiosk and staff apps.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarClock, ChevronRight, Languages, MapPin } from 'lucide-react';
import { Avatar, Badge, StatusPill } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatCurrency, formatTime } from '@/lib/format';
import { useRelativeDay } from '@/hooks/useRelativeDay';
import { useLocale } from '@/hooks/useLocale';
import type { DoctorListItem } from '@/services';
import type { AppointmentView, Department } from '@/types';

export function DoctorCard({
  doctor,
  department,
  to,
  today,
  action,
}: {
  doctor: DoctorListItem;
  department: Department | undefined;
  to: string;
  today: string;
  action: string;
}) {
  const { t } = useTranslation(['patient', 'common']);
  const { lang, l, doctorName } = useLocale();
  const relativeDay = useRelativeDay(today);
  return (
    <Link
      to={to}
      className="group flex gap-4 rounded-xl border bg-surface p-4 shadow-xs transition-colors hover:border-primary/50 focus-visible:border-primary"
    >
      <Avatar name={doctor.name} src={doctor.photoUrl} size="lg" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div>
          <p className="font-semibold text-fg">{doctorName(doctor)}</p>
          <p className="text-sm text-fg-muted">
            {l(department?.name)} · {doctor.qualifications.join(', ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge icon={Languages}>{doctor.languages.map((code) => t(`common:language.${code}`)).join(' · ')}</Badge>
          <Badge>{formatCurrency(doctor.fee, lang)}</Badge>
        </div>
        <p className="flex items-center gap-1.5 text-sm">
          <CalendarClock aria-hidden className="h-4 w-4 shrink-0 text-primary-ink" />
          {doctor.nextAvailable ? (
            <span className="text-fg">
              {t('doctors.nextAvailable')}:{' '}
              <strong className="font-semibold">
                {relativeDay(doctor.nextAvailable.date)}, {formatTime(doctor.nextAvailable.start, lang)}
              </strong>
            </span>
          ) : (
            <span className="text-fg-subtle">{t('doctors.noneAvailable')}</span>
          )}
        </p>
      </div>
      <span className="hidden items-center gap-1 self-center text-sm font-semibold text-primary-ink sm:flex">
        {action}
        <ChevronRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

export function AppointmentCard({
  appointment,
  to,
  today,
  footer,
  showPatient,
  className,
}: {
  appointment: AppointmentView;
  to?: string;
  today: string;
  footer?: ReactNode;
  showPatient?: boolean;
  className?: string;
}) {
  const { t } = useTranslation(['patient', 'common']);
  const { lang, doctorName } = useLocale();
  const relativeDay = useRelativeDay(today);
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg-muted">
            {relativeDay(appointment.date)} · {formatTime(appointment.start, lang)}
          </p>
          <p className="mt-0.5 font-semibold text-fg">{doctorName(appointment)}</p>
          {showPatient && (
            <p className="text-sm text-fg-muted">{t('appointments.forPatient', { name: appointment.patientName })}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusPill status={appointment.status} />
          <span className="text-sm font-bold tabular text-fg">{appointment.token}</span>
        </div>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-sm text-fg-muted">
        <MapPin aria-hidden className="h-4 w-4 shrink-0" />
        {t('common:room', { room: appointment.room })}
      </p>
    </>
  );
  // The footer (e.g. "Track the live queue") sits beside the card link, never inside it: links cannot nest.
  return (
    <div
      className={cn(
        'rounded-xl border bg-surface shadow-xs',
        to && 'transition-colors hover:border-primary/50',
        className,
      )}
    >
      {to ? (
        <Link to={to} className="block rounded-xl p-4">
          {body}
        </Link>
      ) : (
        <div className="p-4">{body}</div>
      )}
      {footer && <div className="px-4 pb-4">{footer}</div>}
    </div>
  );
}
