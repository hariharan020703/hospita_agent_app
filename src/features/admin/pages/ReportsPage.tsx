// Reports built from appointments in a date range: daily OPD summary, department volume and the no-show list.
// Each has a preview table and a CSV download.
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileSpreadsheet } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  SkeletonCard,
  type Column,
} from '@/components/ui';
import { useAppointments } from '@/hooks/queries/appointments';
import { useLocale } from '@/hooks/useLocale';
import { todayIso } from '@/lib/clock';
import { downloadFile, toCsv, type CsvColumn } from '@/lib/download';
import { formatDate, formatNumber, formatPercent, formatPhone, formatTime } from '@/lib/format';
import { addDaysIso } from '@/lib/time';
import type { AppointmentView, DateRange } from '@/types';
import { DateRangeFields } from '../components/Common';
import { useLookups } from '../hooks';
import { byDateTime, dailySummary, departmentVolume, type DailySummaryRow, type DepartmentVolumeRow } from '../lib';

function ReportCard({
  title,
  description,
  onDownload,
  disabled,
  children,
}: {
  title: string;
  description: string;
  onDownload: () => void;
  disabled: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation('admin');
  return (
    <Card>
      <CardHeader
        title={title}
        description={description}
        actions={
          <Button variant="outline" size="sm" icon={Download} onClick={onDownload} disabled={disabled}>
            {t('reports.download')}
            <span className="sr-only">: {title}</span>
          </Button>
        }
      />
      <CardBody>{children}</CardBody>
    </Card>
  );
}

export default function ReportsPage() {
  const { t } = useTranslation(['admin', 'common']);
  const { lang, doctorName } = useLocale();
  const { departmentName } = useLookups();
  const [today] = useState(todayIso);
  const [range, setRange] = useState<DateRange>(() => ({ from: addDaysIso(today, -6), to: today }));
  const appointments = useAppointments({ from: range.from, to: range.to });

  const list = appointments.data ?? [];
  const daily = dailySummary(list);
  const departments = departmentVolume(list);
  const noShows = list.filter((a) => a.status === 'no_show').sort(byDateTime);
  const suffix = `${range.from}_${range.to}`;
  const csv = <T,>(name: string, rows: readonly T[], columns: CsvColumn<T>[]) =>
    downloadFile(`${name}_${suffix}.csv`, toCsv(rows, columns), 'text/csv;charset=utf-8');

  const totals = daily.reduce(
    (sum, row) => ({
      total: sum.total + row.total,
      completed: sum.completed + row.completed,
      noShows: sum.noShows + row.noShows,
      cancelled: sum.cancelled + row.cancelled,
    }),
    { total: 0, completed: 0, noShows: 0, cancelled: 0 },
  );

  const num = (value: number) => <span className="tabular">{formatNumber(value, lang)}</span>;

  const dailyColumns: Column<DailySummaryRow>[] = [
    {
      id: 'date',
      header: t('reports.columns.date'),
      sortValue: (r) => r.date,
      cell: (r) => formatDate(r.date, lang, 'weekday'),
    },
    {
      id: 'total',
      header: t('reports.columns.total'),
      align: 'right',
      sortValue: (r) => r.total,
      cell: (r) => num(r.total),
    },
    {
      id: 'completed',
      header: t('reports.columns.completed'),
      align: 'right',
      sortValue: (r) => r.completed,
      cell: (r) => num(r.completed),
    },
    {
      id: 'noShows',
      header: t('reports.columns.noShows'),
      align: 'right',
      sortValue: (r) => r.noShows,
      cell: (r) => num(r.noShows),
    },
    {
      id: 'cancelled',
      header: t('reports.columns.cancelled'),
      align: 'right',
      sortValue: (r) => r.cancelled,
      cell: (r) => num(r.cancelled),
    },
  ];

  const deptColumns: Column<DepartmentVolumeRow>[] = [
    {
      id: 'department',
      header: t('reports.columns.department'),
      sortValue: (r) => departmentName(r.departmentId),
      cell: (r) => departmentName(r.departmentId),
    },
    {
      id: 'total',
      header: t('reports.columns.total'),
      align: 'right',
      sortValue: (r) => r.total,
      cell: (r) => num(r.total),
    },
    {
      id: 'completed',
      header: t('reports.columns.completed'),
      align: 'right',
      sortValue: (r) => r.completed,
      cell: (r) => num(r.completed),
    },
    {
      id: 'noShows',
      header: t('reports.columns.noShows'),
      align: 'right',
      sortValue: (r) => r.noShows,
      cell: (r) => num(r.noShows),
    },
    {
      id: 'cancelled',
      header: t('reports.columns.cancelled'),
      align: 'right',
      sortValue: (r) => r.cancelled,
      cell: (r) => num(r.cancelled),
    },
    {
      id: 'rate',
      header: t('reports.columns.noShowRate'),
      align: 'right',
      sortValue: (r) => r.noShowRate,
      cell: (r) => <span className="tabular">{formatPercent(r.noShowRate, lang)}</span>,
    },
  ];

  const noShowColumns: Column<AppointmentView>[] = [
    {
      id: 'when',
      header: t('reports.columns.when'),
      sortValue: (a) => `${a.date} ${a.start}`,
      cell: (a) => `${formatDate(a.date, lang, 'medium')} · ${formatTime(a.start, lang)}`,
    },
    {
      id: 'token',
      header: t('reports.columns.token'),
      sortValue: (a) => a.token,
      cell: (a) => <span className="font-mono">{a.token}</span>,
    },
    {
      id: 'patient',
      header: t('reports.columns.patient'),
      sortValue: (a) => a.patientName,
      cell: (a) => (
        <div>
          <p className="font-medium">{a.patientName}</p>
          <p className="text-xs text-fg-muted tabular">{formatPhone(a.patientPhone)}</p>
        </div>
      ),
    },
    { id: 'doctor', header: t('reports.columns.doctor'), sortValue: (a) => a.doctorName, cell: (a) => doctorName(a) },
    {
      id: 'department',
      header: t('reports.columns.department'),
      hideBelow: 'lg',
      sortValue: (a) => departmentName(a.departmentId),
      cell: (a) => departmentName(a.departmentId),
    },
  ];

  const downloadDaily = () =>
    csv('opd-daily-summary', daily, [
      { header: t('reports.columns.date'), value: (r) => r.date },
      { header: t('reports.columns.total'), value: (r) => r.total },
      { header: t('reports.columns.completed'), value: (r) => r.completed },
      { header: t('reports.columns.noShows'), value: (r) => r.noShows },
      { header: t('reports.columns.cancelled'), value: (r) => r.cancelled },
    ]);

  const downloadDepartments = () =>
    csv('department-volume', departments, [
      { header: t('reports.columns.department'), value: (r) => departmentName(r.departmentId) },
      { header: t('reports.columns.total'), value: (r) => r.total },
      { header: t('reports.columns.completed'), value: (r) => r.completed },
      { header: t('reports.columns.noShows'), value: (r) => r.noShows },
      { header: t('reports.columns.cancelled'), value: (r) => r.cancelled },
      { header: t('reports.columns.noShowRate'), value: (r) => (r.noShowRate * 100).toFixed(1) },
    ]);

  const downloadNoShows = () =>
    csv('no-shows', noShows, [
      { header: t('reports.columns.date'), value: (a) => a.date },
      { header: t('reports.columns.time'), value: (a) => a.start },
      { header: t('reports.columns.token'), value: (a) => a.token },
      { header: t('reports.columns.bookingId'), value: (a) => a.bookingRef },
      { header: t('reports.columns.patient'), value: (a) => a.patientName },
      { header: t('reports.columns.phone'), value: (a) => a.patientPhone },
      { header: t('reports.columns.doctor'), value: (a) => doctorName(a) },
      { header: t('reports.columns.department'), value: (a) => departmentName(a.departmentId) },
    ]);

  const empty = <EmptyState icon={FileSpreadsheet} title={t('reports.empty')} className="border-0" />;

  return (
    <div className="space-y-6">
      <PageHeader title={t('reports.title')} description={t('reports.description')} />

      <section aria-label={t('range.label')} className="rounded-xl border bg-surface p-4">
        <DateRangeFields
          value={range}
          onChange={setRange}
          min={addDaysIso(today, -365)}
          max={addDaysIso(today, 90)}
          className="max-w-xl"
        />
      </section>

      {appointments.isPending ? (
        <div className="space-y-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : appointments.isError ? (
        <ErrorState error={appointments.error} onRetry={() => void appointments.refetch()} />
      ) : (
        <>
          <ReportCard
            title={t('reports.daily.title')}
            description={t('reports.daily.description', {
              total: formatNumber(totals.total, lang),
              completed: formatNumber(totals.completed, lang),
              noShows: formatNumber(totals.noShows, lang),
              cancelled: formatNumber(totals.cancelled, lang),
            })}
            onDownload={downloadDaily}
            disabled={daily.length === 0}
          >
            <DataTable
              caption={t('reports.daily.title')}
              columns={dailyColumns}
              rows={daily}
              getRowId={(r) => r.date}
              initialSort={{ id: 'date', dir: 'asc' }}
              pageSize={7}
              empty={empty}
            />
          </ReportCard>

          <ReportCard
            title={t('reports.departments.title')}
            description={t('reports.departments.description')}
            onDownload={downloadDepartments}
            disabled={departments.length === 0}
          >
            <DataTable
              caption={t('reports.departments.title')}
              columns={deptColumns}
              rows={departments}
              getRowId={(r) => r.departmentId}
              initialSort={{ id: 'total', dir: 'desc' }}
              empty={empty}
            />
          </ReportCard>

          <ReportCard
            title={t('reports.noShows.title')}
            description={t('reports.noShows.description', { count: noShows.length })}
            onDownload={downloadNoShows}
            disabled={noShows.length === 0}
          >
            <DataTable
              caption={t('reports.noShows.title')}
              columns={noShowColumns}
              rows={noShows}
              getRowId={(a) => a.id}
              initialSort={{ id: 'when', dir: 'asc' }}
              empty={empty}
            />
          </ReportCard>
        </>
      )}
    </div>
  );
}
