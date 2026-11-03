// Doctor's day: status, today's numbers, the current consultation, the next patient with the AI summary, and the queue.
import { useTranslation } from 'react-i18next';
import { DoctorStatusPill, ErrorState, PageHeader, SkeletonCard, SkeletonList } from '@/components/ui';
import { useDepartments, useDoctor } from '@/hooks/queries/directory';
import { useDoctorDay, useDoctorQueue } from '@/hooks/queries/queue';
import { useLocale } from '@/hooks/useLocale';
import { formatDate } from '@/lib/format';
import { CurrentConsultationCard } from '../components/CurrentConsultation';
import { NextPatientCard } from '../components/NextPatientCard';
import { QueueList } from '../components/QueueList';
import { StatsStrip } from '../components/StatsStrip';
import { StatusCard } from '../components/StatusCard';
import { useDoctorContext } from '../useDoctorContext';
import { UrgentFollowUps } from './FollowUpsPage';

export default function TodayPage() {
  const { t } = useTranslation(['doctor', 'common']);
  const { lang, l, doctorName } = useLocale();
  const { doctorId, today } = useDoctorContext();
  const doctor = useDoctor(doctorId);
  const departments = useDepartments();
  const queue = useDoctorQueue(doctorId);
  const day = useDoctorDay(doctorId);
  const department = departments.data?.find((d) => d.id === doctor.data?.departmentId);
  const status = day.data ?? queue.data?.day;

  const description = [
    l(department?.name),
    doctor.data ? t('common:room', { room: doctor.data.room }) : '',
    formatDate(today, lang, 'long'),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-6">
      <PageHeader
        title={doctor.data ? doctorName(doctor.data) : t('today.title')}
        description={description}
        actions={status && <DoctorStatusPill status={status.status} delayMins={status.delayMins} size="md" />}
      />
      {doctor.isError && <ErrorState error={doctor.error} onRetry={() => void doctor.refetch()} />}
      <UrgentFollowUps doctorId={doctorId} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
        <div className="min-w-0 space-y-6">
          {queue.isPending ? (
            <>
              <SkeletonList rows={1} rowClassName="h-24" />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : queue.isError ? (
            <ErrorState error={queue.error} onRetry={() => void queue.refetch()} />
          ) : (
            <>
              <StatsStrip queue={queue.data} />
              <CurrentConsultationCard current={queue.data.current} today={today} />
              <NextPatientCard queue={queue.data} doctorId={doctorId} />
            </>
          )}
        </div>
        <div className="min-w-0 space-y-6">
          <StatusCard doctorId={doctorId} />
          {/* A queue error is shown once, with retry, in the main column. */}
          {queue.isPending ? (
            <SkeletonList rows={5} rowClassName="h-14" />
          ) : (
            queue.data && <QueueList queue={queue.data} />
          )}
        </div>
      </div>
    </div>
  );
}
