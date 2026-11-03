// Live OPD board: summary counts, filters kept in the URL, per-doctor queue cards and an "all patients today" table.
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CalendarClock,
  CheckCircle2,
  RefreshCw,
  SearchX,
  Stethoscope,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import {
  Button,
  buttonClasses,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  PageHeader,
  SearchInput,
  Select,
  Skeleton,
  SkeletonCard,
  Tabs,
} from '@/components/ui';
import { useAppointments } from '@/hooks/queries/appointments';
import { useDepartments } from '@/hooks/queries/directory';
import { useQueueBoard } from '@/hooks/queries/queue';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLocale } from '@/hooks/useLocale';
import { now, todayIso } from '@/lib/clock';
import { formatNumber } from '@/lib/format';
import { minutesOfDay } from '@/lib/time';
import { APPOINTMENT_STATUSES, DOCTOR_STATUSES, type DoctorQueue } from '@/types';
import { DoctorQueueCard } from '../components/DoctorQueueCard';
import { RowActionsProvider } from '../components/RowActions';
import { TodayTable } from '../components/TodayTable';
import { isAppointmentStatus, isDoctorStatus, matchesQuery, normaliseQuery } from '../deskUtils';

type View = 'doctors' | 'all';

function StatTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | null }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border bg-surface p-4 shadow-xs">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-ink">
        <Icon aria-hidden className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-fg-muted">{label}</p>
        {value === null ? (
          <Skeleton className="mt-1 h-7 w-12" />
        ) : (
          <p className="text-2xl font-bold text-fg tabular">{value}</p>
        )}
      </div>
    </li>
  );
}

function queueHasMatch(queue: DoctorQueue, query: string): boolean {
  const all = [...(queue.current ? [queue.current] : []), ...queue.waiting, ...queue.expected, ...queue.done];
  return all.some((a) => matchesQuery(a, query));
}

