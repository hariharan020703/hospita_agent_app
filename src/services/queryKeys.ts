// TanStack Query keys. Each domain has an `all` root so a mutation can invalidate the whole domain.
import type { AppointmentFilters, DateRange, DoctorFilters } from '@/types';

export const queryKeys = {
  hospital: ['hospital'] as const,
  users: { all: ['users'] as const, demo: ['users', 'demo'] as const, detail: (id: string) => ['users', id] as const },
  departments: {
    all: ['departments'] as const,
    list: (includeInactive: boolean) => ['departments', 'list', includeInactive] as const,
  },
  doctors: {
    all: ['doctors'] as const,
    list: (filters: DoctorFilters) => ['doctors', 'list', filters] as const,
    detail: (id: string) => ['doctors', 'detail', id] as const,
  },
  schedules: {
    all: ['schedules'] as const,
    detail: (doctorId: string) => ['schedules', 'detail', doctorId] as const,
    leaves: (filter: object) => ['schedules', 'leaves', filter] as const,
  },
  appointments: {
    all: ['appointments'] as const,
    list: (filters: AppointmentFilters) => ['appointments', 'list', filters] as const,
    detail: (id: string) => ['appointments', 'detail', id] as const,
    byRef: (ref: string) => ['appointments', 'ref', ref] as const,
    slots: (doctorId: string, date: string) => ['appointments', 'slots', doctorId, date] as const,
  },
  queue: {
    all: ['queue'] as const,
    board: ['queue', 'board'] as const,
    doctor: (doctorId: string) => ['queue', 'doctor', doctorId] as const,
    day: (doctorId: string) => ['queue', 'day', doctorId] as const,
    estimate: (appointmentId: string, travelMins?: number) => ['queue', 'estimate', appointmentId, travelMins] as const,
  },
  patients: {
    all: ['patients'] as const,
    list: (q: string) => ['patients', 'list', q] as const,
    detail: (id: string) => ['patients', 'detail', id] as const,
    household: (id: string) => ['patients', 'household', id] as const,
    search: (q: string) => ['patients', 'search', q] as const,
  },
  triage: {
    all: ['triage'] as const,
    rules: ['triage', 'rules'] as const,
    detail: (id: string) => ['triage', 'detail', id] as const,
    symptomRules: (departmentId?: string) => ['triage', 'symptomRules', departmentId] as const,
    redFlags: ['triage', 'redFlags'] as const,
  },
  escalations: { all: ['escalations'] as const, list: (status?: string) => ['escalations', 'list', status] as const },
  notifications: { all: ['notifications'] as const, list: (userId: string) => ['notifications', userId] as const },
  analytics: { all: ['analytics'] as const, dashboard: (range: DateRange) => ['analytics', range] as const },
  agents: {
    all: ['agents'] as const,
    settings: ['agents', 'settings'] as const,
    overview: ['agents', 'overview'] as const,
    activity: (filter: object) => ['agents', 'activity', filter] as const,
    samples: ['agents', 'records', 'samples'] as const,
    records: (patientIds: readonly string[]) => ['agents', 'records', 'list', patientIds] as const,
    record: (id: string) => ['agents', 'records', 'detail', id] as const,
    summary: (appointmentId: string) => ['agents', 'summary', appointmentId] as const,
    note: (appointmentId: string) => ['agents', 'note', appointmentId] as const,
    plans: (patientIds: readonly string[]) => ['agents', 'care', 'plans', patientIds] as const,
    plan: (id: string) => ['agents', 'care', 'plan', id] as const,
    careMessages: (planId: string) => ['agents', 'care', 'messages', planId] as const,
    followUps: (doctorId: string) => ['agents', 'care', 'followUps', doctorId] as const,
  },
};
