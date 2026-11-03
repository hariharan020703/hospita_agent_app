// Queries and mutations for the hospital directory: hospital profile, departments, doctors, schedules, patients.
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  departmentService,
  doctorService,
  hospitalService,
  patientService,
  queryKeys,
  scheduleService,
  type NewPatientInput,
} from '@/services';
import type {
  DepartmentFormValues,
  DoctorFilters,
  DoctorFormValues,
  Hospital,
  Leave,
  LeaveRequestValues,
  PatientFormValues,
  WeeklyHours,
} from '@/types';

const LONG = 5 * 60_000;

export const useHospital = () =>
  useQuery({ queryKey: queryKeys.hospital, queryFn: () => hospitalService.get(), staleTime: LONG });

export const useDepartments = (includeInactive = false) =>
  useQuery({
    queryKey: queryKeys.departments.list(includeInactive),
    queryFn: () => departmentService.list({ includeInactive }),
    staleTime: LONG,
  });

export const useDoctors = (filters: DoctorFilters = {}) =>
  useQuery({
    queryKey: queryKeys.doctors.list(filters),
    queryFn: () => doctorService.list(filters),
    placeholderData: keepPreviousData,
  });

export const useDoctor = (id: string | undefined) =>
  useQuery({
    queryKey: queryKeys.doctors.detail(id ?? ''),
    queryFn: () => doctorService.get(id ?? ''),
    enabled: Boolean(id),
  });

export const useSchedule = (doctorId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.schedules.detail(doctorId ?? ''),
    queryFn: () => scheduleService.get(doctorId ?? ''),
    enabled: Boolean(doctorId),
  });

export const useLeaves = (filter: { doctorId?: string; status?: Leave['status'] } = {}) =>
  useQuery({ queryKey: queryKeys.schedules.leaves(filter), queryFn: () => scheduleService.listLeaves(filter) });

export const usePatient = (id: string | undefined) =>
  useQuery({
    queryKey: queryKeys.patients.detail(id ?? ''),
    queryFn: () => patientService.get(id ?? ''),
    enabled: Boolean(id),
  });

export const useHousehold = (householdId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.patients.household(householdId ?? ''),
    queryFn: () => patientService.household(householdId ?? ''),
    enabled: Boolean(householdId),
  });

export const usePatients = (q: string) =>
  useQuery({
    queryKey: queryKeys.patients.list(q),
    queryFn: () => patientService.list({ q }),
    placeholderData: keepPreviousData,
  });

export const usePatientSearch = (q: string) =>
  useQuery({
    queryKey: queryKeys.patients.search(q),
    queryFn: () => patientService.search(q),
    enabled: q.trim().length >= 2,
    placeholderData: keepPreviousData,
  });

// ---------------------------------------------------------------- mutations

export function useRegisterAccountHolder() {
  const { t } = useTranslation('patient');
  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: NewPatientInput }) =>
      patientService.registerAccountHolder(userId, input),
    meta: { success: t('register.saved'), invalidates: [queryKeys.patients.all, queryKeys.users.all] },
  });
}

export function useAddFamilyMember() {
  const { t } = useTranslation('patient');
  return useMutation({
    mutationFn: ({ householdId, values }: { householdId: string; values: PatientFormValues }) =>
      patientService.addFamilyMember(householdId, values),
    meta: { success: t('profile.memberAdded'), invalidates: [queryKeys.patients.all] },
  });
}

export function useUpdatePatient() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: PatientFormValues }) => patientService.update(id, values),
    meta: { success: t('toast.saved'), invalidates: [queryKeys.patients.all, queryKeys.appointments.all] },
  });
}

export function useRegisterWalkIn() {
  return useMutation({
    mutationFn: (input: NewPatientInput) => patientService.registerWalkIn(input),
    meta: { invalidates: [queryKeys.patients.all] },
  });
}

export function useUpdateHospital() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (hospital: Hospital) => hospitalService.update(hospital),
    meta: { success: t('toast.saved'), invalidates: [queryKeys.hospital] },
  });
}

export function useSaveDepartment() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: DepartmentFormValues }) =>
      id ? departmentService.update(id, values) : departmentService.create(values),
    meta: {
      success: t('toast.saved'),
      invalidates: [queryKeys.departments.all, queryKeys.doctors.all, queryKeys.triage.all],
    },
  });
}

export function useSaveDoctor() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: DoctorFormValues }) =>
      id ? doctorService.update(id, values) : doctorService.create(values),
    meta: {
      success: t('toast.saved'),
      invalidates: [queryKeys.doctors.all, queryKeys.schedules.all, queryKeys.queue.all],
    },
  });
}

export function useSetDoctorActive() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => doctorService.setActive(id, active),
    meta: { success: t('toast.saved'), invalidates: [queryKeys.doctors.all, queryKeys.queue.all] },
  });
}

export function useUpdateWeeklySchedule() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ doctorId, weekly }: { doctorId: string; weekly: WeeklyHours }) =>
      scheduleService.updateWeekly(doctorId, weekly),
    meta: {
      success: t('toast.saved'),
      invalidates: [queryKeys.schedules.all, queryKeys.doctors.all, queryKeys.appointments.all],
    },
  });
}

export function useRequestLeave() {
  return useMutation({
    mutationFn: ({ doctorId, values }: { doctorId: string; values: LeaveRequestValues }) =>
      scheduleService.requestLeave(doctorId, values),
    meta: { invalidates: [queryKeys.schedules.all] },
  });
}

export function useDecideLeave() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, status, userId }: { id: string; status: 'approved' | 'rejected'; userId: string }) =>
      scheduleService.decideLeave(id, status, userId),
    meta: {
      success: t('toast.saved'),
      invalidates: [queryKeys.schedules.all, queryKeys.doctors.all, queryKeys.appointments.all],
    },
  });
}
