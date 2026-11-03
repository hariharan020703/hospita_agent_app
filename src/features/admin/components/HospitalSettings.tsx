// Hospital settings sections. Each edits a slice of the hospital record and saves the full, re-validated object
// through useUpdateHospital (see useHospitalDraft).
import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw, Save } from 'lucide-react';
import { Button, Card, CardBody, CardHeader, Field, Input } from '@/components/ui';
import type { Hospital } from '@/types';
import { useHospitalDraft } from '../hooks';
import { hasWeeklyIssues, sortWeekly, validateWeekly } from '../lib';
import { WeeklyHoursEditor } from './WeeklyHoursEditor';

function SectionCard({
  title,
  description,
  onSave,
  onReset,
  saving,
  children,
}: {
  title: string;
  description?: string;
  onSave: () => void;
  onReset: () => void;
  saving: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation('common');
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        <CardBody className="space-y-5">{children}</CardBody>
        <div className="flex flex-wrap justify-end gap-2 border-t px-4 py-3 sm:px-5">
          <Button variant="outline" icon={RotateCcw} onClick={onReset} disabled={saving}>
            {t('actions.reset')}
          </Button>
          <Button type="submit" icon={Save} loading={saving}>
            {t('actions.saveChanges')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** Number input bound to a numeric draft value; empty input becomes NaN so the schema reports it. */
function NumberInput({
  value,
  onChange,
  ...rest
}: { value: number; onChange: (value: number) => void } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
>) {
  return (
    <Input
      {...rest}
      type="number"
      inputMode="numeric"
      value={Number.isNaN(value) ? '' : value}
      onChange={(e) => onChange(e.target.valueAsNumber)}
      className="max-w-[10rem]"
    />
  );
}

export function ProfileSection({ hospital }: { hospital: Hospital }) {
  const { t } = useTranslation('admin');
  const { draft, setDraft, errors, save, reset, saving } = useHospitalDraft(hospital, [
    'name',
    'tagline',
    'address',
    'email',
  ] as const);
  const address = (patch: Partial<Hospital['address']>) =>
    setDraft((d) => ({ ...d, address: { ...d.address, ...patch } }));

  return (
    <SectionCard
      title={t('settings.profile.title')}
      description={t('settings.profile.description')}
      onSave={() => save()}
      onReset={reset}
      saving={saving}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t('settings.profile.nameEn')} error={errors['name.en']} required>
          {(c) => (
            <Input
              {...c}
              lang="en"
              value={draft.name.en}
              onChange={(e) => setDraft((d) => ({ ...d, name: { ...d.name, en: e.target.value } }))}
            />
          )}
        </Field>
        <Field label={t('settings.profile.nameTa')} error={errors['name.ta']} required>
          {(c) => (
            <Input
              {...c}
              lang="ta"
              value={draft.name.ta}
              onChange={(e) => setDraft((d) => ({ ...d, name: { ...d.name, ta: e.target.value } }))}
            />
          )}
        </Field>
        <Field label={t('settings.profile.taglineEn')} error={errors['tagline.en']} required>
          {(c) => (
            <Input
              {...c}
              lang="en"
              value={draft.tagline.en}
              onChange={(e) => setDraft((d) => ({ ...d, tagline: { ...d.tagline, en: e.target.value } }))}
            />
          )}
        </Field>
        <Field label={t('settings.profile.taglineTa')} error={errors['tagline.ta']} required>
          {(c) => (
            <Input
              {...c}
              lang="ta"
              value={draft.tagline.ta}
              onChange={(e) => setDraft((d) => ({ ...d, tagline: { ...d.tagline, ta: e.target.value } }))}
            />
          )}
        </Field>
      </div>
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-fg">{t('settings.profile.address')}</legend>
        <Field label={t('settings.profile.line1')} error={errors['address.line1']} required>
          {(c) => <Input {...c} value={draft.address.line1} onChange={(e) => address({ line1: e.target.value })} />}
        </Field>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label={t('settings.profile.area')} error={errors['address.area']} required>
            {(c) => <Input {...c} value={draft.address.area} onChange={(e) => address({ area: e.target.value })} />}
          </Field>
          <Field label={t('settings.profile.city')} error={errors['address.city']} required>
            {(c) => <Input {...c} value={draft.address.city} onChange={(e) => address({ city: e.target.value })} />}
          </Field>
          <Field label={t('settings.profile.state')} error={errors['address.state']} required>
            {(c) => <Input {...c} value={draft.address.state} onChange={(e) => address({ state: e.target.value })} />}
          </Field>
          <Field label={t('settings.profile.pincode')} error={errors['address.pincode']} required>
            {(c) => (
              <Input
                {...c}
                inputMode="numeric"
                maxLength={6}
                value={draft.address.pincode}
                onChange={(e) => address({ pincode: e.target.value.trim() })}
              />
            )}
          </Field>
        </div>
      </fieldset>
      <Field label={t('settings.profile.email')} error={errors.email} required className="max-w-md">
        {(c) => (
          <Input
            {...c}
            type="email"
            autoComplete="email"
            value={draft.email}
            onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value.trim() }))}
          />
        )}
      </Field>
    </SectionCard>
  );
}

