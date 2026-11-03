// Slot availability from a doctor's weekly schedule, approved leave/blocks, hospital holidays and existing bookings.
import {
  isActiveStatus,
  type Appointment,
  type Doctor,
  type Holiday,
  type Leave,
  type Schedule,
  type TimeRange,
} from '@/types';
import { addDaysIso, minutesOfDay, toIsoDate, toMinutes, fromMinutes, weekdayOf } from '@/lib/time';

export type SlotStatus = 'available' | 'booked' | 'past' | 'blocked';

export interface Slot {
  start: string;
  end: string;
  status: SlotStatus;
}

export interface AvailabilityContext {
  schedule: Schedule | undefined;
  leaves: readonly Leave[];
  holidays: readonly Holiday[];
  /** The doctor's appointments (any date); only active ones hold a slot. */
  appointments: readonly Appointment[];
  now: Date;
  /** A same-day slot must start at least this many minutes from now. */
  leadMins: number;
}

export function sessionsOn(schedule: Schedule | undefined, date: string, holidays: readonly Holiday[]): TimeRange[] {
  if (!schedule || holidays.some((h) => h.date === date)) return [];
  return schedule.weekly[weekdayOf(date)];
}

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd;

/** True when approved leave (whole day) or an approved block (time window) covers the slot. */
export function isBlocked(
  leaves: readonly Leave[],
  doctorId: string,
  date: string,
  start: string,
  end: string,
): boolean {
  return leaves.some((leave) => {
    if (leave.doctorId !== doctorId || leave.status !== 'approved' || date < leave.from || date > leave.to)
      return false;
    if (leave.kind === 'leave' || !leave.startTime || !leave.endTime) return true;
    return overlaps(toMinutes(start), toMinutes(end), toMinutes(leave.startTime), toMinutes(leave.endTime));
  });
}

export function buildSlots(doctor: Pick<Doctor, 'id' | 'consultMins'>, date: string, ctx: AvailabilityContext): Slot[] {
  const today = toIsoDate(ctx.now);
  const earliest = minutesOfDay(ctx.now) + ctx.leadMins;
  const booked = ctx.appointments.filter(
    (a) => a.doctorId === doctor.id && a.date === date && isActiveStatus(a.status),
  );
  const slots: Slot[] = [];
  for (const session of sessionsOn(ctx.schedule, date, ctx.holidays)) {
    const sessionEnd = toMinutes(session.end);
    for (let m = toMinutes(session.start); m + doctor.consultMins <= sessionEnd; m += doctor.consultMins) {
      const start = fromMinutes(m);
      const end = fromMinutes(m + doctor.consultMins);
      let status: SlotStatus = 'available';
      if (date < today || (date === today && m < earliest)) status = 'past';
      else if (isBlocked(ctx.leaves, doctor.id, date, start, end)) status = 'blocked';
      else if (booked.some((a) => overlaps(m, m + doctor.consultMins, toMinutes(a.start), toMinutes(a.end))))
        status = 'booked';
      slots.push({ start, end, status });
    }
  }
  return slots;
}

export function nextAvailableSlot(
  doctor: Pick<Doctor, 'id' | 'consultMins'>,
  ctx: AvailabilityContext,
  days: number,
): { date: string; start: string } | null {
  const today = toIsoDate(ctx.now);
  for (let i = 0; i < days; i++) {
    const date = addDaysIso(today, i);
    const slot = buildSlots(doctor, date, ctx).find((s) => s.status === 'available');
    if (slot) return { date, start: slot.start };
  }
  return null;
}

export const partOfDay = (start: string): 'morning' | 'afternoon' | 'evening' => {
  const m = toMinutes(start);
  return m < 12 * 60 ? 'morning' : m < 16 * 60 ? 'afternoon' : 'evening';
};
