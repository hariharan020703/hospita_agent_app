// Create / edit a doctor in a side drawer (react-hook-form + doctorFormSchema). A duplicate registration number
// (CONFLICT from the service) is shown on that field.
import { useId, useState, type ChangeEvent } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import {
  Avatar,
  Button,
  Checkbox,
  Drawer,
  Field,
  FieldError,
  Input,
  RadioGroup,
  Select,
  Switch,
  Textarea,
  useValidationMessage,
} from '@/components/ui';
import { useSaveDoctor } from '@/hooks/queries/directory';
import { useLocale } from '@/hooks/useLocale';
import { errorCodeOf } from '@/services';
import {
  doctorFormSchema,
  GENDERS,
  LANGS,
  type Department,
  type Doctor,
  type DoctorFormInput,
  type DoctorFormValues,
} from '@/types';
import { doctorToForm, emptyDoctorForm } from '../lib';
import { FormField } from './FormField';

const MAX_PHOTO_BYTES = 1024 * 1024;

export function DoctorDrawer({
  doctor,
  departments,
  onClose,
}: {
  /** null creates a new doctor. */
  doctor: Doctor | null;
  departments: readonly Department[];
  onClose: () => void;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const { l } = useLocale();
  const translate = useValidationMessage();
  const formId = useId();
  const save = useSaveDoctor();
  const [photoError, setPhotoError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DoctorFormInput, unknown, DoctorFormValues>({
    resolver: zodResolver(doctorFormSchema),
    defaultValues: doctor ? doctorToForm(doctor) : emptyDoctorForm(departments[0]?.id ?? ''),
  });

  const photoUrl = watch('photoUrl');
  const name = watch('name');

  const onPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError(t('doctors.form.photoType'));
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError(t('doctors.form.photoSize'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setValue('photoUrl', reader.result, { shouldDirty: true });
        setPhotoError(null);
      }
    };
    reader.onerror = () => setPhotoError(t('doctors.form.photoRead'));
    reader.readAsDataURL(file);
  };

  const submit = (values: DoctorFormValues) =>
    save.mutate(
      { id: doctor?.id, values },
      {
        onSuccess: onClose,
        onError: (error) => {
          if (errorCodeOf(error) === 'CONFLICT')
            setError('registrationNo', { type: 'conflict', message: 'conflict' }, { shouldFocus: true });
        },
      },
    );

  const regError = errors.registrationNo;
  const departmentOptions = departments.map((d) => ({
    value: d.id,
    label: d.active ? l(d.name) : `${l(d.name)} (${t('status.inactive')})`,
  }));

  return (
    <Drawer
      open
      onClose={onClose}
      dismissible={!save.isPending}
      title={doctor ? t('doctors.form.editTitle') : t('doctors.form.addTitle')}
      description={doctor ? doctor.name : t('doctors.form.addHint')}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form={formId} loading={save.isPending}>
            {doctor ? t('common:actions.saveChanges') : t('doctors.add')}
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={(e) => void handleSubmit(submit)(e)} className="space-y-6">
        <fieldset className="space-y-4">
          <legend className="mb-2 text-sm font-semibold text-fg">{t('doctors.form.identity')}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('doctors.form.name')}
              hint={t('doctors.form.nameHint')}
              error={errors.name?.message}
              required
            >
              {(c) => <Input {...c} {...register('name')} autoComplete="off" />}
            </Field>
            <Field label={t('doctors.form.nameTa')} error={errors.nameTa?.message}>
              {(c) => <Input {...c} {...register('nameTa')} lang="ta" autoComplete="off" />}
            </Field>
          </div>
          <Controller
            control={control}
            name="gender"
            render={({ field }) => (
              <RadioGroup
                legend={t('doctors.form.gender')}
                name="gender"
                layout="inline"
                value={field.value}
                onChange={field.onChange}
                error={errors.gender?.message}
                options={GENDERS.map((g) => ({ value: g, label: t(`common:gender.${g}`) }))}
              />
            )}
          />
          <FormField label={t('doctors.form.photo')} hint={t('doctors.form.photoHint')} errorText={photoError}>
            {(c) => (
              <div className="flex flex-wrap items-center gap-4">
                <Avatar
                  name={name || '?'}
                  src={photoUrl}
                  size="lg"
                  alt={photoUrl ? t('doctors.form.photoPreview') : undefined}
                />
                <input
                  {...c}
                  type="file"
                  accept="image/*"
                  onChange={onPhoto}
                  className="max-w-full text-sm text-fg-muted file:mr-3 file:min-h-9 file:cursor-pointer file:rounded-lg file:border file:border-border-strong file:bg-surface file:px-3 file:text-sm file:font-semibold file:text-fg hover:file:bg-surface-sunken"
                />
                {photoUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    onClick={() => setValue('photoUrl', undefined, { shouldDirty: true })}
                  >
                    {t('doctors.form.removePhoto')}
                  </Button>
                )}
              </div>
            )}
          </FormField>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-2 text-sm font-semibold text-fg">{t('doctors.form.credentials')}</legend>
          <Field
            label={t('doctors.form.qualifications')}
            hint={t('doctors.form.qualificationsHint')}
            error={errors.qualifications?.message}
            required
          >
            {(c) => <Input {...c} {...register('qualifications')} placeholder="MBBS, MD, DM (Cardiology)" />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label={t('doctors.form.registrationNo')}
              hint={t('doctors.form.registrationHint')}
              error={regError?.type === 'conflict' ? undefined : regError?.message}
              errorText={regError?.type === 'conflict' ? t('doctors.form.registrationTaken') : null}
              required
            >
              {(c) => <Input {...c} {...register('registrationNo')} autoComplete="off" />}
            </FormField>
            <Field label={t('doctors.form.experience')} error={errors.experienceYears?.message} required>
              {(c) => (
                <Input {...c} {...register('experienceYears')} type="number" inputMode="numeric" min={0} max={60} />
              )}
            </Field>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-2 text-sm font-semibold text-fg">{t('doctors.form.practice')}</legend>
          <Field label={t('doctors.form.department')} error={errors.departmentId?.message} required>
            {(c) => (
              <Select
                {...c}
                {...register('departmentId')}
                placeholder={t('doctors.form.chooseDepartment')}
                options={departmentOptions}
              />
            )}
          </Field>
          <Controller
            control={control}
            name="languages"
            render={({ field }) => (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-fg">{t('doctors.form.languages')}</legend>
                <div className="flex flex-wrap gap-6">
                  {LANGS.map((code) => (
                    <Checkbox
                      key={code}
                      label={t(`common:language.${code}`)}
                      checked={field.value.includes(code)}
                      onChange={(e) =>
                        field.onChange(
                          e.target.checked ? [...field.value, code] : field.value.filter((v) => v !== code),
                        )
                      }
                    />
                  ))}
                </div>
                {errors.languages?.message && <FieldError>{translate(errors.languages.message)}</FieldError>}
              </fieldset>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('doctors.form.fee')} error={errors.fee?.message} required>
              {(c) => <Input {...c} {...register('fee')} type="number" inputMode="numeric" min={0} step={50} />}
            </Field>
            <Field label={t('doctors.form.consultMins')} error={errors.consultMins?.message} required>
              {(c) => (
                <Input
                  {...c}
                  {...register('consultMins')}
                  type="number"
                  inputMode="numeric"
                  min={5}
                  max={60}
                  step={5}
                />
              )}
            </Field>
            <Field label={t('doctors.form.room')} error={errors.room?.message} required>
              {(c) => <Input {...c} {...register('room')} autoComplete="off" />}
            </Field>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-2 text-sm font-semibold text-fg">{t('doctors.form.about')}</legend>
          <Field label={t('doctors.form.bioEn')} error={errors.bioEn?.message}>
            {(c) => <Textarea {...c} {...register('bioEn')} rows={3} lang="en" />}
          </Field>
          <Field label={t('doctors.form.bioTa')} error={errors.bioTa?.message}>
            {(c) => <Textarea {...c} {...register('bioTa')} rows={3} lang="ta" />}
          </Field>
          <Controller
            control={control}
            name="active"
            render={({ field }) => (
              <Switch
                checked={field.value}
                onChange={field.onChange}
                label={t('doctors.form.active')}
                description={t('doctors.form.activeHint')}
              />
            )}
          />
        </fieldset>
      </form>
    </Drawer>
  );
}
