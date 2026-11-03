// Calendar-date ("yyyy-MM-dd") and clock-time ("HH:mm") helpers in the device's local time zone.
import { WEEKDAYS, type Weekday } from '@/types';

const pad = (n: number) => String(n).padStart(2, '0');

export const toMinutes = (hhmm: string): number => {
  const [h = '0', m = '0'] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
};

export const fromMinutes = (minutes: number): string => {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
};

export const addMinutes = (hhmm: string, minutes: number): string => fromMinutes(toMinutes(hhmm) + minutes);

export const toIsoDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const parseIsoDate = (iso: string): Date => {
  const [y = '1970', m = '1', d = '1'] = iso.split('-');
  return new Date(Number(y), Number(m) - 1, Number(d));
};

export const addDaysIso = (iso: string, days: number): string => {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
};

/** Whole days from `a` to `b` (positive when b is later). */
export const diffDaysIso = (a: string, b: string): number =>
  Math.round((parseIsoDate(b).getTime() - parseIsoDate(a).getTime()) / 86_400_000);

export const timeOf = (date: Date): string => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

export const minutesOfDay = (date: Date): number => date.getHours() * 60 + date.getMinutes();

/** Local Date for a calendar date and clock time. */
export const atTime = (iso: string, hhmm: string): Date => {
  const date = parseIsoDate(iso);
  const minutes = toMinutes(hhmm);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
};

export const weekdayOf = (iso: string): Weekday => WEEKDAYS[(parseIsoDate(iso).getDay() + 6) % 7] ?? 'mon';

/** Age in whole years from a birth year (approximate: the app stores birth year only). */
export const ageFromBirthYear = (birthYear: number, today: Date): number =>
  Math.max(0, today.getFullYear() - birthYear);

export const birthYearFromAge = (age: number, today: Date): number => today.getFullYear() - age;
