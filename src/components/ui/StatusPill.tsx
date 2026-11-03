import { useTranslation } from 'react-i18next';
import {
  Ban,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Coffee,
  DoorOpen,
  Stethoscope,
  UserCheck,
  UserX,
  Moon,
} from 'lucide-react';
import type { AppointmentStatus, DoctorStatus } from '@/types';
import { Badge, type BadgeTone } from './Badge';

const APPOINTMENT: Record<AppointmentStatus, { tone: BadgeTone; icon: typeof Clock }> = {
  booked: { tone: 'info', icon: CalendarCheck },
  checked_in: { tone: 'primary', icon: UserCheck },
  in_consultation: { tone: 'success', icon: Stethoscope },
  completed: { tone: 'neutral', icon: CheckCircle2 },
  cancelled: { tone: 'neutral', icon: Ban },
  no_show: { tone: 'warning', icon: UserX },
};

/** Appointment status with icon and text, never colour alone. */
export function StatusPill({ status, size }: { status: AppointmentStatus; size?: 'sm' | 'md' }) {
  const { t } = useTranslation();
  const { tone, icon } = APPOINTMENT[status];
  return (
    <Badge tone={tone} icon={icon} size={size}>
      {t(`status.${status}`)}
    </Badge>
  );
}

const DOCTOR: Record<DoctorStatus, { tone: BadgeTone; icon: typeof Clock }> = {
  available: { tone: 'success', icon: DoorOpen },
  on_break: { tone: 'info', icon: Coffee },
  running_late: { tone: 'warning', icon: Clock },
  off: { tone: 'neutral', icon: Moon },
};

export function DoctorStatusPill({
  status,
  delayMins,
  size,
}: {
  status: DoctorStatus;
  delayMins?: number;
  size?: 'sm' | 'md';
}) {
  const { t } = useTranslation();
  const { tone, icon } = DOCTOR[status];
  return (
    <Badge tone={tone} icon={icon} size={size}>
      {t(`doctorStatus.${status}`)}
      {status === 'running_late' && delayMins ? ` · ${t('minutesShort', { count: delayMins })}` : ''}
    </Badge>
  );
}
