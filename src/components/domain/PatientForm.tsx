// Patient details form (react-hook-form + the shared zod schema). Used for registration, family members and walk-ins.
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Button, Field, Input, RadioGroup, Select } from '@/components/ui';
import { GENDERS, RELATIONS, patientFormSchema, type PatientFormInput, type PatientFormValues } from '@/types';

export function PatientForm({
  defaultValues,
  onSubmit,
  submitLabel,
  submitting,
  showRelation = false,
  lockPhone = false,
  showLanguage = true,
  formId,
  hideSubmit = false,
}: {
  defaultValues: PatientFormInput;
  onSubmit: (values: PatientFormValues) => void;
  submitLabel: string;
  submitting?: boolean;
  showRelation?: boolean;
  lockPhone?: boolean;
  showLanguage?: boolean;
  formId?: string;
  hideSubmit?: boolean;
}) {
  const { t } = useTranslation(['patient', 'common']);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PatientFormInput, unknown, PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues,
  });

  return (
    <form id={formId} noValidate onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
      <Field label={t('form.name')} error={errors.name?.message} required>
        {(c) => <Input {...c} {...register('name')} autoComplete="name" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('form.age')} error={errors.age?.message} required>
          {(c) => <Input {...c} {...register('age')} inputMode="numeric" className="max-w-[8rem]" />}
        </Field>
        <Field label={t('form.phone')} error={errors.phone?.message} required>
          {(c) => (
            <Input
              {...c}
              {...register('phone')}
              inputMode="tel"
              autoComplete="tel-national"
              maxLength={10}
              readOnly={lockPhone}
            />
          )}
        </Field>
      </div>
      <Controller
        control={control}
        name="gender"
        render={({ field }) => (
          <RadioGroup
            legend={t('form.gender')}
            name="gender"
            layout="inline"
            value={field.value}
            onChange={field.onChange}
            error={errors.gender?.message}
            options={GENDERS.map((g) => ({ value: g, label: t(`common:gender.${g}`) }))}
          />
        )}
      />
      {showRelation && (
        <Field label={t('form.relation')} error={errors.relation?.message} required>
          {(c) => (
            <Select
              {...c}
              {...register('relation')}
              options={RELATIONS.filter((r) => r !== 'self').map((r) => ({
                value: r,
                label: t(`common:relation.${r}`),
              }))}
            />
          )}
        </Field>
      )}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-fg">{t('form.addressTitle')}</legend>
        <Field label={t('form.line1')} error={errors.address?.line1?.message} required>
          {(c) => <Input {...c} {...register('address.line1')} autoComplete="address-line1" />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('form.area')} error={errors.address?.area?.message} required>
            {(c) => <Input {...c} {...register('address.area')} autoComplete="address-level3" />}
          </Field>
          <Field label={t('form.city')} error={errors.address?.city?.message} required>
            {(c) => <Input {...c} {...register('address.city')} autoComplete="address-level2" />}
          </Field>
          <Field label={t('form.pincode')} error={errors.address?.pincode?.message} required>
            {(c) => (
              <Input
                {...c}
                {...register('address.pincode')}
                inputMode="numeric"
                maxLength={6}
                autoComplete="postal-code"
              />
            )}
          </Field>
        </div>
      </fieldset>
      <Field label={t('form.abha')} hint={t('form.abhaHint')} error={errors.abhaNumber?.message}>
        {(c) => <Input {...c} {...register('abhaNumber')} inputMode="numeric" placeholder="91-2345-6789-0123" />}
      </Field>
      <Field label={t('form.conditions')} hint={t('form.conditionsHint')} error={errors.conditions?.message}>
        {(c) => <Input {...c} {...register('conditions')} />}
      </Field>
      {showLanguage && (
        <Controller
          control={control}
          name="preferredLang"
          render={({ field }) => (
            <RadioGroup
              legend={t('form.language')}
              name="preferredLang"
              layout="inline"
              value={field.value}
              onChange={field.onChange}
              options={[
                { value: 'ta', label: t('common:language.ta') },
                { value: 'en', label: t('common:language.en') },
              ]}
            />
          )}
        />
      )}
      {!hideSubmit && (
        <Button type="submit" size="lg" block loading={submitting}>
          {submitLabel}
        </Button>
      )}
    </form>
  );
}
