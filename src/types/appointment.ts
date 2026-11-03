import { z } from 'zod';
import { channelSchema, dateTimeSchema, dayOffsetSchema, idSchema, isoDateSchema, timeSchema } from './common';

export const APPOINTMENT_STATUSES = [
  'booked',
  'checked_in',
  'in_consultation',
  'completed',
  'cancelled',
  'no_show',
] as const;
export const appointmentStatusSchema = z.enum(APPOINTMENT_STATUSES);
export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;

/** Statuses that still hold the slot and count in the queue. */
export const ACTIVE_STATUSES: readonly AppointmentStatus[] = ['booked', 'checked_in', 'in_consultation'];
export const isActiveStatus = (s: AppointmentStatus) => ACTIVE_STATUSES.includes(s);

export const CANCEL_REASONS = ['feeling_better', 'schedule_conflict', 'booked_elsewhere', 'travel', 'other'] as const;
export const cancelReasonSchema = z.object({
  code: z.enum(CANCEL_REASONS),
  note: z.string().trim().max(200).optional(),
  by: z.enum(['patient', 'staff']),
});
export type CancelReason = z.infer<typeof cancelReasonSchema>;

const appointmentBase = z.object({
  id: idSchema,
  /** Short reference printed on slips and encoded in the booking QR. */
  bookingRef: z.string().regex(/^MF[A-Z0-9]{6}$/),
  patientId: idSchema,
  doctorId: idSchema,
  departmentId: idSchema,
  start: timeSchema,
  end: timeSchema,
  /** Sequence per department per day; the display token is `${prefix}-${tokenNo}`. */
  tokenNo: z.number().int().min(1),
  status: appointmentStatusSchema,
  source: channelSchema,
  triageId: idSchema.optional(),
  /** Short reason for the visit in the patient's words. */
  reason: z.string().trim().max(200).optional(),
  cancel: cancelReasonSchema.optional(),
  /** Short consultation note written by the doctor. */
  note: z.string().trim().max(1000).optional(),
  followUpOf: idSchema.optional(),
});

export const appointmentSchema = appointmentBase.extend({
  date: isoDateSchema,
  checkedInAt: dateTimeSchema.optional(),
  calledAt: dateTimeSchema.optional(),
  completedAt: dateTimeSchema.optional(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});
export type Appointment = z.infer<typeof appointmentSchema>;

/** Seed form: day offset plus HH:mm times on that day. */
export const appointmentSeedSchema = appointmentBase.extend({
  day: dayOffsetSchema,
  checkedInAt: timeSchema.optional(),
  calledAt: timeSchema.optional(),
  completedAt: timeSchema.optional(),
});
export type AppointmentSeed = z.infer<typeof appointmentSeedSchema>;

export interface AppointmentFilters {
  patientIds?: string[];
  doctorId?: string;
  departmentId?: string;
  date?: string;
  from?: string;
  to?: string;
  statuses?: AppointmentStatus[];
  q?: string;
}

export interface BookingInput {
  patientId: string;
  doctorId: string;
  date: string;
  start: string;
  source: 'app' | 'kiosk' | 'desk';
  triageId?: string;
  reason?: string;
  followUpOf?: string;
}

/** Appointment joined with the names the UI needs. */
export interface AppointmentView extends Appointment {
  token: string;
  patientName: string;
  patientPhone: string;
  doctorName: string;
  doctorNameTa?: string;
  room: string;
}
