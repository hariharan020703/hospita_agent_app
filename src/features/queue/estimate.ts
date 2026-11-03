// Live queue estimate for one appointment: patients ahead, expected start, and when to leave home.
import type { Appointment, DoctorDay, QueueEstimate, QueuePhase } from '@/types';
import { fromMinutes, minutesOfDay, toIsoDate, toMinutes } from '@/lib/time';

export interface EstimateInput {
  appointment: Appointment;
  /** The same doctor's appointments on the same date (any status). */
  sameDay: readonly Appointment[];
  consultMins: number;
  day: DoctorDay | undefined;
  now: Date;
  travelMins: number;
  bufferMins: number;
  tokenOf: (a: Appointment) => string;
}

/** Minutes before leaving home at which "get ready" starts. */
export const GET_READY_WINDOW = 20;

export const queueOrder = (a: Appointment, b: Appointment) =>
  toMinutes(a.start) - toMinutes(b.start) || a.tokenNo - b.tokenNo;

export function estimateQueue(input: EstimateInput): QueueEstimate {
  const { appointment, consultMins, day, now, travelMins, bufferMins, tokenOf } = input;
  const status = day?.status ?? 'available';
  const delayMins = status === 'running_late' ? (day?.delayMins ?? 0) : 0;
  const active = input.sameDay
    .filter((a) => a.status === 'booked' || a.status === 'checked_in' || a.status === 'in_consultation')
    .sort(queueOrder);
  const current = active.find((a) => a.status === 'in_consultation') ?? null;
  const base = {
    appointmentId: appointment.id,
    nowServing: current ? tokenOf(current) : null,
    delayMins,
    doctorStatus: status,
    checkedIn: appointment.status === 'checked_in' || appointment.status === 'in_consultation',
  };
  const scheduled = toMinutes(appointment.start);

  const finished = (phase: QueuePhase): QueueEstimate => ({
    ...base,
    phase,
    patientsAhead: 0,
    expectedStart: appointment.start,
    leaveBy: null,
  });
  if (appointment.status === 'completed') return finished('done');
  if (appointment.status === 'cancelled' || appointment.status === 'no_show' || status === 'off')
    return finished('closed');
  if (appointment.status === 'in_consultation') return finished('your_turn');

  const today = toIsoDate(now);
  const ahead = active.filter(
    (a) => a.id !== appointment.id && a.status !== 'in_consultation' && queueOrder(a, appointment) < 0,
  );

  // Future day: no live queue yet, so only the scheduled time (and travel) matter.
  if (appointment.date > today) {
    return {
      ...base,
      phase: 'relax',
      patientsAhead: ahead.length,
      expectedStart: appointment.start,
      leaveBy: fromMinutes(scheduled - travelMins - bufferMins),
    };
  }

  const nowMin = minutesOfDay(now);
  const currentLeft = current
    ? Math.max(0, consultMins - (current.calledAt ? nowMin - minutesOfDay(new Date(current.calledAt)) : 0))
    : 0;
  const breakLeft = status === 'on_break' && day?.breakUntil ? Math.max(0, toMinutes(day.breakUntil) - nowMin) : 0;
  const queueBased = nowMin + breakLeft + currentLeft + ahead.length * consultMins;
  const expected = Math.max(queueBased, scheduled + delayMins);

  if (base.checkedIn) {
    return {
      ...base,
      phase: ahead.length === 0 ? 'next' : 'waiting',
      patientsAhead: ahead.length,
      expectedStart: fromMinutes(expected),
      leaveBy: null,
    };
  }

  const leaveBy = expected - travelMins - bufferMins;
  const phase: QueuePhase =
    leaveBy <= nowMin ? 'leave_now' : leaveBy - nowMin <= GET_READY_WINDOW ? 'get_ready' : 'relax';
  return {
    ...base,
    phase,
    patientsAhead: ahead.length,
    expectedStart: fromMinutes(expected),
    leaveBy: fromMinutes(Math.max(0, leaveBy)),
  };
}
