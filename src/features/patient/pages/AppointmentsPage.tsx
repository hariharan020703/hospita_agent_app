import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, History } from 'lucide-react';
import { buttonClasses, EmptyState, QueryBoundary, SkeletonList, Tabs } from '@/components/ui';
import { AppointmentCard } from '@/components/domain/Cards';
import { useAppointments } from '@/hooks/queries/appointments';
import { isActiveStatus } from '@/types';
import { usePatientContext } from '../usePatientContext';

export default function AppointmentsPage() {
  const { t } = useTranslation('patient');
  const { householdIds, today, session } = usePatientContext();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const appointments = useAppointments({ patientIds: householdIds }, { enabled: householdIds.length > 0 });

  const all = appointments.data ?? [];
  const upcoming = all.filter((a) => a.date >= today && isActiveStatus(a.status));
  const past = all.filter((a) => !(a.date >= today && isActiveStatus(a.status))).reverse();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-fg">{t('appointments.title')}</h1>
      <Tabs
        label={t('appointments.title')}
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'upcoming', label: t('appointments.upcoming'), count: appointments.data ? upcoming.length : undefined },
          { id: 'past', label: t('appointments.past') },
        ]}
      >
        {(active) => (
          <QueryBoundary query={appointments} loading={<SkeletonList rows={3} rowClassName="h-28" />}>
            {() => {
              const list = active === 'upcoming' ? upcoming : past;
              if (list.length === 0) {
                return active === 'upcoming' ? (
                  <EmptyState
                    icon={CalendarDays}
                    title={t('appointments.emptyUpcoming')}
                    body={t('appointments.emptyUpcomingBody')}
                    action={
                      <Link to="/app/assistant" className={buttonClasses('primary')}>
                        {t('home.bookNow')}
                      </Link>
                    }
                  />
                ) : (
                  <EmptyState icon={History} title={t('appointments.emptyPast')} />
                );
              }
              return (
                <ul className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                  {list.map((a) => (
                    <li key={a.id}>
                      <AppointmentCard
                        appointment={a}
                        today={today}
                        to={`/app/appointments/${a.id}`}
                        showPatient={a.patientId !== session?.patientId}
                      />
                    </li>
                  ))}
                </ul>
              );
            }}
          </QueryBoundary>
        )}
      </Tabs>
    </div>
  );
}
