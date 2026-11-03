// Settings: hospital profile, OPD hours, emergency numbers, booking rules, token prefixes, red flags and
// (mock data source only) sample data.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader, QueryBoundary, SkeletonCard, Tabs, type TabItem } from '@/components/ui';
import { env } from '@/config/env';
import { useHospital } from '@/hooks/queries/directory';
import type { Hospital } from '@/types';
import { BookingRulesSection, ContactSection, OpdHoursSection, ProfileSection } from '../components/HospitalSettings';
import { RedFlagsPanel, SampleDataPanel, TokenPrefixesPanel } from '../components/RuleSettings';

type Tab = 'profile' | 'hours' | 'contact' | 'booking' | 'tokens' | 'redFlags' | 'data';

const HOSPITAL_TABS: ReadonlySet<Tab> = new Set<Tab>(['profile', 'hours', 'contact', 'booking']);

function HospitalTab({ tab, hospital }: { tab: Tab; hospital: Hospital }) {
  // Keyed by tab so each section starts from the latest saved hospital record.
  if (tab === 'profile') return <ProfileSection hospital={hospital} />;
  if (tab === 'hours') return <OpdHoursSection hospital={hospital} />;
  if (tab === 'contact') return <ContactSection hospital={hospital} />;
  return <BookingRulesSection hospital={hospital} />;
}

export default function SettingsPage() {
  const { t } = useTranslation('admin');
  const hospital = useHospital();
  const [tab, setTab] = useState<Tab>('profile');

  const tabs: TabItem<Tab>[] = [
    { id: 'profile', label: t('settings.tabs.profile') },
    { id: 'hours', label: t('settings.tabs.hours') },
    { id: 'contact', label: t('settings.tabs.contact') },
    { id: 'booking', label: t('settings.tabs.booking') },
    { id: 'tokens', label: t('settings.tabs.tokens') },
    { id: 'redFlags', label: t('settings.tabs.redFlags') },
    ...(env.dataSource === 'mock' ? [{ id: 'data' as const, label: t('settings.tabs.data') }] : []),
  ];

  return (
    <div className="space-y-5">
      <PageHeader title={t('settings.title')} description={t('settings.description')} />
      <Tabs label={t('settings.title')} tabs={tabs} value={tab} onChange={setTab}>
        {(active) =>
          HOSPITAL_TABS.has(active) ? (
            <QueryBoundary query={hospital} loading={<SkeletonCard />}>
              {(data) => <HospitalTab key={active} tab={active} hospital={data} />}
            </QueryBoundary>
          ) : active === 'tokens' ? (
            <TokenPrefixesPanel />
          ) : active === 'redFlags' ? (
            <RedFlagsPanel />
          ) : (
            <SampleDataPanel />
          )
        }
      </Tabs>
    </div>
  );
}
