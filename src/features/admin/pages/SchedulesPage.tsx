// Schedules: doctor weekly availability, hospital holidays and leave approvals.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader, QueryBoundary, SkeletonCard, Tabs } from '@/components/ui';
import { useHospital, useLeaves } from '@/hooks/queries/directory';
import { HolidaysPanel, LeaveApprovalsPanel, WeeklyAvailabilityPanel } from '../components/SchedulePanels';

type Tab = 'weekly' | 'holidays' | 'leaves';

export default function SchedulesPage() {
  const { t } = useTranslation('admin');
  const hospital = useHospital();
  const pending = useLeaves({ status: 'pending' });
  const [tab, setTab] = useState<Tab>('weekly');

  return (
    <div className="space-y-5">
      <PageHeader title={t('schedules.title')} description={t('schedules.description')} />
      <Tabs
        label={t('schedules.title')}
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'weekly', label: t('schedules.tabs.weekly') },
          { id: 'holidays', label: t('schedules.tabs.holidays') },
          { id: 'leaves', label: t('schedules.tabs.leaves'), count: pending.data?.length },
        ]}
      >
        {(active) =>
          active === 'weekly' ? (
            <WeeklyAvailabilityPanel />
          ) : active === 'holidays' ? (
            <QueryBoundary query={hospital} loading={<SkeletonCard />}>
              {(data) => <HolidaysPanel hospital={data} />}
            </QueryBoundary>
          ) : (
            <LeaveApprovalsPanel />
          )
        }
      </Tabs>
    </div>
  );
}
