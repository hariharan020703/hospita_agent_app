// Locale-aware formatting for dates, times, money and numbers (Intl + date-fns locales for ta-IN / en-IN).
import { format as formatFns } from 'date-fns';
import { enIN, ta } from 'date-fns/locale';
import type { Lang } from '@/types';
import { atTime, parseIsoDate } from './time';

export const INTL_LOCALE: Record<Lang, string> = { en: 'en-IN', ta: 'ta-IN' };
export const DATE_FNS_LOCALE = { en: enIN, ta } as const;

const cache = new Map<string, Intl.DateTimeFormat>();
function dtf(lang: Lang, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${lang}|${JSON.stringify(options)}`;
  let formatter = cache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(INTL_LOCALE[lang], options);
    cache.set(key, formatter);
  }
  return formatter;
}

/** "11:10 am" / "முற்பகல் 11:10" from "HH:mm". */
export function formatTime(hhmm: string, lang: Lang): string {
  return dtf(lang, { hour: 'numeric', minute: '2-digit' }).format(atTime('2000-01-01', hhmm));
}

export type DateStyle = 'short' | 'medium' | 'long' | 'weekday' | 'dayMonth';

const DATE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { day: 'numeric', month: 'short' },
  medium: { day: 'numeric', month: 'short', year: 'numeric' },
  long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  weekday: { weekday: 'short', day: 'numeric', month: 'short' },
  dayMonth: { day: 'numeric', month: 'long' },
};

export function formatDate(iso: string, lang: Lang, style: DateStyle = 'medium'): string {
  return dtf(lang, DATE_OPTIONS[style]).format(parseIsoDate(iso));
}

export function formatDateTime(isoDateTime: string, lang: Lang): string {
  return dtf(lang, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(
    new Date(isoDateTime),
  );
}

export function formatWeekday(iso: string, lang: Lang, width: 'short' | 'long' = 'short'): string {
  return dtf(lang, { weekday: width }).format(parseIsoDate(iso));
}

export function formatMonthYear(date: Date, lang: Lang): string {
  return formatFns(date, 'LLLL yyyy', { locale: DATE_FNS_LOCALE[lang] });
}

export function formatCurrency(amount: number, lang: Lang): string {
  return new Intl.NumberFormat(INTL_LOCALE[lang], {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(value: number, lang: Lang, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(INTL_LOCALE[lang], { maximumFractionDigits }).format(value);
}

/** 0.124 -> "12.4%" */
export function formatPercent(ratio: number, lang: Lang, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(INTL_LOCALE[lang], { style: 'percent', maximumFractionDigits }).format(ratio);
}

export function formatRelativeMinutes(minutes: number, lang: Lang): string {
  return new Intl.RelativeTimeFormat(INTL_LOCALE[lang], { numeric: 'auto' }).format(Math.round(minutes), 'minute');
}

/** Duration such as "1 hr 20 min" in the active language. */
export function formatDuration(minutes: number, lang: Lang): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  const unit = (value: number, kind: 'hour' | 'minute') =>
    new Intl.NumberFormat(INTL_LOCALE[lang], { style: 'unit', unit: kind, unitDisplay: 'short' }).format(value);
  if (hours === 0) return unit(mins, 'minute');
  if (mins === 0) return unit(hours, 'hour');
  return `${unit(hours, 'hour')} ${unit(mins, 'minute')}`;
}

/** Indian mobile number for display: 98765 43210. */
export const formatPhone = (phone: string): string =>
  /^\d{10}$/.test(phone) ? `${phone.slice(0, 5)} ${phone.slice(5)}` : phone;