export default function BoardPage() {
  const { t } = useTranslation(['desk', 'common']);
  const { lang } = useLocale();
  const [params, setParams] = useSearchParams();
  const today = todayIso();

  const view: View = params.get('view') === 'all' ? 'all' : 'doctors';
  const dept = params.get('dept') ?? '';
  const doctorStatusParam = params.get('doctorStatus') ?? '';
  const doctorStatus = isDoctorStatus(doctorStatusParam) ? doctorStatusParam : '';
  const statusParam = params.get('status') ?? '';
  const status = isAppointmentStatus(statusParam) ? statusParam : '';
  const q = params.get('q') ?? '';
  const query = normaliseQuery(useDebouncedValue(q));

  const set = (key: string, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  const clearFilters = () => setParams(view === 'all' ? { view } : {}, { replace: true });

  const board = useQueueBoard();
  const departments = useDepartments();
  const appointments = useAppointments({ date: today }, { enabled: view === 'all', refetchInterval: 15_000 });

  const bookable = useMemo(() => (departments.data ?? []).filter((d) => d.bookable), [departments.data]);
  const sortOrder = useMemo(() => new Map(bookable.map((d) => [d.id, d.sortOrder])), [bookable]);

  // Department and doctor-status filters drive the summary; the search narrows the cards further.
  const filteredQueues = useMemo(
    () =>
      (board.data ?? [])
        .filter(
          (queue) => (!dept || queue.departmentId === dept) && (!doctorStatus || queue.day.status === doctorStatus),
        )
        .sort(
          (a, b) =>
            (sortOrder.get(a.departmentId) ?? 0) - (sortOrder.get(b.departmentId) ?? 0) ||
            a.doctorName.localeCompare(b.doctorName),
        ),
    [board.data, dept, doctorStatus, sortOrder],
  );
  const visibleQueues = query ? filteredQueues.filter((queue) => queueHasMatch(queue, query)) : filteredQueues;

  const stats = board.data
    ? filteredQueues.reduce(
        (sum, queue) => ({
          waiting: sum.waiting + queue.waiting.length,
          inConsultation: sum.inConsultation + (queue.current ? 1 : 0),
          expected: sum.expected + queue.expected.length,
          completed: sum.completed + queue.done.filter((a) => a.status === 'completed').length,
        }),
        { waiting: 0, inConsultation: 0, expected: 0, completed: 0 },
      )
    : null;
  const stat = (value: number | undefined) => (value === undefined ? null : formatNumber(value, lang));

  const tableRows = useMemo(
    () =>
      appointments.data?.filter(
        (a) => (!dept || a.departmentId === dept) && (!status || a.status === status) && matchesQuery(a, query),
      ),
    [appointments.data, dept, status, query],
  );

  const hasFilters = Boolean(dept || q || (view === 'doctors' ? doctorStatus : status));
  const nowMins = minutesOfDay(now());

  const filterBar = (
    <div className="grid gap-3 rounded-xl border bg-surface p-4 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
      <div className="space-y-1.5">
        <p aria-hidden className="text-sm font-medium text-fg">
          {t('board.search')}
        </p>
        <SearchInput
          value={q}
          onChange={(v) => set('q', v)}
          label={t('board.search')}
          placeholder={t('board.searchPlaceholder')}
        />
      </div>
      <Field label={t('board.department')}>
        {(c) => (
          <Select
            {...c}
            value={dept}
            onChange={(e) => set('dept', e.target.value)}
            placeholder={t('board.allDepartments')}
            options={bookable.map((d) => ({ value: d.id, label: d.name[lang] }))}
          />
        )}
      </Field>
      {view === 'doctors' ? (
        <Field label={t('board.doctorStatus')}>
          {(c) => (
            <Select
              {...c}
              value={doctorStatus}
              onChange={(e) => set('doctorStatus', e.target.value)}
              placeholder={t('board.anyDoctorStatus')}
              options={DOCTOR_STATUSES.map((s) => ({ value: s, label: t(`common:doctorStatus.${s}`) }))}
            />
          )}
        </Field>
      ) : (
        <Field label={t('board.visitStatus')}>
          {(c) => (
            <Select
              {...c}
              value={status}
              onChange={(e) => set('status', e.target.value)}
              placeholder={t('board.allVisitStatuses')}
              options={APPOINTMENT_STATUSES.map((s) => ({ value: s, label: t(`common:status.${s}`) }))}
            />
          )}
        </Field>
      )}
      <div className="flex items-end md:col-span-2 xl:col-span-1">
        {hasFilters && (
          <Button variant="ghost" onClick={clearFilters}>
            {t('common:actions.clearFilters')}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <RowActionsProvider>
      <div className="space-y-6">
        <PageHeader
          title={t('board.title')}
          description={t('board.description')}
          actions={
            <>
              <IconButton
                icon={RefreshCw}
                variant="outline"
                label={t('board.refresh')}
                onClick={() => {
                  void board.refetch();
                  if (view === 'all') void appointments.refetch();
                }}
              />
              <Link to="/desk/walk-in" className={buttonClasses('primary')}>
                <UserPlus aria-hidden className="h-4 w-4" />
                {t('board.newWalkIn')}
              </Link>
            </>
          }
        />

        <section aria-labelledby="desk-summary">
          <h2 id="desk-summary" className="sr-only">
            {t('board.summary')}
          </h2>
          <ul aria-live="polite" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatTile icon={Users} label={t('board.stats.waiting')} value={stat(stats?.waiting)} />
            <StatTile icon={Stethoscope} label={t('board.stats.inConsultation')} value={stat(stats?.inConsultation)} />
            <StatTile icon={CalendarClock} label={t('board.stats.expected')} value={stat(stats?.expected)} />
            <StatTile icon={CheckCircle2} label={t('board.stats.completed')} value={stat(stats?.completed)} />
          </ul>
        </section>

        <Tabs<View>
          label={t('board.views')}
          tabs={[
            { id: 'doctors', label: t('board.byDoctor') },
            { id: 'all', label: t('board.allToday') },
          ]}
          value={view}
          onChange={(next) => set('view', next === 'all' ? 'all' : '')}
        >
          {(active) => (
            <div className="space-y-4">
              {filterBar}
              {active === 'doctors' ? (
                board.isPending ? (
                  <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                    {Array.from({ length: 4 }, (_, i) => (
                      <SkeletonCard key={i} className="h-64" />
                    ))}
                  </div>
                ) : board.isError ? (
                  <ErrorState error={board.error} onRetry={() => void board.refetch()} />
                ) : board.data.length === 0 ? (
                  <EmptyState icon={CalendarClock} title={t('board.noQueues')} body={t('board.noQueuesBody')} />
                ) : visibleQueues.length === 0 ? (
                  <EmptyState
                    icon={SearchX}
                    title={t('board.noMatches')}
                    body={t('board.noMatchesBody')}
                    action={
                      <Button variant="outline" size="sm" onClick={clearFilters}>
                        {t('common:actions.clearFilters')}
                      </Button>
                    }
                  />
                ) : (
                  <>
                    <p className="text-sm text-fg-muted" aria-live="polite">
                      {t('board.doctorsShown', { count: visibleQueues.length })}
                    </p>
                    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                      {visibleQueues.map((queue) => (
                        <DoctorQueueCard
                          key={queue.doctorId}
                          queue={queue}
                          department={bookable.find((d) => d.id === queue.departmentId)}
                          query={query}
                          nowMins={nowMins}
                        />
                      ))}
                    </div>
                  </>
                )
              ) : (
                <>
                  {tableRows && (
                    <p className="text-sm text-fg-muted" aria-live="polite">
                      {t('board.appointmentsShown', { count: tableRows.length })}
                    </p>
                  )}
                  <TodayTable
                    rows={tableRows}
                    departments={bookable}
                    loading={appointments.isPending}
                    error={appointments.isError ? appointments.error : undefined}
                    onRetry={() => void appointments.refetch()}
                  />
                </>
              )}
            </div>
          )}
        </Tabs>
      </div>
    </RowActionsProvider>
  );
}
