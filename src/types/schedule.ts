import { z } from 'zod';
import { dateTimeSchema, dayOffsetSchema, idSchema, isoDateSchema, timeSchema, weeklyHoursSchema } from './common';

export const scheduleSchema = z.object({
  doctorId: idSchema,
  weekly: weeklyHoursSchema,
});
export type Schedule = z.infer<typeof scheduleSchema>;

export const LEAVE_KINDS = ['leave', 'block'] as const;
export const LEAVE_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

const leaveBase = z.object({
  id: idSchema,
  doctorId: idSchema,
  /** leave = whole days off; block = a time window on one day. */
  kind: z.enum(LEAVE_KINDS),
  startTime: timeSchema.optional(),
  endTime: timeSchema.optional(),
  reason: z.string().trim().min(2).max(200),
  status: z.enum(LEAVE_STATUSES),
  decidedBy: idSchema.optional(),
});

export const leaveSchema = leaveBase.extend({
  from: isoDateSchema,
  to: isoDateSchema,
  requestedAt: dateTimeSchema,
  decidedAt: dateTimeSchema.optional(),
});
export type Leave = z.infer<typeof leaveSchema>;

export const leaveSeedSchema = leaveBase.extend({ fromDay: dayOffsetSchema, toDay: dayOffsetSchema });

export const leaveRequestSchema = z
  .object({
    kind: z.enum(LEAVE_KINDS),
    from: isoDateSchema,
    to: isoDateSchema,
    startTime: z.string(),
    endTime: z.string(),
    reason: z.string().trim().min(2).max(200),
  })
  .refine((v) => v.from <= v.to, { message: 'endAfterStart', path: ['to'] })
  .refine((v) => v.kind === 'leave' || (/^\d{2}:\d{2}$/.test(v.startTime) && v.startTime < v.endTime), {
    message: 'endAfterStart',
    path: ['endTime'],
  });
export type LeaveRequestValues = z.infer<typeof leaveRequestSchema>;
