// Settings panels that are not part of the hospital record: department token prefixes, the red-flag list used by
// the AI assistant's emergency check, and (mock data source only) resetting the sample data.
import { useId, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  CircleSlash,
  Database,
  Info,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Save,
  SearchX,
  ShieldAlert,
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
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  Input,
  SearchInput,
  Select,
  SkeletonList,
  Switch,
  Textarea,
  type Column,
} from '@/components/ui';
import { useResetSampleData } from '@/hooks/queries/admin';
import { useRedFlags, useRuleMutations } from '@/hooks/queries/clinical';
import { useDepartments, useSaveDepartment } from '@/hooks/queries/directory';
import { useLocale } from '@/hooks/useLocale';
import { errorCodeOf } from '@/services';
import type { Department, RedFlag } from '@/types';
import { departmentToForm } from '../lib';
import { redFlagFormSchema, redFlagFromForm, redFlagToForm, type RedFlagFormValues } from '../schemas';

// ---------------------------------------------------------------- token prefixes

const PREFIX = /^[A-Z]{2,4}$/;

function TokenPrefixRow({ department, all }: { department: Department; all: readonly Department[] }) {
  const { t } = useTranslation('admin');
  const { l } = useLocale();
  const save = useSaveDepartment();
  const [value, setValue] = useState(department.tokenPrefix);
  const [serverConflict, setServerConflict] = useState(false);
  const inputId = useId();
  const errorId = `${inputId}-error`;

  const changed = value !== department.tokenPrefix;
  const error = !PREFIX.test(value)
    ? t('settings.tokens.invalid')
    : serverConflict || all.some((d) => d.id !== department.id && d.tokenPrefix === value)
      ? t('settings.tokens.taken')
      : null;

  const submit = () => {
    if (!changed || error) return;
    save.mutate(
      { id: department.id, values: { ...departmentToForm(department), tokenPrefix: value } },
      { onError: (e) => setServerConflict(errorCodeOf(e) === 'CONFLICT') },
    );
  };

  return (
    <tr className="border-b last:border-0">
      <th scope="row" className="px-4 py-3 text-left font-medium text-fg">
        <span className="flex items-center gap-3">
          <DepartmentIcon icon={department.icon} className="text-fg-muted" />
          {l(department.name)}
        </span>
      </th>
      <td className="px-4 py-3 font-mono text-sm text-fg-muted">{department.tokenPrefix}-001</td>
      <td className="px-4 py-3">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-wrap items-start gap-2"
        >
          <div className="space-y-1">
            <label htmlFor={inputId} className="sr-only">
              {t('settings.tokens.inputLabel', { department: l(department.name) })}
            </label>
            <Input
              id={inputId}
              value={value}
              maxLength={4}
              autoComplete="off"
              aria-invalid={changed && error ? true : undefined}
              aria-describedby={changed && error ? errorId : undefined}
              onChange={(e) => {
                setServerConflict(false);
                setValue(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''));
              }}
              className="w-28 font-mono uppercase"
            />
            {changed && error && (
              <p id={errorId} className="text-xs font-medium text-warning-ink">
                {error}
              </p>
            )}
          </div>
          <Button
            type="submit"
            size="sm"
            variant="outline"
            icon={Save}
            loading={save.isPending}
            disabled={!changed || Boolean(error)}
          >
            {t('settings.tokens.save')}
            <span className="sr-only">: {l(department.name)}</span>
          </Button>
          {changed && (
            <Button
              size="sm"
              variant="ghost"
              icon={RotateCcw}
              onClick={() => {
                setValue(department.tokenPrefix);
                setServerConflict(false);
              }}
            >
              {t('settings.tokens.undo')}
            </Button>
          )}
        </form>
      </td>
    </tr>
  );
}

