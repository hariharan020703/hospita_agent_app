// Patients this doctor has seen, grouped from their appointments, with search by name or phone.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import { DataTable, EmptyState, PageHeader, SearchInput, type Column } from '@/components/ui';
import { useAppointments } from '@/hooks/queries/appointments';
import { useLocale } from '@/hooks/useLocale';
import { formatDate, formatPhone } from '@/lib/format';
import { useDoctorContext } from '../useDoctorContext';
import { seenPatients, type SeenPatient } from '../utils';

export default function PatientsPage() {
  const { t } = useTranslation(['doctor', 'common']);
  const { lang } = useLocale();
  const { doctorId, today } = useDoctorContext();
  const appointments = useAppointments({ doctorId });
  const [search, setSearch] = useState('');

  const patients = useMemo(() => seenPatients(appointments.data ?? [], today), [appointments.data, today]);
  const query = search.trim().toLowerCase();
  const digits = query.replace(/\D/g, '');
  const rows = query
    ? patients.filter((p) => p.name.toLowerCase().includes(query) || (digits.length >= 3 && p.phone.includes(digits)))
    : patients;

  const columns: Column<SeenPatient>[] = [
    {
      id: 'name',
      header: t('patients.columns.name'),
      sortValue: (p) => p.name,
      cell: (p) => (
        <Link to={`/doctor/patients/${p.id}`} className="font-medium text-primary-ink hover:underline">
          {p.name}
        </Link>
      ),
    },
    {
      id: 'phone',
      header: t('patients.columns.phone'),
      cell: (p) => <span className="tabular">{formatPhone(p.phone)}</span>,
      hideBelow: 'md',
    },
    {
      id: 'lastVisit',
      header: t('patients.columns.lastVisit'),
      sortValue: (p) => p.lastVisit,
      cell: (p) => formatDate(p.lastVisit, lang, 'medium'),
    },
    {
      id: 'visits',
      header: t('patients.columns.visits'),
      sortValue: (p) => p.visits,
      align: 'right',
      cell: (p) => <span className="tabular">{p.visits}</span>,
    },
    {
      id: 'nextVisit',
      header: t('patients.columns.nextVisit'),
      sortValue: (p) => p.nextVisit ?? '9999-12-31',
      cell: (p) => (p.nextVisit ? formatDate(p.nextVisit, lang, 'medium') : t('patients.noNextVisit')),
      hideBelow: 'lg',
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title={t('patients.title')} description={t('patients.description')} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          label={t('patients.search')}
          placeholder={t('patients.searchPlaceholder')}
          className="w-full max-w-md"
        />
        {appointments.data && (
          <p aria-live="polite" className="text-sm text-fg-muted">
            {t('patients.count', { count: rows.length })}
          </p>
        )}
      </div>
      <DataTable
        caption={t('patients.caption')}
        columns={columns}
        rows={rows}
        getRowId={(p) => p.id}
        initialSort={{ id: 'lastVisit', dir: 'desc' }}
        loading={appointments.isPending}
        error={appointments.error}
        onRetry={() => void appointments.refetch()}
        empty={
          <EmptyState
            icon={Users}
            title={query ? t('patients.noMatch') : t('patients.emptyTitle')}
            body={query ? t('patients.noMatchBody') : t('patients.emptyBody')}
            className="border-0"
          />
        }
      />
    </div>
  );
}
