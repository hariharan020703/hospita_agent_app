// Walk-in step 1: find an existing patient by name or phone, or register a new one with verbal consent.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPlus, UserSearch } from 'lucide-react';
import {
  Avatar,
  Button,
  Checkbox,
  EmptyState,
  QueryBoundary,
  SearchInput,
  SegmentedControl,
  SkeletonList,
  toast,
} from '@/components/ui';
import { PatientForm } from '@/components/domain/PatientForm';
import { emptyPatientInput } from '@/components/domain/patientFormValues';
import { usePatientSearch, useRegisterWalkIn } from '@/hooks/queries/directory';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { now } from '@/lib/clock';
import { formatPhone } from '@/lib/format';
import { ageFromBirthYear } from '@/lib/time';
import type { Patient, PatientFormInput, PatientFormValues } from '@/types';
import { normaliseQuery } from '../deskUtils';

type Mode = 'find' | 'new';

const NEW_PATIENT_FORM_ID = 'desk-walk-in-patient';

function usePatientMeta() {
  const { t } = useTranslation(['desk', 'common']);
  return (p: Patient) =>
    t('walkIn.patientMeta', {
      age: ageFromBirthYear(p.birthYear, now()),
      gender: t(`common:gender.${p.gender}`),
      phone: formatPhone(p.phone),
    });
}

export function SelectedPatient({ patient, onChange }: { patient: Patient; onChange: () => void }) {
  const { t } = useTranslation(['desk', 'common']);
  const meta = usePatientMeta();
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-xl border border-primary/40 bg-primary-soft/40 p-4">
      <Avatar name={patient.name} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-xs font-semibold text-primary-ink">{t('walkIn.selected')}</p>
        <p className="break-words text-lg font-semibold text-fg">{patient.name}</p>
        <p className="text-sm text-fg-muted">{meta(patient)}</p>
        <p className="text-sm text-fg-muted">
          {patient.address.area}, {patient.address.city}
        </p>
        {patient.abhaNumber && (
          <p className="text-sm text-fg-muted">{t('walkIn.abha', { abha: patient.abhaNumber })}</p>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={onChange}>
        {t('walkIn.change')}
      </Button>
    </div>
  );
}

function NewPatientPanel({ defaults, onSaved }: { defaults: PatientFormInput; onSaved: (patient: Patient) => void }) {
  const { t } = useTranslation(['desk', 'common']);
  const register = useRegisterWalkIn();
  const [consent, setConsent] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const save = async (values: PatientFormValues) => {
    if (!consent) {
      setAttempted(true);
      return;
    }
    try {
      const patient = await register.mutateAsync({ values, consent: { notifications } });
      toast.success(t('walkIn.patientSaved'));
      onSaved(patient);
    } catch {
      // The mutation cache already shows the error toast; the form stays filled in so the desk can retry.
    }
  };

  return (
    <div className="space-y-5">
      <PatientForm
        formId={NEW_PATIENT_FORM_ID}
        hideSubmit
        defaultValues={defaults}
        submitLabel={t('walkIn.savePatient')}
        submitting={register.isPending}
        onSubmit={(values) => void save(values)}
      />
      <div className="space-y-3 rounded-lg border bg-surface-muted p-4">
        <Checkbox
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          label={t('walkIn.consentVerbal')}
          error={attempted && !consent ? 'consent' : undefined}
          aria-required
        />
        <Checkbox
          checked={notifications}
          onChange={(e) => setNotifications(e.target.checked)}
          label={t('walkIn.consentNotifications')}
          description={t('walkIn.consentNotificationsHint')}
        />
      </div>
      <Button
        type="submit"
        form={NEW_PATIENT_FORM_ID}
        size="lg"
        block
        icon={UserPlus}
        loading={register.isPending}
        onClick={() => setAttempted(true)}
      >
        {t('walkIn.savePatient')}
      </Button>
    </div>
  );
}

export function PatientPicker({
  initialQuery,
  onSelect,
}: {
  initialQuery: string;
  onSelect: (patient: Patient) => void;
}) {
  const { t } = useTranslation(['desk', 'common']);
  const meta = usePatientMeta();
  const [mode, setMode] = useState<Mode>('find');
  const [query, setQuery] = useState(initialQuery);
  const [defaults, setDefaults] = useState<PatientFormInput>(() => emptyPatientInput());
  const [formKey, setFormKey] = useState(0);
  const term = normaliseQuery(useDebouncedValue(query));
  const search = usePatientSearch(term);

  /** Opens the new-patient form, carrying over a typed phone number or name. */
  const startNew = () => {
    const raw = query.trim();
    const isPhone = /^\d+$/.test(term);
    setDefaults(
      emptyPatientInput(isPhone ? (term.length === 10 ? { phone: term } : {}) : raw.length >= 2 ? { name: raw } : {}),
    );
    setFormKey((k) => k + 1);
    setMode('new');
  };

  return (
    <div className="space-y-4">
      <SegmentedControl<Mode>
        label={t('walkIn.mode')}
        value={mode}
        onChange={(next) => (next === 'new' ? startNew() : setMode('find'))}
        options={[
          { value: 'find', label: t('walkIn.modeFind'), icon: UserSearch },
          { value: 'new', label: t('walkIn.modeNew'), icon: UserPlus },
        ]}
      />

      {mode === 'new' ? (
        <NewPatientPanel key={formKey} defaults={defaults} onSaved={onSelect} />
      ) : (
        <div className="space-y-3">
          <SearchInput value={query} onChange={setQuery} label={t('walkIn.search')} />
          {term.length < 2 ? (
            <p className="text-sm text-fg-subtle">{t('walkIn.searchHint')}</p>
          ) : (
            <QueryBoundary
              query={search}
              loading={<SkeletonList rows={3} rowClassName="h-14" />}
              empty={
                <EmptyState
                  icon={UserSearch}
                  title={t('walkIn.noMatch')}
                  body={t('walkIn.noMatchBody')}
                  action={
                    <Button variant="secondary" size="sm" icon={UserPlus} onClick={startNew}>
                      {t('walkIn.registerNew')}
                    </Button>
                  }
                />
              }
            >
              {(patients) => (
                <div className="space-y-2">
                  <p className="text-sm text-fg-muted" aria-live="polite">
                    {t('walkIn.resultsCount', { count: patients.length })}
                  </p>
                  <ul aria-label={t('walkIn.results')} className="divide-y overflow-hidden rounded-xl border">
                    {patients.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(p)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-sunken focus-visible:bg-surface-sunken"
                        >
                          <Avatar name={p.name} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block break-words font-medium text-fg">{p.name}</span>
                            <span className="block text-sm text-fg-muted">
                              {meta(p)} · {p.address.area}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm font-semibold text-primary-ink">{t('walkIn.select')}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <Button variant="ghost" size="sm" icon={UserPlus} onClick={startNew}>
                    {t('walkIn.registerNew')}
                  </Button>
                </div>
              )}
            </QueryBoundary>
          )}
        </div>
      )}
    </div>
  );
}
