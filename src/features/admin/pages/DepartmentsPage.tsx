// Departments: list with create/edit drawer, plus the routing keywords (symptom rules) used by the AI assistant.
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CalendarCheck2,
  CalendarOff,
  CheckCircle2,
  CircleSlash,
  Pencil,
  Plus,
  SearchX,
  Tags,
  Trash2,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DataTable,
  DepartmentIcon,
  EmptyState,
  Field,
  PageHeader,
  SearchInput,
  Select,
  type Column,
} from '@/components/ui';
import { useRuleMutations, useSymptomRules } from '@/hooks/queries/clinical';
import { useDepartments } from '@/hooks/queries/directory';
import { useLocale } from '@/hooks/useLocale';
import { formatNumber } from '@/lib/format';
import type { Department, SymptomRule } from '@/types';
import { DepartmentDrawer, RuleDrawer } from '../components/DepartmentDrawers';

type StatusFilter = 'all' | 'active' | 'inactive';

function RoutingKeywords({
  departments,
  departmentId,
  onDepartment,
}: {
  departments: readonly Department[];
  departmentId: string;
  onDepartment: (id: string) => void;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const { lang, l } = useLocale();
  const department = departments.find((d) => d.id === departmentId);
  const rules = useSymptomRules(departmentId || undefined);
  const { deleteSymptomRule } = useRuleMutations();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<{ rule: SymptomRule | null } | null>(null);
  const [deleting, setDeleting] = useState<SymptomRule | null>(null);

  const needle = q.trim().toLowerCase();
  const rows = (rules.data ?? []).filter(
    (r) =>
      r.departmentId === departmentId &&
      (!needle ||
        [r.label.en, r.label.ta, ...r.keywords.en, ...r.keywords.ta].some((text) =>
          text.toLowerCase().includes(needle),
        )),
  );

  const keywordList = (words: readonly string[], code: 'en' | 'ta') =>
    words.length ? (
      <span lang={code} className="text-sm text-fg">
        {words.join(', ')}
      </span>
    ) : (
      <span className="text-sm text-fg-subtle">{t('rules.none')}</span>
    );

  const columns: Column<SymptomRule>[] = [
    {
      id: 'label',
      header: t('rules.columns.label'),
      sortValue: (r) => l(r.label),
      cell: (r) => <span className="font-medium">{l(r.label)}</span>,
    },
    { id: 'en', header: t('rules.columns.keywordsEn'), cell: (r) => keywordList(r.keywords.en, 'en') },
    { id: 'ta', header: t('rules.columns.keywordsTa'), cell: (r) => keywordList(r.keywords.ta, 'ta') },
    {
      id: 'weight',
      header: t('rules.columns.weight'),
      align: 'right',
      sortValue: (r) => r.weight,
      cell: (r) => <span className="tabular">{formatNumber(r.weight, lang, 1)}</span>,
    },
    {
      id: 'actions',
      header: t('common:table.actions'),
      align: 'right',
      cell: (r) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" icon={Pencil} onClick={() => setEditing({ rule: r })}>
            {t('common:actions.edit')}
            <span className="sr-only">: {l(r.label)}</span>
          </Button>
          <Button variant="dangerOutline" size="sm" icon={Trash2} onClick={() => setDeleting(r)}>
            {t('common:actions.delete')}
            <span className="sr-only">: {l(r.label)}</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader
        title={t('rules.title')}
        description={t('rules.description')}
        actions={
          <Button size="sm" icon={Plus} disabled={!department} onClick={() => setEditing({ rule: null })}>
            {t('rules.add')}
          </Button>
        }
      />
      <CardBody className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[16rem_1fr] md:items-end">
          <Field label={t('rules.department')}>
            {(c) => (
              <Select
                {...c}
                value={departmentId}
                onChange={(e) => onDepartment(e.target.value)}
                options={departments.map((d) => ({ value: d.id, label: l(d.name) }))}
              />
            )}
          </Field>
          <SearchInput value={q} onChange={setQ} label={t('rules.search')} />
        </div>
        <DataTable
          caption={t('rules.tableCaption', { department: department ? l(department.name) : '' })}
          columns={columns}
          rows={rows}
          getRowId={(r) => r.id}
          initialSort={{ id: 'weight', dir: 'desc' }}
          loading={rules.isPending}
          error={rules.error}
          onRetry={() => void rules.refetch()}
          empty={
            <EmptyState
              icon={Tags}
              className="border-0"
              title={needle ? t('rules.emptySearch') : t('rules.empty')}
              body={needle ? undefined : t('rules.emptyBody')}
            />
          }
        />
      </CardBody>

      {editing && department && (
        <RuleDrawer
          key={editing.rule?.id ?? 'new'}
          rule={editing.rule}
          department={department}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        tone="danger"
        loading={deleteSymptomRule.isPending}
        title={t('rules.deleteTitle', { label: deleting ? l(deleting.label) : '' })}
        body={t('rules.deleteBody')}
        confirmLabel={t('common:actions.delete')}
        onConfirm={() => deleting && deleteSymptomRule.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </Card>
  );
}

export default function DepartmentsPage() {
  const { t } = useTranslation(['admin', 'common']);
  const { l } = useLocale();
  const departments = useDepartments(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [editing, setEditing] = useState<{ department: Department | null } | null>(null);
  const [rulesFor, setRulesFor] = useState('');
  const rulesRef = useRef<HTMLDivElement>(null);

  const list = departments.data ?? [];
  const selectedRulesDept = rulesFor || list[0]?.id || '';
  const needle = q.trim().toLowerCase();
  const rows = list.filter(
    (d) =>
      (status === 'all' || (status === 'active') === d.active) &&
      (!needle ||
        [d.name.en, d.name.ta, d.tokenPrefix, d.wing.en, d.wing.ta].some((text) =>
          text.toLowerCase().includes(needle),
        )),
  );

  const showRules = (id: string) => {
    setRulesFor(id);
    window.requestAnimationFrame(() => rulesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const columns: Column<Department>[] = [
    {
      id: 'name',
      header: t('departments.columns.department'),
      sortValue: (d) => d.sortOrder,
      cell: (d) => (
        <div className="flex min-w-[14rem] items-center gap-3">
          <DepartmentIcon icon={d.icon} boxed />
          <div className="min-w-0">
            <p className="font-medium text-fg" lang="en">
              {d.name.en}
            </p>
            <p className="text-sm text-fg-muted" lang="ta">
              {d.name.ta}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'location',
      header: t('departments.columns.location'),
      hideBelow: 'lg',
      sortValue: (d) => d.floor,
      cell: (d) => t('departments.floorWing', { floor: d.floor, wing: l(d.wing) }),
    },
    {
      id: 'prefix',
      header: t('departments.columns.tokenPrefix'),
      sortValue: (d) => d.tokenPrefix,
      cell: (d) => <span className="font-mono text-sm font-semibold">{d.tokenPrefix}</span>,
    },
    {
      id: 'status',
      header: t('departments.columns.status'),
      sortValue: (d) => (d.active ? 0 : 1),
      cell: (d) => (
        <div className="flex flex-wrap gap-1">
          {d.active ? (
            <Badge tone="success" icon={CheckCircle2}>
              {t('status.active')}
            </Badge>
          ) : (
            <Badge icon={CircleSlash}>{t('status.inactive')}</Badge>
          )}
          {d.bookable ? (
            <Badge tone="info" icon={CalendarCheck2}>
              {t('departments.bookable')}
            </Badge>
          ) : (
            <Badge icon={CalendarOff}>{t('departments.notBookable')}</Badge>
          )}
        </div>
      ),
    },
    {
      id: 'actions',
      header: t('common:table.actions'),
      align: 'right',
      cell: (d) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" icon={Pencil} onClick={() => setEditing({ department: d })}>
            {t('common:actions.edit')}
            <span className="sr-only">: {l(d.name)}</span>
          </Button>
          <Button variant="ghost" size="sm" icon={Tags} onClick={() => showRules(d.id)}>
            {t('departments.keywords')}
            <span className="sr-only">: {l(d.name)}</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('departments.title')}
        description={t('departments.description')}
        actions={
          <Button icon={Plus} onClick={() => setEditing({ department: null })}>
            {t('departments.add')}
          </Button>
        }
      />

      <section className="space-y-4" aria-label={t('departments.title')}>
        <div className="grid gap-3 rounded-xl border bg-surface p-4 md:grid-cols-[1fr_12rem] md:items-end">
          <SearchInput value={q} onChange={setQ} label={t('departments.search')} />
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
        <DataTable
          caption={t('departments.title')}
          columns={columns}
          rows={rows}
          getRowId={(d) => d.id}
          initialSort={{ id: 'name', dir: 'asc' }}
          loading={departments.isPending}
          error={departments.error}
          onRetry={() => void departments.refetch()}
          empty={<EmptyState icon={SearchX} title={t('departments.empty')} className="border-0" />}
        />
      </section>

      <div ref={rulesRef} className="scroll-mt-20">
        {list.length > 0 && (
          <RoutingKeywords departments={list} departmentId={selectedRulesDept} onDepartment={setRulesFor} />
        )}
      </div>

      {editing && (
        <DepartmentDrawer
          key={editing.department?.id ?? 'new'}
          department={editing.department}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