export function TokenPrefixesPanel() {
  const { t } = useTranslation('admin');
  const { l } = useLocale();
  const departments = useDepartments(true);
  const [q, setQ] = useState('');
  const list = departments.data ?? [];
  const needle = q.trim().toLowerCase();
  const rows = list.filter(
    (d) => !needle || l(d.name).toLowerCase().includes(needle) || d.tokenPrefix.toLowerCase().includes(needle),
  );

  return (
    <Card>
      <CardHeader title={t('settings.tokens.title')} description={t('settings.tokens.description')} />
      <CardBody className="space-y-4">
        <SearchInput value={q} onChange={setQ} label={t('settings.tokens.search')} className="max-w-md" />
        {departments.isPending ? (
          <SkeletonList rows={5} rowClassName="h-12" />
        ) : departments.isError ? (
          <ErrorState error={departments.error} onRetry={() => void departments.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={SearchX} title={t('settings.tokens.empty')} />
        ) : (
          <div className="overflow-x-auto rounded-xl border scrollbar-thin">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <caption className="sr-only">{t('settings.tokens.title')}</caption>
              <thead>
                <tr className="border-b bg-surface-muted text-left">
                  <th scope="col" className="px-4 py-2.5 font-semibold text-fg-muted">
                    {t('settings.tokens.department')}
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold text-fg-muted">
                    {t('settings.tokens.example')}
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold text-fg-muted">
                    {t('settings.tokens.prefix')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <TokenPrefixRow key={`${d.id}-${d.tokenPrefix}`} department={d} all={list} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="flex items-start gap-2 text-sm text-fg-muted">
          <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          {t('settings.tokens.note')}
        </p>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------- red flags

function RedFlagDrawer({ flag, onClose }: { flag: RedFlag | null; onClose: () => void }) {
  const { t } = useTranslation(['admin', 'common']);
  const formId = useId();
  const { saveRedFlag } = useRuleMutations();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RedFlagFormValues>({ resolver: zodResolver(redFlagFormSchema), defaultValues: redFlagToForm(flag) });

  const submit = (values: RedFlagFormValues) =>
    saveRedFlag.mutate(redFlagFromForm(values, flag?.id), { onSuccess: onClose });

  return (
    <Drawer
      open
      onClose={onClose}
      dismissible={!saveRedFlag.isPending}
      title={flag ? t('redFlags.editTitle') : t('redFlags.addTitle')}
      description={t('redFlags.drawerHint')}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saveRedFlag.isPending}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form={formId} loading={saveRedFlag.isPending}>
            {t('common:actions.save')}
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={(e) => void handleSubmit(submit)(e)} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('redFlags.labelEn')} error={errors.labelEn?.message} required>
            {(c) => <Input {...c} {...register('labelEn')} lang="en" />}
          </Field>
          <Field label={t('redFlags.labelTa')} error={errors.labelTa?.message} required>
            {(c) => <Input {...c} {...register('labelTa')} lang="ta" />}
          </Field>
        </div>
        <div className="space-y-2 rounded-lg bg-info-soft px-4 py-3 text-sm text-info-ink">
          <p className="font-semibold">{t('redFlags.formatTitle')}</p>
          <p>{t('redFlags.formatBody')}</p>
          <pre className="whitespace-pre-wrap rounded bg-surface px-3 py-2 font-mono text-xs text-fg">
            {t('redFlags.formatExample')}
          </pre>
        </div>
        <Field label={t('redFlags.groupsEn')} hint={t('redFlags.groupsHint')} error={errors.groupsEn?.message}>
          {(c) => <Textarea {...c} {...register('groupsEn')} rows={5} lang="en" className="font-mono text-sm" />}
        </Field>
        <Field label={t('redFlags.groupsTa')} hint={t('redFlags.groupsHint')} error={errors.groupsTa?.message}>
          {(c) => <Textarea {...c} {...register('groupsTa')} rows={5} lang="ta" />}
        </Field>
        <fieldset className="space-y-4 rounded-lg border p-4">
          <legend className="px-1 text-sm font-semibold text-fg">{t('redFlags.helpline')}</legend>
          <p className="text-sm text-fg-muted">{t('redFlags.helplineHint')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('redFlags.helplineLabelEn')} error={errors.helplineLabelEn?.message}>
              {(c) => <Input {...c} {...register('helplineLabelEn')} lang="en" />}
            </Field>
            <Field label={t('redFlags.helplineLabelTa')} error={errors.helplineLabelTa?.message}>
              {(c) => <Input {...c} {...register('helplineLabelTa')} lang="ta" />}
            </Field>
          </div>
          <Field label={t('redFlags.helplineNumber')} error={errors.helplineNumber?.message} className="max-w-xs">
            {(c) => <Input {...c} {...register('helplineNumber')} type="tel" inputMode="tel" />}
          </Field>
        </fieldset>
        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <Switch
              checked={field.value}
              onChange={field.onChange}
              label={t('redFlags.active')}
              description={t('redFlags.activeHint')}
            />
          )}
        />
      </form>
    </Drawer>
  );
}

export function RedFlagsPanel() {
  const { t } = useTranslation(['admin', 'common']);
  const { l } = useLocale();
  const flags = useRedFlags();
  const { deleteRedFlag } = useRuleMutations();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [editing, setEditing] = useState<{ flag: RedFlag | null } | null>(null);
  const [deleting, setDeleting] = useState<RedFlag | null>(null);

  const needle = q.trim().toLowerCase();
  const rows = (flags.data ?? []).filter(
    (f) =>
      (status === 'all' || (status === 'active') === f.active) &&
      (!needle ||
        [f.label.en, f.label.ta, ...f.groups.en.flat(), ...f.groups.ta.flat()].some((text) =>
          text.toLowerCase().includes(needle),
        )),
  );

  const columns: Column<RedFlag>[] = [
    {
      id: 'label',
      header: t('redFlags.columns.label'),
      sortValue: (f) => l(f.label),
      cell: (f) => (
        <div className="min-w-[12rem]">
          <p className="font-medium text-fg">{l(f.label)}</p>
          <p className="line-clamp-1 text-xs text-fg-muted">
            {f.groups.en
              .slice(0, 2)
              .map((g) => g.join(' + '))
              .join(' · ')}
          </p>
        </div>
      ),
    },
    {
      id: 'groups',
      header: t('redFlags.columns.groups'),
      align: 'right',
      sortValue: (f) => f.groups.en.length + f.groups.ta.length,
      cell: (f) => (
        <span className="whitespace-nowrap tabular">
          {t('redFlags.groupCount', { en: f.groups.en.length, ta: f.groups.ta.length })}
        </span>
      ),
    },
    {
      id: 'helpline',
      header: t('redFlags.columns.helpline'),
      hideBelow: 'lg',
      cell: (f) =>
        f.helpline ? (
          <span className="flex items-center gap-1.5">
            <Phone aria-hidden className="h-3.5 w-3.5 text-fg-subtle" />
            {l(f.helpline.label)} · <span className="tabular">{f.helpline.number}</span>
          </span>
        ) : (
          <span className="text-fg-subtle">{t('redFlags.noHelpline')}</span>
        ),
    },
    {
      id: 'status',
      header: t('redFlags.columns.status'),
      sortValue: (f) => (f.active ? 0 : 1),
      cell: (f) =>
        f.active ? (
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
      cell: (f) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" icon={Pencil} onClick={() => setEditing({ flag: f })}>
            {t('common:actions.edit')}
            <span className="sr-only">: {l(f.label)}</span>
          </Button>
          <Button variant="dangerOutline" size="sm" icon={Trash2} onClick={() => setDeleting(f)}>
            {t('common:actions.delete')}
            <span className="sr-only">: {l(f.label)}</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader
        title={t('redFlags.title')}
        description={t('redFlags.description')}
        actions={
          <Button size="sm" icon={Plus} onClick={() => setEditing({ flag: null })}>
            {t('redFlags.add')}
          </Button>
        }
      />
      <CardBody className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_12rem] md:items-end">
          <SearchInput value={q} onChange={setQ} label={t('redFlags.search')} />
          <Field label={t('filters.status')}>
            {(c) => (
              <Select
                {...c}
                value={status}
                onChange={(e) => setStatus(e.target.value as 'all' | 'active' | 'inactive')}
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
          caption={t('redFlags.title')}
          columns={columns}
          rows={rows}
          getRowId={(f) => f.id}
          initialSort={{ id: 'label', dir: 'asc' }}
          loading={flags.isPending}
          error={flags.error}
          onRetry={() => void flags.refetch()}
          empty={<EmptyState icon={ShieldAlert} title={t('redFlags.empty')} className="border-0" />}
        />
      </CardBody>

      {editing && (
        <RedFlagDrawer key={editing.flag?.id ?? 'new'} flag={editing.flag} onClose={() => setEditing(null)} />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        tone="danger"
        loading={deleteRedFlag.isPending}
        title={t('redFlags.deleteTitle', { label: deleting ? l(deleting.label) : '' })}
        body={t('redFlags.deleteBody')}
        confirmLabel={t('common:actions.delete')}
        onConfirm={() => deleting && deleteRedFlag.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </Card>
  );
}

// ---------------------------------------------------------------- sample data (mock only)

export function SampleDataPanel() {
  const { t } = useTranslation(['admin', 'common']);
  const reset = useResetSampleData();
  const [confirming, setConfirming] = useState(false);
  return (
    <Card>
      <CardHeader title={t('settings.sampleData.title')} description={t('settings.sampleData.description')} />
      <CardBody className="flex flex-wrap items-center justify-between gap-4">
        <p className="flex max-w-2xl items-start gap-2 text-sm text-fg-muted">
          <Database aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          {t('settings.sampleData.body')}
        </p>
        <Button variant="dangerOutline" icon={RotateCcw} onClick={() => setConfirming(true)}>
          {t('common:mockData.reset')}
        </Button>
      </CardBody>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        tone="danger"
        loading={reset.isPending}
        title={t('common:mockData.reset')}
        body={t('common:mockData.resetConfirm')}
        confirmLabel={t('common:mockData.reset')}
        onConfirm={() => reset.mutate(undefined, { onSuccess: () => setConfirming(false) })}
      />
    </Card>
  );
}