export function OpdHoursSection({ hospital }: { hospital: Hospital }) {
  const { t } = useTranslation('admin');
  const { draft, setDraft, save, reset, saving } = useHospitalDraft(hospital, ['opdHours'] as const);
  const [attempted, setAttempted] = useState(false);
  const issues = validateWeekly(draft.opdHours);
  const invalid = hasWeeklyIssues(issues);

  return (
    <SectionCard
      title={t('settings.hours.title')}
      description={t('settings.hours.description')}
      onSave={() => {
        setAttempted(true);
        if (invalid) return;
        save({ opdHours: sortWeekly(draft.opdHours) });
      }}
      onReset={() => {
        setAttempted(false);
        reset();
      }}
      saving={saving}
    >
      <WeeklyHoursEditor
        value={draft.opdHours}
        onChange={(opdHours) => setDraft((d) => ({ ...d, opdHours }))}
        issues={issues}
        label={t('settings.hours.title')}
      />
      {attempted && invalid && (
        <p role="alert" className="text-sm font-medium text-warning-ink">
          {t('hours.fixErrors')}
        </p>
      )}
    </SectionCard>
  );
}

export function ContactSection({ hospital }: { hospital: Hospital }) {
  const { t } = useTranslation('admin');
  const { draft, setDraft, errors, save, reset, saving } = useHospitalDraft(hospital, ['phones'] as const);
  const phone = (key: keyof Hospital['phones'], value: string) =>
    setDraft((d) => ({ ...d, phones: { ...d.phones, [key]: value } }));
  const fields: { key: keyof Hospital['phones']; label: string; hint: string }[] = [
    { key: 'main', label: t('settings.contact.main'), hint: t('settings.contact.mainHint') },
    { key: 'emergency', label: t('settings.contact.emergency'), hint: t('settings.contact.emergencyHint') },
    { key: 'ambulance', label: t('settings.contact.ambulance'), hint: t('settings.contact.ambulanceHint') },
  ];
  return (
    <SectionCard
      title={t('settings.contact.title')}
      description={t('settings.contact.description')}
      onSave={() => save()}
      onReset={reset}
      saving={saving}
    >
      <div className="grid gap-4 md:grid-cols-3">
        {fields.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint} error={errors[`phones.${f.key}`]} required>
            {(c) => (
              <Input
                {...c}
                type="tel"
                inputMode="tel"
                value={draft.phones[f.key]}
                onChange={(e) => phone(f.key, e.target.value)}
              />
            )}
          </Field>
        ))}
      </div>
    </SectionCard>
  );
}

export function BookingRulesSection({ hospital }: { hospital: Hospital }) {
  const { t } = useTranslation('admin');
  const { draft, setDraft, errors, save, reset, saving } = useHospitalDraft(hospital, [
    'booking',
    'kiosk',
    'travel',
  ] as const);
  const booking = (patch: Partial<Hospital['booking']>) =>
    setDraft((d) => ({ ...d, booking: { ...d.booking, ...patch } }));
  const travel = (patch: Partial<Hospital['travel']>) => setDraft((d) => ({ ...d, travel: { ...d.travel, ...patch } }));

  return (
    <SectionCard
      title={t('settings.booking.title')}
      description={t('settings.booking.description')}
      onSave={() => save()}
      onReset={reset}
      saving={saving}
    >
      <fieldset className="grid gap-4 md:grid-cols-3">
        <legend className="mb-3 text-sm font-semibold text-fg">{t('settings.booking.bookingGroup')}</legend>
        <Field
          label={t('settings.booking.maxDaysAhead')}
          hint={t('settings.booking.maxDaysAheadHint')}
          error={errors['booking.maxDaysAhead']}
          required
        >
          {(c) => (
            <NumberInput
              {...c}
              min={1}
              max={90}
              value={draft.booking.maxDaysAhead}
              onChange={(v) => booking({ maxDaysAhead: v })}
            />
          )}
        </Field>
        <Field
          label={t('settings.booking.leadMins')}
          hint={t('settings.booking.leadMinsHint')}
          error={errors['booking.leadMins']}
          required
        >
          {(c) => (
            <NumberInput
              {...c}
              min={0}
              max={240}
              step={5}
              value={draft.booking.leadMins}
              onChange={(v) => booking({ leadMins: v })}
            />
          )}
        </Field>
        <Field
          label={t('settings.booking.changeCutoffMins')}
          hint={t('settings.booking.changeCutoffMinsHint')}
          error={errors['booking.changeCutoffMins']}
          required
        >
          {(c) => (
            <NumberInput
              {...c}
              min={0}
              max={1440}
              step={15}
              value={draft.booking.changeCutoffMins}
              onChange={(v) => booking({ changeCutoffMins: v })}
            />
          )}
        </Field>
      </fieldset>
      <fieldset className="grid gap-4 md:grid-cols-3">
        <legend className="mb-3 text-sm font-semibold text-fg">{t('settings.booking.queueGroup')}</legend>
        <Field
          label={t('settings.booking.kioskIdle')}
          hint={t('settings.booking.kioskIdleHint')}
          error={errors['kiosk.idleSeconds']}
          required
        >
          {(c) => (
            <NumberInput
              {...c}
              min={15}
              max={600}
              step={5}
              value={draft.kiosk.idleSeconds}
              onChange={(v) => setDraft((d) => ({ ...d, kiosk: { idleSeconds: v } }))}
            />
          )}
        </Field>
        <Field
          label={t('settings.booking.travelDefault')}
          hint={t('settings.booking.travelDefaultHint')}
          error={errors['travel.defaultMins']}
          required
        >
          {(c) => (
            <NumberInput
              {...c}
              min={5}
              max={240}
              step={5}
              value={draft.travel.defaultMins}
              onChange={(v) => travel({ defaultMins: v })}
            />
          )}
        </Field>
        <Field
          label={t('settings.booking.travelBuffer')}
          hint={t('settings.booking.travelBufferHint')}
          error={errors['travel.bufferMins']}
          required
        >
          {(c) => (
            <NumberInput
              {...c}
              min={0}
              max={60}
              step={5}
              value={draft.travel.bufferMins}
              onChange={(v) => travel({ bufferMins: v })}
            />
          )}
        </Field>
      </fieldset>
    </SectionCard>
  );
}
