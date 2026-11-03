// Small pure helpers for the doctor app: clock times from timestamps, week maths and the "patients seen" list.
import { addDaysIso, timeOf, weekdayOf } from '@/lib/time';
import { WEEKDAYS, type AppointmentView } from '@/types';

/** "HH:mm" (local) from an ISO date-time such as `calledAt`. */
export const clockTime = (isoDateTime: string): string => timeOf(new Date(isoDateTime));

/** Monday of the week that contains `iso`. */
export const mondayOf = (iso: string): string => addDaysIso(iso, -WEEKDAYS.indexOf(weekdayOf(iso)));

export const byDateTime = (a: Pick<AppointmentView, 'date' | 'start'>, b: Pick<AppointmentView, 'date' | 'start'>) =>
  a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date);

export interface SeenPatient {
  id: string;
  name: string;
  phone: string;
  /** Date of the latest completed (or current) consultation. */
  lastVisit: string;
  /** Completed consultations with this doctor. */
  visits: number;
  /** Earliest upcoming active appointment with this doctor, if any. */
  nextVisit: string | null;
}

/** Patients this doctor has actually seen (completed or in consultation), grouped from the appointment list. */
export function seenPatients(appointments: readonly AppointmentView[], today: string): SeenPatient[] {
  const byPatient = new Map<string, AppointmentView[]>();
  for (const a of appointments) {
    const list = byPatient.get(a.patientId);
    if (list) list.push(a);
    else byPatient.set(a.patientId, [a]);
  }
  const result: SeenPatient[] = [];
  for (const [id, list] of byPatient) {
    const seen = list.filter((a) => a.status === 'completed' || a.status === 'in_consultation');
    if (seen.length === 0) continue;
    const latest = [...seen].sort(byDateTime).at(-1);
    const upcoming = list
      .filter((a) => a.date >= today && (a.status === 'booked' || a.status === 'checked_in') && a.id !== latest?.id)
      .sort(byDateTime)[0];
    result.push({
      id,
      name: latest?.patientName ?? '',
      phone: latest?.patientPhone ?? '',
      lastVisit: latest?.date ?? '',
      visits: seen.filter((a) => a.status === 'completed').length,
      nextVisit: upcoming?.date ?? null,
    });
  }
  return result;
}
