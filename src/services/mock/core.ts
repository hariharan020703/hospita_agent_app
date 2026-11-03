// Shared plumbing for mock services: simulated network latency and failures, record lookups, joined views,
// notifications and booking helpers.
import { env } from '@/config/env';
import { now } from '@/lib/clock';
import { newBookingRef, newId } from '@/lib/id';
import { toIsoDate } from '@/lib/time';
import type { Appointment, AppointmentView, AppNotification, NotificationKind } from '@/types';
import { ServiceError } from '../errors';
import { getDb, type DbStore } from './db';
import type { DbState } from './state';

const wait = (ms: number) => (ms <= 0 ? Promise.resolve() : new Promise<void>((r) => setTimeout(r, ms)));

const latency = () => env.mockLatencyMin + Math.random() * (env.mockLatencyMax - env.mockLatencyMin);

/**
 * Runs one mock request: waits like a network call, sometimes fails (VITE_MOCK_ERROR_RATE), then reads or writes
 * the database. Results are deep-copied so callers can never mutate stored records.
 */
export async function request<T>(work: (db: DbStore) => T): Promise<T> {
  await wait(latency());
  if (env.mockErrorRate > 0 && Math.random() < env.mockErrorRate) throw new ServiceError('NETWORK');
  const db = await getDb();
  const result = work(db);
  return result === undefined ? result : structuredClone(result);
}

export function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((item) => item.id === id);
  if (!found) throw new ServiceError('NOT_FOUND', `No record ${id}`);
  return found;
}

export const replaceById = <T extends { id: string }>(list: readonly T[], next: T): T[] =>
  list.map((item) => (item.id === next.id ? next : item));

export const isoNow = () => now().toISOString();
export const today = () => toIsoDate(now());

export function tokenOf(state: DbState, a: Pick<Appointment, 'departmentId' | 'tokenNo'>): string {
  const prefix = state.departments.find((d) => d.id === a.departmentId)?.tokenPrefix ?? 'OPD';
  return `${prefix}-${String(a.tokenNo).padStart(3, '0')}`;
}

export function toView(state: DbState, a: Appointment): AppointmentView {
  const patient = state.patients.find((p) => p.id === a.patientId);
  const doctor = state.doctors.find((d) => d.id === a.doctorId);
  return {
    ...a,
    token: tokenOf(state, a),
    patientName: patient?.name ?? '—',
    patientPhone: patient?.phone ?? '',
    doctorName: doctor?.name ?? '—',
    ...(doctor?.nameTa ? { doctorNameTa: doctor.nameTa } : {}),
    room: doctor?.room ?? '',
  };
}

export const nextTokenNo = (state: DbState, departmentId: string, date: string): number =>
  state.appointments.reduce(
    (max, a) => (a.departmentId === departmentId && a.date === date ? Math.max(max, a.tokenNo) : max),
    0,
  ) + 1;

export function uniqueBookingRef(state: DbState): string {
  const used = new Set(state.appointments.map((a) => a.bookingRef));
  let ref = newBookingRef();
  while (used.has(ref)) ref = newBookingRef();
  return ref;
}

/** User accounts that should hear about a patient's appointments: the account holders of the patient's household. */
export function accountUserIds(state: DbState, patientId: string): string[] {
  const patient = state.patients.find((p) => p.id === patientId);
  if (!patient) return [];
  const householdPatientIds = new Set(
    state.patients.filter((p) => p.householdId === patient.householdId).map((p) => p.id),
  );
  return state.users
    .filter((u) => u.role === 'patient' && u.patientId && householdPatientIds.has(u.patientId))
    .map((u) => u.id);
}

/** Patients who belong to a patient-app household; the simulation never moves their appointments on its own. */
export function appUserPatientIds(state: DbState): Set<string> {
  const households = new Set(
    state.users
      .filter((u) => u.role === 'patient' && u.patientId)
      .map((u) => state.patients.find((p) => p.id === u.patientId)?.householdId)
      .filter((h): h is string => Boolean(h)),
  );
  return new Set(state.patients.filter((p) => households.has(p.householdId)).map((p) => p.id));
}

export function notificationsFor(
  state: DbState,
  appointment: Appointment,
  kind: NotificationKind,
  params: AppNotification['params'] = {},
): AppNotification[] {
  const patient = state.patients.find((p) => p.id === appointment.patientId);
  const doctor = state.doctors.find((d) => d.id === appointment.doctorId);
  const createdAt = isoNow();
  return accountUserIds(state, appointment.patientId).map((userId) => ({
    id: newId('ntf'),
    userId,
    kind,
    appointmentId: appointment.id,
    read: false,
    createdAt,
    params: {
      patient: patient?.name ?? '',
      doctor: doctor?.name ?? '',
      date: appointment.date,
      time: appointment.start,
      token: tokenOf(state, appointment),
      ...params,
    },
  }));
}

export function newAppointment(
  state: DbState,
  fields: Pick<
    Appointment,
    'patientId' | 'doctorId' | 'departmentId' | 'date' | 'start' | 'end' | 'source' | 'status'
  > &
    Partial<Pick<Appointment, 'triageId' | 'reason' | 'followUpOf' | 'checkedInAt'>>,
): Appointment {
  const stamp = isoNow();
  return {
    id: newId('apt'),
    bookingRef: uniqueBookingRef(state),
    tokenNo: nextTokenNo(state, fields.departmentId, fields.date),
    createdAt: stamp,
    updatedAt: stamp,
    ...fields,
  };
}
