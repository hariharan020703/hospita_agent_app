// Weekly calendar of OPD sessions and bookings, plus leave and blocked-time requests.
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Card, CardBody, CardHeader, ErrorState, IconButton, PageHeader, SkeletonList } from '@/components/ui';
import { useAppointments } from '@/hooks/queries/appointments';
import { useHospital, useLeaves, useSchedule } from '@/hooks/queries/directory';
import { useLocale } from '@/hooks/useLocale';
import { formatDate } from '@/lib/format';
import { addDaysIso } from '@/lib/time';
import { LeaveList } from '../components/LeaveList';
import { LeaveRequestDrawer } from '../components/LeaveRequestDrawer';
import { WeekCalendar } from '../components/WeekCalendar';
import { useDoctorContext } from '../useDoctorContext';
import { mondayOf } from '../utils';

export default function SchedulePage() {
  const { t } = useTranslation(['doctor', 'common']);
  const { lang } = useLocale();
  const { doctorId, today } = useDoctorContext();
  const thisWeek = mondayOf(today);
  const [weekStart, setWeekStart] = useState(thisWeek);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const weekEnd = addDaysIso(weekStart, 6);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i)), [weekStart]);

  const schedule = useSchedule(doctorId);
  const appointments = useAppointments({ doctorId, from: weekStart, to: weekEnd });
  const leaves = useLeaves({ doctorId });
  const hospital = useHospital();

  const weekTotal = appointments.data?.filter((a) => a.status !== 'cancelled').length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('schedule.title')}
        description={t('schedule.description')}
        actions={
          <Button icon={CalendarPlus} onClick={() => setDrawerOpen(true)}>
            {t('leave.request')}
          </Button>
        }
      />

      <section aria-labelledby="week-title" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="week-title" aria-live="polite" className="text-lg font-semibold text-fg">
              {t('schedule.week', {
                from: formatDate(weekStart, lang, 'dayMonth'),
                to: formatDate(weekEnd, lang, 'medium'),
              })}
            </h2>
            {appointments.data && (
              <p className="text-sm text-fg-muted">{t('schedule.weekTotal', { count: weekTotal })}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <IconButton
              icon={ChevronLeft}
              variant="outline"
              label={t('schedule.previousWeek')}
              onClick={() => setWeekStart((w) => addDaysIso(w, -7))}
            />
            <Button variant="outline" disabled={weekStart === thisWeek} onClick={() => setWeekStart(thisWeek)}>
              {t('schedule.thisWeek')}
            </Button>
            <IconButton
              icon={ChevronRight}
              variant="outline"
              label={t('schedule.nextWeek')}
              onClick={() => setWeekStart((w) => addDaysIso(w, 7))}
            />
          </div>
        </div>

        {appointments.isError && (
          <ErrorState
            title={t('schedule.appointmentsError')}
            error={appointments.error}
            onRetry={() => void appointments.refetch()}
          />
        )}
        {schedule.isPending ? (
          <SkeletonList rows={2} rowClassName="h-40" />
        ) : schedule.isError ? (
          <ErrorState error={schedule.error} onRetry={() => void schedule.refetch()} />
        ) : (
          <WeekCalendar
            days={days}
            weekly={schedule.data.weekly}
            appointments={appointments.data ?? []}
            appointmentsLoading={appointments.isPending}
            leaves={leaves.data ?? []}
            holidays={hospital.data?.holidays ?? []}
            today={today}
          />
        )}
      </section>

      <Card>
        <CardHeader title={t('leave.title')} description={t('leave.description')} />
        <CardBody>
          <LeaveList doctorId={doctorId} today={today} />
        </CardBody>
      </Card>

      {drawerOpen && <LeaveRequestDrawer doctorId={doctorId} today={today} onClose={() => setDrawerOpen(false)} />}
    </div>
  );
}
