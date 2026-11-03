// Default values for PatientForm: blank, or prefilled from an existing patient record.
import { now } from '@/lib/clock';
import { ageFromBirthYear } from '@/lib/time';
import type { Patient, PatientFormInput } from '@/types';

export function patientToFormInput(patient: Patient): PatientFormInput {
  return {
    name: patient.name,
    age: ageFromBirthYear(patient.birthYear, now()),
    gender: patient.gender,
    phone: patient.phone,
    address: patient.address,
    abhaNumber: patient.abhaNumber ?? '',
    preferredLang: patient.preferredLang,
    relation: patient.relation,
    conditions: patient.conditions.join(', '),
  };
}

export const emptyPatientInput = (overrides: Partial<PatientFormInput> = {}): PatientFormInput => ({
  name: '',
  age: '' as unknown as number,
  gender: 'female',
  phone: '',
  address: { line1: '', area: '', city: 'Coimbatore', pincode: '' },
  abhaNumber: '',
  preferredLang: 'ta',
  relation: 'self',
  conditions: '',
  ...overrides,
});
