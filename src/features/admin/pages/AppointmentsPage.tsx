// Appointments across the hospital: date range, status chips, department, doctor and search filters; CSV export.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Download, SearchX } from 'lucide-react';
import {
  Button,
  DataTable,
  EmptyState,
  Field,
  PageHeader,
  SearchInput,
  Select,
  StatusPill,
  type Column,
} from '@/components/ui';
import { useAppointments } from '@/hooks/queries/appointments';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLocale } from '@/hooks/useLocale';
import { todayIso } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { downloadFile, toCsv, type CsvColumn } from '@/lib/download';
import { formatDate, formatPhone, formatTime } from '@/lib/format';
import { addDaysIso } from '@/lib/time';
import {
  APPOINTMENT_STATUSES,
  type AppointmentFilters,
  type AppointmentStatus,
  type AppointmentView,
  type DateRange,
} from '@/types';
import { DateRangeFields } from '../components/Common';
import { useLookups } from '../hooks';
import { byDateTime } from '../lib';

export default function AppointmentsPage() {
  const { t } = useTranslation(['admin', 'common']);
  const { lang, l, doctorName } = useLocale();
  const { departments, doctors, departmentName } = useLookups();
  const [today] = useState(todayIso);
  const [range, setRange] = useState<DateRange>(() => ({ from: today, to: addDaysIso(today, 7) }));
  const [statuses, setStatuses] = useState<AppointmentStatus[]>([]);
  const [dept, setDept] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q.trim());

  const filters: AppointmentFilters = {
    from: range.from,
    to: range.to,
    ...(statuses.length ? { statuses } : {}),
    ...(dept ? { departmentId: dept } : {}),
    ...(doctorId ? { doctorId } : {}),
    ...(debouncedQ ? { q: debouncedQ } : {}),
  };
  const appointments = useAppointments(filters);
  const rows = appointments.data ?? [];

  const doctorOptions = (doctors.data ?? [])
    .filter((d) => !dept || d.departmentId === dept)
    .map((d) => ({ value: d.id, label: doctorName(d) }));
  const hasFilters = Boolean(statuses.length || dept || doctorId || q);

  const toggleStatus = (status: AppointmentStatus) =>
    setStatuses((current) => (current.includes(status) ? current.filter((s) => s !== status) : [...current, status]));

  const clearFilters = () => {
    setStatuses([]);
    setDept('');
    setDoctorId('');
    setQ('');
  };

  const exportCsv = () => {
    const columns: CsvColumn<AppointmentView>[] = [
      { header: t('appointments.csv.date'), value: (a) => a.date },
      { header: t('appointments.csv.time'), value: (a) => a.start },
      { header: t('appointments.csv.token'), value: (a) => a.token },
      { header: t('appointments.csv.bookingId'), value: (a) => a.bookingRef },
      { header: t('appointments.csv.patient'), value: (a) => a.patientName },
      { header: t('appointments.csv.phone'), value: (a) => a.patientPhone },
      { header: t('appointments.csv.doctor'), value: (a) => doctorName(a) },
      { header: t('appointments.csv.department'), value: (a) => departmentName(a.departmentId) },
      { header: t('appointments.csv.status'), value: (a) => t(`common:status.${a.status}`) },
      { header: t('appointments.csv.source'), value: (a) => t(`appointments.source.${a.source}`) },
    ];
    downloadFile(
      `appointments_${range.from}_${range.to}.csv`,
      toCsv([...rows].sort(byDateTime), columns),
      'text/csv;charset=utf-8',
    );
  };

  const columns: Column<AppointmentView>[] = [
    {
      id: 'when',
      header: t('appointments.columns.when'),
      sortValue: (a) => `${a.date} ${a.start}`,
      cell: (a) => (
        <div className="whitespace-nowrap">
          <p className="font-medium text-fg">{formatDate(a.date, lang, 'weekday')}</p>
          <p className="text-xs text-fg-muted">{formatTime(a.start, lang)}</p>
        </div>
      ),
    },
    {
      id: 'token',
      header: t('appointments.columns.token'),
      sortValue: (a) => a.token,
      cell: (a) => (
        <div>
          <p className="font-mono text-sm font-semibold">{a.token}</p>
          <p className="font-mono text-xs text-fg-muted">{a.bookingRef}</p>
        </div>
      ),
    },
    {
      id: 'patient',
      header: t('appointments.columns.patient'),
      sortValue: (a) => a.patientName,
      cell: (a) => (
        <div className="min-w-[9rem]">
          <p className="font-medium text-fg">{a.patientName}</p>
          <p className="text-xs text-fg-muted tabular">{formatPhone(a.patientPhone)}</p>
        </div>
      ),
    },
    {
      id: 'doctor',
      header: t('appointments.columns.doctor'),
      sortValue: (a) => a.doctorName,
      cell: (a) => doctorName(a),
    },
    {
      id: 'department',
      header: t('appointments.columns.department'),
      hideBelow: 'lg',
      sortValue: (a) => departmentName(a.departmentId),
      cell: (a) => departmentName(a.departmentId),
    },
    {
      id: 'status',
      header: t('appointments.columns.status'),
      sortValue: (a) => APPOINTMENT_STATUSES.indexOf(a.status),
      cell: (a) => <StatusPill status={a.status} />,
    },
    {
      id: 'source',
      header: t('appointments.columns.source'),
      hideBelow: 'xl',
      sortValue: (a) => a.source,
      cell: (a) => t(`appointments.source.${a.source}`),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('appointments.title')}
        description={t('appointments.description')}
        actions={
          <Button
            variant="outline"
            icon={Download}
            onClick={exportCsv}
            disabled={rows.length === 0 || appointments.isPending}
          >
            {t('common:actions.exportCsv')}
          </Button>
        }
      />

      <section aria-label={t('filters.heading')} className="space-y-4 rounded-xl border bg-surface p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,26rem)_1fr_1fr] lg:items-end">
          <DateRangeFields value={range} onChange={setRange} />
          <Field label={t('filters.department')}>
            {(c) => (
              <Select
                {...c}
                value={dept}
                onChange={(e) => {
                  setDept(e.target.value);
                  setDoctorId('');
                }}
                placeholder={t('filters.allDepartments')}
                options={(departments.data ?? []).map((d) => ({ value: d.id, label: l(d.name) }))}
              />
            )}
          </Field>
          <Field label={t('filters.doctor')}>
            {(c) => (
              <Select
                {...c}
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                placeholder={t('filters.allDoctors')}
                options={doctorOptions}
              />
            )}
          </Field>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-fg">{t('filters.statuses')}</legend>
          <div className="flex flex-wrap gap-2">
            {APPOINTMENT_STATUSES.map((status) => {
              const on = statuses.includes(status);
              return (
                <button
                  key={status}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleStatus(status)}
                  className={cn(
                    'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors',
                    on
                      ? 'border-primary bg-primary-soft text-primary-ink'
                      : 'border-border-strong bg-surface text-fg-muted hover:bg-surface-sunken hover:text-fg',
                  )}
                >
                  {on && <Check aria-hidden className="h-4 w-4" />}
                  {t(`common:status.${status}`)}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-fg-subtle">{t('filters.statusesHint')}</p>
        </fieldset>
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={q}
            onChange={setQ}
            label={t('appointments.search')}
            placeholder={t('appointments.searchHint')}
            className="min-w-[16rem] flex-1"
          />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              {t('common:actions.clearFilters')}
            </Button>
          )}
        </div>
      </section>

      <p className="text-sm text-fg-muted" aria-live="polite">
        {appointments.isPending ? '' : t('appointments.count', { count: rows.length })}
      </p>

      <DataTable
        caption={t('appointments.title')}
        columns={columns}
        rows={rows}
        getRowId={(a) => a.id}
        initialSort={{ id: 'when', dir: 'asc' }}
        pageSize={15}
        loading={appointments.isPending}
        error={appointments.error}
        onRetry={() => void appointments.refetch()}
        empty={
          <EmptyState
            icon={SearchX}
            className="border-0"
            title={t('appointments.empty')}
            action={
              hasFilters ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  {t('common:actions.clearFilters')}
                </Button>
              ) : undefined
            }
          />
        }
      />
    </div>
  );
}
