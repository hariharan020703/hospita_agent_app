// Schedules screen panels: doctor weekly availability, hospital holidays and leave approvals.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarOff, Check, Plus, RotateCcw, Save, SearchX, Trash2, UserRound, X } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Combobox,
  ConfirmDialog,
  DataTable,
  DatePicker,
  EmptyState,
  Field,
  IconButton,
  Input,
  QueryBoundary,
  SearchInput,
  Select,
  SkeletonList,
  Tabs,
  toast,
  type BadgeTone,
  type Column,
} from '@/components/ui';
import { useSession } from '@/features/auth/session';
import {
  useDecideLeave,
  useLeaves,
  useSchedule,
  useUpdateHospital,
  useUpdateWeeklySchedule,
} from '@/hooks/queries/directory';
import { useLocale } from '@/hooks/useLocale';
import { todayIso } from '@/lib/clock';
import { formatDate, formatDateTime, formatTime } from '@/lib/format';
import { hospitalSchema, type Hospital, type Leave, type LeaveStatus, type WeeklyHours } from '@/types';
import { hasWeeklyIssues, sortWeekly, validateWeekly } from '../lib';
import { useLookups } from '../hooks';
import { FormField } from './FormField';
import { WeeklyHoursEditor } from './WeeklyHoursEditor';

// ---------------------------------------------------------------- (1) weekly availability

