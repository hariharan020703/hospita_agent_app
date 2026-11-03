// Background queue simulation for the mock data source: patients arrive, consultations run their length, doctors
// call the next patient and breaks end. It never touches doctors a signed-in doctor is running by hand, and never
// moves appointments of patient-app households (those patients check in and get called for real).
import { atTime, fromMinutes, minutesOfDay, toIsoDate, toMinutes } from '@/lib/time';
import { queueOrder } from '@/features/queue/estimate';
import type { Appointment, DoctorDay } from '@/types';
import { appUserPatientIds, notificationsFor } from './core';
import type { DbState } from './state';

/** Minutes before the slot that simulated patients arrive. */
const ARRIVE_BEFORE = 15;
/** Minutes after the slot that a simulated patient who never came is marked no-show. */
const NO_SHOW_AFTER = 45;

export function advanceQueues(state: DbState, now: Date): Partial<DbState> | null {
  const date = toIsoDate(now);
  const nowMin = minutesOfDay(now);
  const protectedPatients = appUserPatientIds(state);
  const manual = new Set(state.manualDoctorIds);
  const stamp = (minutes: number) => atTime(date, fromMinutes(minutes)).toISOString();

  let appointments = state.appointments;
  let doctorDays = state.doctorDays;
  const notifications = [...state.notifications];
  let changed = false;

  const update = (next: Appointment) => {
    appointments = appointments.map((a) => (a.id === next.id ? next : a));
    changed = true;
  };

  for (const doctor of state.doctors) {
    if (!doctor.active || manual.has(doctor.id)) continue;
    let day: DoctorDay | undefined = doctorDays.find((d) => d.doctorId === doctor.id && d.date === date);
    if (day?.status === 'off') continue;

    if (day?.status === 'on_break' && day.breakUntil && toMinutes(day.breakUntil) <= nowMin) {
      const ended: DoctorDay = { ...day, status: 'available', updatedAt: now.toISOString() };
      delete ended.breakUntil;
      doctorDays = doctorDays.map((d) => (d === day ? ended : d));
      day = ended;
      changed = true;
    }

    const mine = () => appointments.filter((a) => a.doctorId === doctor.id && a.date === date).sort(queueOrder);

    for (const a of mine()) {
      if (a.status !== 'booked' || protectedPatients.has(a.patientId)) continue;
      const start = toMinutes(a.start);
      if (nowMin > start + NO_SHOW_AFTER) update({ ...a, status: 'no_show', updatedAt: now.toISOString() });
      else if (nowMin >= start - ARRIVE_BEFORE) {
        update({
          ...a,
          status: 'checked_in',
          checkedInAt: stamp(Math.max(start - ARRIVE_BEFORE, 0)),
          updatedAt: now.toISOString(),
        });
      }
    }

    const sessionStart = Math.min(...mine().map((a) => toMinutes(a.start)), 24 * 60);
    const delay = day?.status === 'running_late' ? day.delayMins : 0;
    const breakUntil = day?.status === 'on_break' && day.breakUntil ? toMinutes(day.breakUntil) : 0;
    let free = Math.max(sessionStart + delay, breakUntil);

    for (let guard = 0; guard < 100; guard++) {
      const list = mine();
      const current = list.find((a) => a.status === 'in_consultation');
      if (current) {
        const calledMin = current.calledAt ? minutesOfDay(new Date(current.calledAt)) : nowMin;
        const doneAt = calledMin + doctor.consultMins;
        if (doneAt > nowMin) break;
        update({ ...current, status: 'completed', completedAt: stamp(doneAt), updatedAt: now.toISOString() });
        free = Math.max(free, doneAt);
        continue;
      }
      const next = list.find((a) => a.status === 'checked_in');
      if (!next) break;
      const checkedIn = next.checkedInAt ? minutesOfDay(new Date(next.checkedInAt)) : nowMin;
      const callAt = Math.max(free, checkedIn, toMinutes(next.start) - 10);
      if (callAt > nowMin) break;
      const called: Appointment = {
        ...next,
        status: 'in_consultation',
        calledAt: stamp(callAt),
        updatedAt: now.toISOString(),
      };
      update(called);
      if (protectedPatients.has(called.patientId)) {
        notifications.push(...notificationsFor({ ...state, appointments }, called, 'called_in', { room: doctor.room }));
      }
      const following = mine().find((a) => a.status === 'checked_in');
      const alreadyTold = (id: string) =>
        notifications.some((n) => n.appointmentId === id && n.kind === 'you_are_next');
      if (following && protectedPatients.has(following.patientId) && !alreadyTold(following.id)) {
        notifications.push(...notificationsFor({ ...state, appointments }, following, 'you_are_next'));
      }
    }
  }

  return changed ? { appointments, doctorDays, notifications } : null;
}
