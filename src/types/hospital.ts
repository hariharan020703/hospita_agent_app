import { z } from 'zod';
import { idSchema, isoDateSchema, localizedSchema, pincodeSchema, weeklyHoursSchema } from './common';

export const holidaySchema = z.object({ date: isoDateSchema, name: localizedSchema });
export type Holiday = z.infer<typeof holidaySchema>;

/** Dialable numbers: digits with an optional leading +, spaces allowed for display. */
export const dialNumberSchema = z.string().regex(/^\+?[0-9 ]{3,16}$/, { message: 'phone' });

export const hospitalSchema = z.object({
  id: idSchema,
  name: localizedSchema,
  tagline: localizedSchema,
  address: z.object({
    line1: z.string().min(1),
    area: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    pincode: pincodeSchema,
  }),
  email: z.string().email(),
  phones: z.object({ main: dialNumberSchema, emergency: dialNumberSchema, ambulance: dialNumberSchema }),
  opdHours: weeklyHoursSchema,
  holidays: z.array(holidaySchema),
  emergency: z.object({ location: localizedSchema, directions: localizedSchema }),
  booking: z.object({
    maxDaysAhead: z.number().int().min(1).max(90),
    /** A same-day slot must start at least this many minutes from now. */
    leadMins: z.number().int().min(0).max(240),
    /** Patients can cancel or reschedule up to this many minutes before the slot. */
    changeCutoffMins: z.number().int().min(0).max(1440),
  }),
  travel: z.object({ defaultMins: z.number().int().min(5).max(240), bufferMins: z.number().int().min(0).max(60) }),
  kiosk: z.object({ idleSeconds: z.number().int().min(15).max(600) }),
  consentVersion: z.string().min(1),
});
export type Hospital = z.infer<typeof hospitalSchema>;