function WeeklyScheduleForm({ doctorId, initial }: { doctorId: string; initial: WeeklyHours }) {
  const { t } = useTranslation(['admin', 'common']);
  const [draft, setDraft] = useState<WeeklyHours>(initial);
  const [attempted, setAttempted] = useState(false);
  const update = useUpdateWeeklySchedule();
  const issues = validateWeekly(draft);
  const invalid = hasWeeklyIssues(issues);

  const save = () => {
    setAttempted(true);
    if (invalid) return;
    update.mutate({ doctorId, weekly: sortWeekly(draft) });
  };

  return (
    <div className="space-y-4">
      <WeeklyHoursEditor value={draft} onChange={setDraft} issues={issues} label={t('schedules.weekly.editorLabel')} />
      {attempted && invalid && (
        <p role="alert" className="text-sm font-medium text-warning-ink">
          {t('hours.fixErrors')}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" icon={RotateCcw} onClick={() => setDraft(initial)} disabled={update.isPending}>
          {t('common:actions.reset')}
        </Button>
        <Button icon={Save} onClick={save} loading={update.isPending}>
          {t('schedules.weekly.save')}
        </Button>
      </div>
    </div>
  );
}

export function WeeklyAvailabilityPanel() {
  const { t } = useTranslation(['admin', 'common']);
  const { doctors, departmentName, doctorLabel } = useLookups();
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const schedule = useSchedule(doctorId ?? undefined);

  const options = (doctors.data ?? []).map((d) => ({
    value: d.id,
    label: d.active ? doctorLabel(d.id) : `${doctorLabel(d.id)} (${t('status.inactive')})`,
    description: departmentName(d.departmentId),
    keywords: `${d.name} ${d.nameTa ?? ''} ${d.room}`,
  }));
  const doctor = doctors.data?.find((d) => d.id === doctorId);

  return (
    <Card>
      <CardHeader title={t('schedules.weekly.title')} description={t('schedules.weekly.description')} />
      <CardBody className="space-y-5">
        <Field label={t('schedules.weekly.doctor')} className="max-w-md">
          {(c) => (
            <Combobox
              control={c}
              options={options}
              value={doctorId}
              onChange={setDoctorId}
              placeholder={doctors.isPending ? t('common:states.loading') : t('schedules.weekly.chooseDoctor')}
              emptyText={t('schedules.weekly.noDoctors')}
            />
          )}
        </Field>
        {!doctorId ? (
          <EmptyState
            icon={UserRound}
            title={t('schedules.weekly.pickFirst')}
            body={t('schedules.weekly.pickFirstBody')}
          />
        ) : (
          <>
            {doctor && (
              <div className="flex items-center gap-3">
                <Avatar name={doctor.name} src={doctor.photoUrl} />
                <div>
                  <p className="font-semibold text-fg">{doctorLabel(doctor.id)}</p>
                  <p className="text-sm text-fg-muted">
                    {departmentName(doctor.departmentId)} · {t('common:room', { room: doctor.room })}
                  </p>
                </div>
              </div>
            )}
            <QueryBoundary query={schedule} loading={<SkeletonList rows={7} rowClassName="h-12" />}>
              {(data) => <WeeklyScheduleForm key={doctorId} doctorId={doctorId} initial={data.weekly} />}
            </QueryBoundary>
          </>
        )}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------- (2) hospital holidays

export function HolidaysPanel({ hospital }: { hospital: Hospital }) {
  const { t } = useTranslation(['admin', 'common']);
  const { lang, l } = useLocale();
  const update = useUpdateHospital();
  const [today] = useState(todayIso);
  const [date, setDate] = useState<string | null>(null);
  const [nameEn, setNameEn] = useState('');
  const [nameTa, setNameTa] = useState('');
  const [errors, setErrors] = useState<{ date?: string; dateText?: string; en?: string; ta?: string }>({});
  const [q, setQ] = useState('');
  const [showPast, setShowPast] = useState(false);

  const holidays = [...hospital.holidays].sort((a, b) => a.date.localeCompare(b.date));
  const needle = q.trim().toLowerCase();
  const visible = holidays.filter(
    (h) =>
      (showPast || h.date >= today) &&
      (!needle || h.name.en.toLowerCase().includes(needle) || h.name.ta.includes(needle)),
  );

  const saveHolidays = (next: Hospital['holidays'], onSuccess?: () => void) => {
    const parsed = hospitalSchema.safeParse({ ...hospital, holidays: next });
    if (!parsed.success) {
      toast.error(t('common:errors.VALIDATION'));
      return;
    }
    update.mutate(parsed.data, { onSuccess });
  };

  const add = () => {
    const next: typeof errors = {};
    if (!date) next.date = 'required';
    else if (hospital.holidays.some((h) => h.date === date)) next.dateText = t('schedules.holidays.duplicate');
    if (!nameEn.trim()) next.en = 'required';
    if (!nameTa.trim()) next.ta = 'required';
    setErrors(next);
    if (Object.keys(next).length > 0 || !date) return;
    saveHolidays([...hospital.holidays, { date, name: { en: nameEn.trim(), ta: nameTa.trim() } }], () => {
      setDate(null);
      setNameEn('');
      setNameTa('');
    });
  };

  return (
    <Card>
      <CardHeader title={t('schedules.holidays.title')} description={t('schedules.holidays.description')} />
      <CardBody className="space-y-6">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="grid gap-3 rounded-lg border bg-surface-muted p-4 md:grid-cols-[12rem_1fr_1fr_auto] md:items-start"
        >
          <FormField label={t('schedules.holidays.date')} error={errors.date} errorText={errors.dateText} required>
            {(c) => <DatePicker control={c} value={date} onChange={setDate} min={today} />}
          </FormField>
          <FormField label={t('schedules.holidays.nameEn')} error={errors.en} required>
            {(c) => <Input {...c} value={nameEn} onChange={(e) => setNameEn(e.target.value)} lang="en" />}
          </FormField>
          <FormField label={t('schedules.holidays.nameTa')} error={errors.ta} required>
            {(c) => <Input {...c} value={nameTa} onChange={(e) => setNameTa(e.target.value)} lang="ta" />}
          </FormField>
          <Button type="submit" icon={Plus} loading={update.isPending} className="md:mt-7">
            {t('schedules.holidays.add')}
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={q}
            onChange={setQ}
            label={t('schedules.holidays.search')}
            className="min-w-[16rem] flex-1"
          />
          <label className="flex items-center gap-2 text-sm text-fg">
            <input
              type="checkbox"
              checked={showPast}
              onChange={(e) => setShowPast(e.target.checked)}
              className="h-4 w-4 accent-[rgb(var(--color-primary))]"
            />
            {t('schedules.holidays.showPast')}
          </label>
        </div>

        {visible.length === 0 ? (
          <EmptyState icon={CalendarOff} title={t('schedules.holidays.empty')} />
        ) : (
          <ul className="divide-y rounded-xl border">
            {visible.map((h) => (
              <li key={h.date} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-fg">{l(h.name)}</p>
                  <p className="text-sm text-fg-muted">
                    {formatDate(h.date, lang, 'long')}
                    {h.date < today && ` · ${t('schedules.holidays.past')}`}
                  </p>
                </div>
                <IconButton
                  icon={Trash2}
                  label={t('schedules.holidays.remove', { name: l(h.name) })}
                  disabled={update.isPending}
                  onClick={() => saveHolidays(hospital.holidays.filter((x) => x.date !== h.date))}
                />
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------- (3) leave approvals

const STATUS_TONE: Record<LeaveStatus, BadgeTone> = { pending: 'warning', approved: 'success', rejected: 'neutral' };

function LeaveTable({ status }: { status: 'pending' | 'history' }) {
  const { t } = useTranslation(['admin', 'common']);
  const { lang } = useLocale();
  const session = useSession();
  const { doctorLabel, departmentName, doctorById } = useLookups();
  const leaves = useLeaves(status === 'pending' ? { status: 'pending' } : {});
  const decide = useDecideLeave();
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | LeaveStatus>('');
  const [rejecting, setRejecting] = useState<Leave | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const needle = q.trim().toLowerCase();
  const rows = (leaves.data ?? []).filter(
    (leave) =>
      (!statusFilter || leave.status === statusFilter) &&
      (!needle ||
        doctorLabel(leave.doctorId).toLowerCase().includes(needle) ||
        leave.reason.toLowerCase().includes(needle)),
  );

  const act = (leave: Leave, decision: 'approved' | 'rejected', onDone?: () => void) => {
    if (!session) return;
    setBusyId(leave.id);
    decide.mutate(
      { id: leave.id, status: decision, userId: session.userId },
      {
        onSuccess: onDone,
        onSettled: () => setBusyId(null),
      },
    );
  };

  const when = (leave: Leave) =>
    leave.kind === 'block' && leave.startTime && leave.endTime
      ? t('leaves.blockWhen', {
          date: formatDate(leave.from, lang, 'medium'),
          from: formatTime(leave.startTime, lang),
          to: formatTime(leave.endTime, lang),
        })
      : leave.from === leave.to
        ? formatDate(leave.from, lang, 'medium')
        : t('leaves.range', { from: formatDate(leave.from, lang, 'medium'), to: formatDate(leave.to, lang, 'medium') });

  const columns: Column<Leave>[] = [
    {
      id: 'doctor',
      header: t('leaves.columns.doctor'),
      sortValue: (leave) => doctorLabel(leave.doctorId),
      cell: (leave) => {
        const doctor = doctorById.get(leave.doctorId);
        return (
          <div className="min-w-[10rem]">
            <p className="font-medium text-fg">{doctorLabel(leave.doctorId)}</p>
            {doctor && <p className="text-xs text-fg-muted">{departmentName(doctor.departmentId)}</p>}
          </div>
        );
      },
    },
    {
      id: 'kind',
      header: t('leaves.columns.kind'),
      sortValue: (leave) => leave.kind,
      cell: (leave) => t(`leaves.kind.${leave.kind}`),
    },
    {
      id: 'when',
      header: t('leaves.columns.when'),
      sortValue: (leave) => `${leave.from} ${leave.startTime ?? ''}`,
      cell: when,
    },
    {
      id: 'reason',
      header: t('leaves.columns.reason'),
      hideBelow: 'lg',
      cell: (leave) => <span className="line-clamp-2 max-w-[18rem]">{leave.reason}</span>,
    },
    {
      id: 'requested',
      header: t('leaves.columns.requested'),
      hideBelow: 'xl',
      sortValue: (leave) => leave.requestedAt,
      cell: (leave) => formatDateTime(leave.requestedAt, lang),
    },
    {
      id: 'status',
      header: t('leaves.columns.status'),
      sortValue: (leave) => leave.status,
      cell: (leave) => <Badge tone={STATUS_TONE[leave.status]}>{t(`leaves.status.${leave.status}`)}</Badge>,
    },
    ...(status === 'pending'
      ? [
          {
            id: 'actions',
            header: t('common:table.actions'),
            align: 'right' as const,
            cell: (leave: Leave) => (
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  icon={Check}
                  loading={busyId === leave.id && decide.isPending && !rejecting}
                  disabled={decide.isPending}
                  onClick={() => act(leave, 'approved')}
                >
                  {t('leaves.approve')}
                  <span className="sr-only">: {doctorLabel(leave.doctorId)}</span>
                </Button>
                <Button
                  variant="dangerOutline"
                  size="sm"
                  icon={X}
                  disabled={decide.isPending}
                  onClick={() => setRejecting(leave)}
                >
                  {t('leaves.reject')}
                  <span className="sr-only">: {doctorLabel(leave.doctorId)}</span>
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1fr_12rem] md:items-end">
        <SearchInput value={q} onChange={setQ} label={t('leaves.search')} />
        {status === 'history' && (
          <Field label={t('filters.status')}>
            {(c) => (
              <Select
                {...c}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as '' | LeaveStatus)}
                placeholder={t('filters.allStatuses')}
                options={(['pending', 'approved', 'rejected'] as const).map((s) => ({
                  value: s,
                  label: t(`leaves.status.${s}`),
                }))}
              />
            )}
          </Field>
        )}
      </div>
      <DataTable
        caption={status === 'pending' ? t('leaves.pending') : t('leaves.history')}
        columns={columns}
        rows={rows}
        getRowId={(leave) => leave.id}
        initialSort={status === 'pending' ? { id: 'when', dir: 'asc' } : { id: 'requested', dir: 'desc' }}
        loading={leaves.isPending}
        error={leaves.error}
        onRetry={() => void leaves.refetch()}
        empty={
          <EmptyState
            icon={SearchX}
            className="border-0"
            title={
              needle || statusFilter
                ? t('leaves.emptySearch')
                : status === 'pending'
                  ? t('leaves.emptyPending')
                  : t('leaves.emptyHistory')
            }
          />
        }
      />
      <ConfirmDialog
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        tone="danger"
        loading={decide.isPending}
        title={t('leaves.rejectTitle', { name: rejecting ? doctorLabel(rejecting.doctorId) : '' })}
        body={t('leaves.rejectBody')}
        confirmLabel={t('leaves.reject')}
        onConfirm={() => rejecting && act(rejecting, 'rejected', () => setRejecting(null))}
      />
    </div>
  );
}

export function LeaveApprovalsPanel() {
  const { t } = useTranslation('admin');
  const pending = useLeaves({ status: 'pending' });
  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  return (
    <Card>
      <CardHeader title={t('leaves.title')} description={t('leaves.description')} />
      <CardBody>
        <Tabs
          label={t('leaves.title')}
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'pending', label: t('leaves.pending'), count: pending.data?.length },
            { id: 'history', label: t('leaves.history') },
          ]}
        >
          {(active) => <LeaveTable key={active} status={active} />}
        </Tabs>
      </CardBody>
    </Card>
  );
}
