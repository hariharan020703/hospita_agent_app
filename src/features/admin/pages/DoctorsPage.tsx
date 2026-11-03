// Doctors: searchable, filterable, sortable table with create/edit drawer and activate/deactivate.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, CircleSlash, Pencil, Plus, Power, PowerOff, SearchX } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  PageHeader,
  SearchInput,
  Select,
  type Column,
} from '@/components/ui';
import { useDepartments, useDoctors, useSetDoctorActive } from '@/hooks/queries/directory';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLocale } from '@/hooks/useLocale';
import { formatCurrency } from '@/lib/format';
import type { DoctorListItem } from '@/services';
import type { Doctor } from '@/types';
import { DoctorDrawer } from '../components/DoctorDrawer';

type StatusFilter = 'all' | 'active' | 'inactive';

export default function DoctorsPage() {
  const { t } = useTranslation(['admin', 'common']);
  const { lang, l, doctorName } = useLocale();
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [editing, setEditing] = useState<{ doctor: Doctor | null } | null>(null);
  const [toggling, setToggling] = useState<Doctor | null>(null);
  const debouncedQ = useDebouncedValue(q.trim());

  const departments = useDepartments(true);
  const doctors = useDoctors({
    includeInactive: true,
    ...(dept ? { departmentId: dept } : {}),
    ...(debouncedQ ? { q: debouncedQ } : {}),
  });
  const setActive = useSetDoctorActive();

  const rows = (doctors.data ?? []).filter((d) => status === 'all' || (status === 'active') === d.active);
  const departmentName = (id: string) => l(departments.data?.find((d) => d.id === id)?.name) || id;
  const hasFilters = Boolean(q || dept || status !== 'all');

  const columns: Column<DoctorListItem>[] = [
    {
      id: 'name',
      header: t('doctors.columns.doctor'),
      sortValue: (d) => d.name,
      cell: (d) => (
        <div className="flex min-w-[12rem] items-center gap-3">
          <Avatar name={d.name} src={d.photoUrl} size="sm" />
          <div className="min-w-0">
            <p className="font-medium text-fg">{doctorName(d)}</p>
            <p className="truncate text-xs text-fg-muted">{d.qualifications.join(', ')}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'department',
      header: t('doctors.columns.department'),
      sortValue: (d) => departmentName(d.departmentId),
      cell: (d) => departmentName(d.departmentId),
    },
    {
      id: 'languages',
      header: t('doctors.columns.languages'),
      hideBelow: 'xl',
      cell: (d) => (
        <div className="flex flex-wrap gap-1">
          {d.languages.map((code) => (
            <Badge key={code}>{t(`common:language.${code}`)}</Badge>
          ))}
        </div>
      ),
    },
    {
      id: 'fee',
      header: t('doctors.columns.fee'),
      align: 'right',
      sortValue: (d) => d.fee,
      cell: (d) => <span className="tabular">{formatCurrency(d.fee, lang)}</span>,
    },
    {
      id: 'consult',
      header: t('doctors.columns.consult'),
      align: 'right',
      hideBelow: 'lg',
      sortValue: (d) => d.consultMins,
      cell: (d) => <span className="tabular">{t('common:minutesShort', { count: d.consultMins })}</span>,
    },
    {
      id: 'room',
      header: t('doctors.columns.room'),
      hideBelow: 'lg',
      sortValue: (d) => d.room,
      cell: (d) => d.room,
    },
    {
      id: 'status',
      header: t('doctors.columns.status'),
      sortValue: (d) => (d.active ? 0 : 1),
      cell: (d) =>
        d.active ? (
          <Badge tone="success" icon={CheckCircle2}>
            {t('status.active')}
          </Badge>
        ) : (
          <Badge icon={CircleSlash}>{t('status.inactive')}</Badge>
        ),
    },
    {
      id: 'actions',
      header: t('common:table.actions'),
      align: 'right',
      cell: (d) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" icon={Pencil} onClick={() => setEditing({ doctor: d })}>
            {t('common:actions.edit')}
            <span className="sr-only">: {d.name}</span>
          </Button>
          {d.active ? (
            <Button variant="dangerOutline" size="sm" icon={PowerOff} onClick={() => setToggling(d)}>
              {t('doctors.deactivate')}
              <span className="sr-only">: {d.name}</span>
            </Button>
          ) : (
            <Button variant="outline" size="sm" icon={Power} onClick={() => setToggling(d)}>
              {t('doctors.activate')}
              <span className="sr-only">: {d.name}</span>
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('doctors.title')}
        description={t('doctors.description')}
        actions={
          <Button icon={Plus} onClick={() => setEditing({ doctor: null })} disabled={!departments.data}>
            {t('doctors.add')}
          </Button>
        }
      />

      <div className="grid gap-3 rounded-xl border bg-surface p-4 md:grid-cols-[1fr_14rem_12rem] md:items-end">
        <SearchInput value={q} onChange={setQ} label={t('doctors.search')} placeholder={t('doctors.searchHint')} />
        <Field label={t('filters.department')}>
          {(c) => (
            <Select
              {...c}
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              placeholder={t('filters.allDepartments')}
              options={(departments.data ?? []).map((d) => ({ value: d.id, label: l(d.name) }))}
            />
          )}
        </Field>
        <Field label={t('filters.status')}>
          {(c) => (
            <Select
              {...c}
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              options={[
                { value: 'all', label: t('filters.allStatuses') },
                { value: 'active', label: t('status.active') },
                { value: 'inactive', label: t('status.inactive') },
              ]}
            />
          )}
        </Field>
      </div>

      <p className="text-sm text-fg-muted" aria-live="polite">
        {doctors.isPending ? '' : t('doctors.count', { count: rows.length })}
      </p>

      <DataTable
        caption={t('doctors.title')}
        columns={columns}
        rows={rows}
        getRowId={(d) => d.id}
        initialSort={{ id: 'name', dir: 'asc' }}
        loading={doctors.isPending}
        error={doctors.error}
        onRetry={() => void doctors.refetch()}
        empty={
          <EmptyState
            icon={SearchX}
            title={t('doctors.empty')}
            className="border-0"
            action={
              hasFilters ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQ('');
                    setDept('');
                    setStatus('all');
                  }}
                >
                  {t('common:actions.clearFilters')}
                </Button>
              ) : undefined
            }
          />
        }
      />

      {editing && departments.data && (
        <DoctorDrawer
          key={editing.doctor?.id ?? 'new'}
          doctor={editing.doctor}
          departments={departments.data}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={toggling !== null}
        onClose={() => setToggling(null)}
        tone={toggling?.active ? 'danger' : 'primary'}
        loading={setActive.isPending}
        title={
          toggling?.active
            ? t('doctors.deactivateTitle', { name: toggling.name })
            : t('doctors.activateTitle', { name: toggling?.name ?? '' })
        }
        body={toggling?.active ? t('doctors.deactivateBody') : t('doctors.activateBody')}
        confirmLabel={toggling?.active ? t('doctors.deactivate') : t('doctors.activate')}
        onConfirm={() =>
          toggling &&
          setActive.mutate({ id: toggling.id, active: !toggling.active }, { onSuccess: () => setToggling(null) })
        }
      />
    </div>
  );
}
