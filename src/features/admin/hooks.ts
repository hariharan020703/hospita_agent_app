// Admin-app hooks: id -> name lookups for departments and doctors, and per-section hospital settings drafts.
import { useMemo, useState } from 'react';
import { useDepartments, useDoctors, useUpdateHospital } from '@/hooks/queries/directory';
import { useLocale } from '@/hooks/useLocale';
import { hospitalSchema, type Hospital } from '@/types';
import { issuesToErrors } from './lib';

/** Departments and doctors (including inactive ones) with name helpers in the active language. */
export function useLookups() {
  const { l, doctorName } = useLocale();
  const departments = useDepartments(true);
  const doctors = useDoctors({ includeInactive: true });
  const departmentById = useMemo(() => new Map((departments.data ?? []).map((d) => [d.id, d])), [departments.data]);
  const doctorById = useMemo(() => new Map((doctors.data ?? []).map((d) => [d.id, d])), [doctors.data]);
  const departmentName = (id: string): string => l(departmentById.get(id)?.name) || id;
  const doctorLabel = (id: string): string => {
    const doctor = doctorById.get(id);
    return doctor ? doctorName(doctor) : id;
  };
  return { departments, doctors, departmentById, doctorById, departmentName, doctorLabel };
}

const pick = <K extends keyof Hospital>(hospital: Hospital, keys: readonly K[]): Pick<Hospital, K> =>
  Object.fromEntries(keys.map((key) => [key, hospital[key]])) as Pick<Hospital, K>;

/**
 * Local draft of some top-level hospital fields. `save` merges the draft into the latest hospital record,
 * validates the whole object with `hospitalSchema` (errors keyed by dotted path) and saves it.
 */
export function useHospitalDraft<K extends keyof Hospital>(hospital: Hospital, keys: readonly K[]) {
  const [draft, setDraft] = useState<Pick<Hospital, K>>(() => pick(hospital, keys));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const update = useUpdateHospital();

  /** `override` replaces draft fields at save time (e.g. ranges sorted by start). */
  const save = (override?: Partial<Pick<Hospital, K>>) => {
    const next = { ...draft, ...override };
    if (override) setDraft(next);
    const parsed = hospitalSchema.safeParse({ ...hospital, ...next });
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error));
      return;
    }
    setErrors({});
    update.mutate(parsed.data);
  };

  const reset = () => {
    setDraft(pick(hospital, keys));
    setErrors({});
  };

  return { draft, setDraft, errors, save, reset, saving: update.isPending };
}
