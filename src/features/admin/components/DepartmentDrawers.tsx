// Drawers for the departments screen: the department form and the routing-keyword (symptom rule) form.
import { useId } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Button, DepartmentIcon, Drawer, Field, Input, Select, Switch, Textarea } from '@/components/ui';
import { useRuleMutations } from '@/hooks/queries/clinical';
import { useSaveDepartment } from '@/hooks/queries/directory';
import { useLocale } from '@/hooks/useLocale';
import { errorCodeOf } from '@/services';
import {
  DEPARTMENT_ICONS,
  departmentFormSchema,
  type Department,
  type DepartmentFormValues,
  type SymptomRule,
} from '@/types';
import { departmentToForm, emptyDepartmentForm } from '../lib';
import { ruleFormSchema, ruleFromForm, ruleToForm, type RuleFormInput, type RuleFormValues } from '../schemas';
import { FormField } from './FormField';

export function DepartmentDrawer({ department, onClose }: { department: Department | null; onClose: () => void }) {
  const { t } = useTranslation(['admin', 'common']);
  const { l } = useLocale();
  const formId = useId();
  const save = useSaveDepartment();
  const {
    register,
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: department ? departmentToForm(department) : emptyDepartmentForm(),
  });
  const icon = watch('icon');

  const submit = (values: DepartmentFormValues) =>
    save.mutate(
      { id: department?.id, values },
      {
        onSuccess: onClose,
        onError: (error) => {
          if (errorCodeOf(error) === 'CONFLICT')
            setError('tokenPrefix', { type: 'conflict', message: 'conflict' }, { shouldFocus: true });
        },
      },
    );

  const prefixError = errors.tokenPrefix;

  return (
    <Drawer
      open
      onClose={onClose}
      dismissible={!save.isPending}
      title={department ? t('departments.form.editTitle') : t('departments.form.addTitle')}
      description={department ? l(department.name) : t('departments.form.addHint')}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form={formId} loading={save.isPending}>
            {department ? t('common:actions.saveChanges') : t('departments.add')}
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={(e) => void handleSubmit(submit)(e)} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('departments.form.nameEn')} error={errors.name?.en?.message} required>
            {(c) => <Input {...c} {...register('name.en')} lang="en" />}
          </Field>
          <Field label={t('departments.form.nameTa')} error={errors.name?.ta?.message} required>
            {(c) => <Input {...c} {...register('name.ta')} lang="ta" />}
          </Field>
        </div>
        <Field label={t('departments.form.descriptionEn')} error={errors.description?.en?.message} required>
          {(c) => <Textarea {...c} {...register('description.en')} rows={2} lang="en" />}
        </Field>
        <Field label={t('departments.form.descriptionTa')} error={errors.description?.ta?.message} required>
          {(c) => <Textarea {...c} {...register('description.ta')} rows={2} lang="ta" />}
        </Field>
        <div className="flex items-end gap-3">
          <Field label={t('departments.form.icon')} error={errors.icon?.message} className="flex-1" required>
            {(c) => (
              <Select
                {...c}
                {...register('icon')}
                options={DEPARTMENT_ICONS.map((key) => ({ value: key, label: t(`departments.icons.${key}`) }))}
              />
            )}
          </Field>
          <div className="flex flex-col items-center gap-1">
            <DepartmentIcon icon={icon} boxed />
            <span className="text-xs text-fg-subtle">{t('departments.form.preview')}</span>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label={t('departments.form.floor')}
            hint={t('departments.form.floorHint')}
            error={errors.floor?.message}
            required
          >
            {(c) => (
              <Input
                {...c}
                {...register('floor', { valueAsNumber: true })}
                type="number"
                inputMode="numeric"
                min={0}
                max={20}
              />
            )}
          </Field>
          <Field label={t('departments.form.wingEn')} error={errors.wing?.en?.message} required>
            {(c) => <Input {...c} {...register('wing.en')} lang="en" />}
          </Field>
          <Field label={t('departments.form.wingTa')} error={errors.wing?.ta?.message} required>
            {(c) => <Input {...c} {...register('wing.ta')} lang="ta" />}
          </Field>
        </div>
        <FormField
          label={t('departments.form.tokenPrefix')}
          hint={t('departments.form.tokenPrefixHint')}
          error={prefixError?.type === 'conflict' ? undefined : prefixError?.message}
          errorText={prefixError?.type === 'conflict' ? t('departments.form.tokenPrefixTaken') : null}
          required
        >
          {(c) => (
            <Input
              {...c}
              {...register('tokenPrefix', { setValueAs: (v: string) => v.trim().toUpperCase() })}
              maxLength={4}
              autoComplete="off"
              className="max-w-[8rem] uppercase"
            />
          )}
        </FormField>
        <div className="space-y-4 rounded-lg border p-4">
          <Controller
            control={control}
            name="bookable"
            render={({ field }) => (
              <Switch
                checked={field.value}
                onChange={field.onChange}
                label={t('departments.form.bookable')}
                description={t('departments.form.bookableHint')}
              />
            )}
          />
          <Controller
            control={control}
            name="active"
            render={({ field }) => (
              <Switch
                checked={field.value}
                onChange={field.onChange}
                label={t('departments.form.active')}
                description={t('departments.form.activeHint')}
              />
            )}
          />
        </div>
      </form>
    </Drawer>
  );
}

export function RuleDrawer({
  rule,
  department,
  onClose,
}: {
  rule: SymptomRule | null;
  department: Department;
  onClose: () => void;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const { l } = useLocale();
  const formId = useId();
  const { saveSymptomRule } = useRuleMutations();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RuleFormInput, unknown, RuleFormValues>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: ruleToForm(rule),
  });

  const submit = (values: RuleFormValues) =>
    saveSymptomRule.mutate(ruleFromForm(values, department.id, rule?.id), { onSuccess: onClose });

  return (
    <Drawer
      open
      onClose={onClose}
      dismissible={!saveSymptomRule.isPending}
      width="md"
      title={rule ? t('rules.editTitle') : t('rules.addTitle')}
      description={t('rules.forDepartment', { department: l(department.name) })}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saveSymptomRule.isPending}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form={formId} loading={saveSymptomRule.isPending}>
            {t('common:actions.save')}
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={(e) => void handleSubmit(submit)(e)} className="space-y-4">
        <Field label={t('rules.labelEn')} hint={t('rules.labelHint')} error={errors.labelEn?.message} required>
          {(c) => <Input {...c} {...register('labelEn')} lang="en" />}
        </Field>
        <Field label={t('rules.labelTa')} error={errors.labelTa?.message} required>
          {(c) => <Input {...c} {...register('labelTa')} lang="ta" />}
        </Field>
        <Field label={t('rules.keywordsEn')} hint={t('rules.keywordsEnHint')} error={errors.keywordsEn?.message}>
          {(c) => <Textarea {...c} {...register('keywordsEn')} rows={4} lang="en" />}
        </Field>
        <Field label={t('rules.keywordsTa')} hint={t('rules.keywordsTaHint')} error={errors.keywordsTa?.message}>
          {(c) => <Textarea {...c} {...register('keywordsTa')} rows={4} lang="ta" />}
        </Field>
        <Field label={t('rules.weight')} hint={t('rules.weightHint')} error={errors.weight?.message} required>
          {(c) => (
            <Input
              {...c}
              {...register('weight')}
              type="number"
              inputMode="decimal"
              min={0.5}
              max={3}
              step={0.5}
              className="max-w-[8rem]"
            />
          )}
        </Field>
      </form>
    </Drawer>
  );
}
