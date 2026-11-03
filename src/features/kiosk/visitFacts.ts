// Builds the label/value tiles the kiosk shows for a visit (token slip, check-in summary and confirmation).
import { useTranslation } from 'react-i18next';
import { CalendarClock, Clock, DoorOpen, Hospital, Stethoscope, Ticket, UserRound, Users } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { formatDate, formatTime } from '@/lib/format';
import type { AppointmentView, Department, QueueEstimate } from '@/types';
import type { Fact } from './ui';

export type FactKey = 'department' | 'doctor' | 'room' | 'expected' | 'ahead' | 'patient' | 'when' | 'token';

export function useVisitFacts({
  appointment,
  department,
  estimate,
  show,
}: {
  appointment: AppointmentView;
  department: Department | undefined;
  estimate?: QueueEstimate | undefined;
  show: readonly FactKey[];
}): Fact[] {
  const { t } = useTranslation(['kiosk', 'common']);
  const { lang, l, doctorName } = useLocale();
  const location = department ? t('facts.location', { wing: l(department.wing), floor: department.floor }) : undefined;

  const build = (key: FactKey): Fact => {
    switch (key) {
      case 'department':
        return { icon: Hospital, label: t('facts.department'), value: l(department?.name) || '—', detail: location };
      case 'doctor':
        return {
          icon: Stethoscope,
          label: t('facts.doctor'),
          value: doctorName(appointment),
          detail: show.includes('department') ? undefined : l(department?.name),
        };
      case 'room':
        return {
          icon: DoorOpen,
          label: t('facts.room'),
          value: appointment.room,
          detail: show.includes('department') ? undefined : location,
        };
      case 'expected':
        return {
          icon: Clock,
          label: t('facts.expected'),
          value: formatTime(estimate?.expectedStart ?? appointment.start, lang),
          live: true,
        };
      case 'ahead':
        return {
          icon: Users,
          label: t('facts.ahead'),
          value: estimate ? String(estimate.patientsAhead) : '…',
          detail: estimate && estimate.patientsAhead === 0 ? t('facts.youAreNext') : undefined,
          live: true,
        };
      case 'patient':
        return { icon: UserRound, label: t('facts.patient'), value: appointment.patientName };
      case 'when':
        return {
          icon: CalendarClock,
          label: t('facts.when'),
          value: formatTime(appointment.start, lang),
          detail: formatDate(appointment.date, lang, 'long'),
        };
      case 'token':
        return { icon: Ticket, label: t('common:token'), value: appointment.token };
    }
  };

  return show.map(build);
}
