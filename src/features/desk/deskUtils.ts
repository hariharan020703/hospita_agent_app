// Pure helpers for the front-desk app: search matching, visit-action rules, script detection, time of day.
import { timeOf } from '@/lib/time';
import {
  APPOINTMENT_STATUSES,
  DOCTOR_STATUSES,
  type AppointmentStatus,
  type AppointmentView,
  type DoctorStatus,
} from '@/types';

/** Tamil script block (U+0B80–U+0BFF). Used to set `lang` on text written by patients. */
export const hasTamil = (text: string): boolean => /[஀-௿]/.test(text);

export const langOfText = (text: string): 'ta' | 'en' => (hasTamil(text) ? 'ta' : 'en');

/** Normalises a search term: phone-like input loses spaces, dashes and a leading +91. */
export function normaliseQuery(raw: string): string {
  const trimmed = raw.trim();
  if (/^[\d\s+()-]+$/.test(trimmed)) {
    const digits = trimmed.replace(/\D/g, '');
    return digits.length > 10 && digits.startsWith('91') ? digits.slice(-10) : digits;
  }
  return trimmed.toLowerCase();
}

/** Name, phone, token or booking ID contains the (normalised) query. */
export function matchesQuery(appointment: AppointmentView, query: string): boolean {
  if (!query) return true;
  return [appointment.patientName, appointment.patientPhone, appointment.token, appointment.bookingRef].some((field) =>
    field.toLowerCase().includes(query),
  );
}

export const canCheckIn = (a: Pick<AppointmentView, 'status' | 'date'>, today: string): boolean =>
  a.status === 'booked' && a.date === today;

/** No-show and moving to another doctor are only possible before the consultation starts. */
export const isOpenVisit = (a: Pick<AppointmentView, 'status'>): boolean =>
  a.status === 'booked' || a.status === 'checked_in';

/** "HH:mm" in hospital local time from an ISO date-time. */
export const clockTimeOf = (isoDateTime: string): string => timeOf(new Date(isoDateTime));

export const isDoctorStatus = (value: string): value is DoctorStatus =>
  (DOCTOR_STATUSES as readonly string[]).includes(value);

export const isAppointmentStatus = (value: string): value is AppointmentStatus =>
  (APPOINTMENT_STATUSES as readonly string[]).includes(value);

/** Last 10 digits of a phone number passed in a URL (accepts +91 and spaces). */
export function phoneFromParam(value: string | null): string {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}
