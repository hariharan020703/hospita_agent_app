import { z } from 'zod';
import { dateTimeSchema, dayOffsetSchema, idSchema, isoDateSchema, timeSchema } from './common';
import type { AppointmentView } from './appointment';

export const DOCTOR_STATUSES = ['available', 'on_break', 'running_late', 'off'] as const;
export const doctorStatusSchema = z.enum(DOCTOR_STATUSES);
export type DoctorStatus = z.infer<typeof doctorStatusSchema>;

const doctorDayBase = z.object({
  doctorId: idSchema,
  status: doctorStatusSchema,
  /** Minutes the doctor is behind schedule (running late). */
  delayMins: z.number().int().min(0).max(240),
  /** When an on-break doctor is back. */
  breakUntil: timeSchema.optional(),
});

export const doctorDaySchema = doctorDayBase.extend({ date: isoDateSchema, updatedAt: dateTimeSchema });
export type DoctorDay = z.infer<typeof doctorDaySchema>;

export const doctorDaySeedSchema = doctorDayBase.extend({ day: dayOffsetSchema });

/**
 * relax / get_ready / leave_now: not yet at the hospital (driven by the leave-home time).
 * waiting / next: checked in. your_turn: in consultation. done: completed. closed: cancelled, no-show or doctor off.
 */
export type QueuePhase = 'relax' | 'get_ready' | 'leave_now' | 'waiting' | 'next' | 'your_turn' | 'done' | 'closed';

/** Live estimate for one appointment, computed from the doctor's day and the queue ahead. */
export interface QueueEstimate {
  appointmentId: string;
  phase: QueuePhase;
  patientsAhead: number;
  nowServing: string | null;
  delayMins: number;
  doctorStatus: DoctorStatus;
  /** HH:mm the consultation is expected to start. */
  expectedStart: string;
  /** HH:mm the patient should leave home (null once checked in). */
  leaveBy: string | null;
  checkedIn: boolean;
}

export interface DoctorQueue {
  doctorId: string;
  doctorName: string;
  doctorNameTa?: string;
  departmentId: string;
  room: string;
  day: DoctorDay;
  current: AppointmentView | null;
  waiting: AppointmentView[];
  expected: AppointmentView[];
  done: AppointmentView[];
}
