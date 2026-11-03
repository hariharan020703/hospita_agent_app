// Shared primitives for every entity schema. Validation messages are i18n keys in the `validation` namespace.
import { z } from 'zod';

export const LANGS = ['en', 'ta'] as const;
export const langSchema = z.enum(LANGS);
export type Lang = z.infer<typeof langSchema>;

export const localizedSchema = z.object({ en: z.string().min(1), ta: z.string().min(1) });
export type Localized = z.infer<typeof localizedSchema>;

export const idSchema = z.string().min(1);
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'date' });
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'time' });
export const dateTimeSchema = z.string().datetime({ message: 'date' });

/** Indian mobile number, 10 digits, without +91. */
export const phoneSchema = z.string().regex(/^[6-9]\d{9}$/, { message: 'phone' });
export const pincodeSchema = z.string().regex(/^[1-9]\d{5}$/, { message: 'pincode' });

export const GENDERS = ['female', 'male', 'other'] as const;
export const genderSchema = z.enum(GENDERS);
export type Gender = z.infer<typeof genderSchema>;

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export const weekdaySchema = z.enum(WEEKDAYS);
export type Weekday = z.infer<typeof weekdaySchema>;

export const timeRangeSchema = z
  .object({ start: timeSchema, end: timeSchema })
  .refine((r) => r.start < r.end, { message: 'endAfterStart', path: ['end'] });
export type TimeRange = z.infer<typeof timeRangeSchema>;

const dayHours = z.array(timeRangeSchema);
export const weeklyHoursSchema = z.object({
  mon: dayHours,
  tue: dayHours,
  wed: dayHours,
  thu: dayHours,
  fri: dayHours,
  sat: dayHours,
  sun: dayHours,
});
export type WeeklyHours = z.infer<typeof weeklyHoursSchema>;

/** Seed files store operational dates as day offsets from today so the data never goes stale. */
export const dayOffsetSchema = z.number().int().min(-400).max(400);

export const CHANNELS = ['app', 'kiosk', 'desk'] as const;
export const channelSchema = z.enum(CHANNELS);
export type Channel = z.infer<typeof channelSchema>;
