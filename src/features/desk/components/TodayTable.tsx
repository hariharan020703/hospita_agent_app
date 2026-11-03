// "All patients today": every appointment for today in one sortable table, with the same row actions as the board.
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarX2 } from 'lucide-react';
import { DataTable, EmptyState, StatusPill, type Column } from '@/components/ui';
import { useLocale } from '@/hooks/useLocale';
import { formatPhone, formatTime } from '@/lib/format';
import { APPOINTMENT_STATUSES, type AppointmentView, type Department } from '@/types';
import { RowActionButtons } from './RowActions';

export function TodayTable({
  rows,
  departments,
  loading,
  error,
  onRetry,
}: {
  rows: readonly AppointmentView[] | undefined;
  departments: readonly Department[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const { t } = useTranslation(['desk', 'common']);
  const { lang, l, doctorName } = useLocale();

  const columns = useMemo<Column<AppointmentView>[]>(() => {
    const departmentName = (id: string) => l(departments.find((d) => d.id === id)?.name);
    return [
      {
        id: 'token',
        header: t('table.token'),
        sortValue: (a) => a.token,
        cell: (a) => <span className="font-mono font-semibold tabular">{a.token}</span>,
      },
      {
        id: 'time',
        header: t('table.time'),
        sortValue: (a) => a.start,
        cell: (a) => <span className="whitespace-nowrap tabular">{formatTime(a.start, lang)}</span>,
      },
      {
        id: 'patient',
        header: t('table.patient'),
        sortValue: (a) => a.patientName,
        cell: (a) => (
          <div className="min-w-[9rem]">
            <p className="break-words font-medium text-fg">{a.patientName}</p>
            <p className="text-xs text-fg-muted tabular">{formatPhone(a.patientPhone)}</p>
          </div>
        ),
      },
      {
        id: 'doctor',
        header: t('table.doctor'),
        sortValue: (a) => a.doctorName,
        cell: (a) => (
          <div className="min-w-[8rem]">
            <p className="break-words text-fg">{doctorName(a)}</p>
            <p className="text-xs text-fg-muted">{t('common:room', { room: a.room })}</p>
          </div>
        ),
      },
      {
        id: 'department',
        header: t('table.department'),
        hideBelow: 'xl',
        sortValue: (a) => departmentName(a.departmentId),
        cell: (a) => departmentName(a.departmentId),
      },
      {
        id: 'source',
        header: t('table.source'),
        hideBelow: 'xl',
        sortValue: (a) => a.source,
        cell: (a) => t(`channel.${a.source}`),
      },
      {
        id: 'status',
        header: t('table.status'),
        sortValue: (a) => APPOINTMENT_STATUSES.indexOf(a.status),
        cell: (a) => <StatusPill status={a.status} />,
      },
      {
        id: 'actions',
        header: t('common:table.actions'),
        align: 'right',
        cell: (a) => <RowActionButtons appointment={a} />,
      },
    ];
  }, [t, l, lang, doctorName, departments]);

  return (
    <DataTable
      caption={t('board.tableCaption')}
      columns={columns}
      rows={rows}
      getRowId={(a) => a.id}
      initialSort={{ id: 'time', dir: 'asc' }}
      pageSize={15}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={
        <EmptyState
          icon={CalendarX2}
          title={t('board.noAppointments')}
          body={t('board.noAppointmentsBody')}
          className="border-0"
        />
      }
    />
  );
}
