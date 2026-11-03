import { z } from 'zod';
import { dateTimeSchema, dayOffsetSchema, idSchema } from './common';

export const NOTIFICATION_KINDS = [
  'booking_confirmed',
  'booking_rescheduled',
  'booking_cancelled',
  'reminder',
  'running_late',
  'you_are_next',
  'called_in',
  'checked_in',
  'consultation_done',
  'follow_up',
  'care_plan_ready',
  'care_check_in',
  'doctor_reply',
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

const notificationBase = z.object({
  id: idSchema,
  userId: idSchema,
  kind: z.enum(NOTIFICATION_KINDS),
  /** Values for the i18n template `patient:notifications.kinds.<kind>`. */
  params: z.record(z.union([z.string(), z.number()])),
  appointmentId: idSchema.optional(),
  read: z.boolean(),
});

export const notificationSchema = notificationBase.extend({ createdAt: dateTimeSchema });
export type AppNotification = z.infer<typeof notificationSchema>;

export const notificationSeedSchema = notificationBase.extend({ day: dayOffsetSchema, at: z.string() });

export interface NotificationPrefs {
  bookingUpdates: boolean;
  queueAlerts: boolean;
  reminders: boolean;
  sms: boolean;
  whatsapp: boolean;
}
