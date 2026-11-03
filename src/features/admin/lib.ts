// Pure helpers for the admin app: list parsing, form mapping, weekly-hours validation, date ranges and report rollups.
import type { ZodError } from 'zod';
import { addDaysIso } from '@/lib/time';
import {
  WEEKDAYS,
  type AppointmentView,
  type DashboardData,
  type DateRange,
  type Department,
  type DepartmentFormValues,
  type Doctor,
  type DoctorFormInput,
  type Weekday,
  type WeeklyHours,
} from '@/types';

// ---------------------------------------------------------------- comma / line separated lists

/** "chest pain, breathless" -> ["chest pain", "breathless"] (trimmed, de-duplicated, blanks dropped). */
export function splitList(text: string): string[] {
  const seen = new Set<string>();
  for (const part of text.split(/[,\n]/)) {
    const value = part.trim();
    if (value) seen.add(value);
  }
  return [...seen];
}

export const joinList = (items: readonly string[]): string => items.join(', ');

/** One group per line; terms in a line are comma-separated and must all appear. */
export function splitGroups(text: string): string[][] {
  return text
    .split('\n')
    .map((line) => splitList(line))
    .filter((group) => group.length > 0);
}

export const joinGroups = (groups: readonly (readonly string[])[]): string => groups.map(joinList).join('\n');

// ---------------------------------------------------------------- entity <-> form values

export function doctorToForm(doctor: Doctor): DoctorFormInput {
  return {
    name: doctor.name,
    nameTa: doctor.nameTa ?? '',
    gender: doctor.gender,
    photoUrl: doctor.photoUrl,
    qualifications: joinList(doctor.qualifications),
    registrationNo: doctor.registrationNo,
    departmentId: doctor.departmentId,
    languages: [...doctor.languages],
    fee: doctor.fee,
    consultMins: doctor.consultMins,
    room: doctor.room,
    experienceYears: doctor.experienceYears,
    bioEn: doctor.bio?.en ?? '',
    bioTa: doctor.bio?.ta ?? '',
    active: doctor.active,
  };
}

export function emptyDoctorForm(departmentId: string): DoctorFormInput {
  return {
    name: '',
    nameTa: '',
    gender: 'female',
    photoUrl: undefined,
    qualifications: '',
    registrationNo: '',
    departmentId,
    languages: ['ta', 'en'],
    fee: 500,
    consultMins: 15,
    room: '',
    experienceYears: 0,
    bioEn: '',
    bioTa: '',
    active: true,
  };
}

export function departmentToForm(department: Department): DepartmentFormValues {
  const { id: _id, sortOrder: _sortOrder, ...values } = department;
  return values;
}

export function emptyDepartmentForm(): DepartmentFormValues {
  return {
    name: { en: '', ta: '' },
    description: { en: '', ta: '' },
    icon: 'stethoscope',
    floor: 0,
    wing: { en: '', ta: '' },
    tokenPrefix: '',
    bookable: true,
    active: true,
  };
}

// ---------------------------------------------------------------- weekly hours

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export type RangeIssue = 'time' | 'endAfterStart' | 'overlap';
export type WeeklyIssues = Partial<Record<Weekday, Record<number, RangeIssue>>>;

/** Checks every range: valid HH:mm, start before end, and no overlap with another range that day. */
export function validateWeekly(weekly: WeeklyHours): WeeklyIssues {
  const issues: WeeklyIssues = {};
  for (const day of WEEKDAYS) {
    const dayIssues: Record<number, RangeIssue> = {};
    const ranges = weekly[day];
    ranges.forEach((range, index) => {
      if (!TIME.test(range.start) || !TIME.test(range.end)) dayIssues[index] = 'time';
      else if (range.start >= range.end) dayIssues[index] = 'endAfterStart';
    });
    const valid = ranges
      .map((range, index) => ({ ...range, index }))
      .filter((range) => dayIssues[range.index] === undefined)
      .sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < valid.length; i++) {
      const previous = valid[i - 1];
      const current = valid[i];
      if (previous && current && current.start < previous.end) dayIssues[current.index] = 'overlap';
    }
    if (Object.keys(dayIssues).length > 0) issues[day] = dayIssues;
  }
  return issues;
}

export const hasWeeklyIssues = (issues: WeeklyIssues): boolean => Object.keys(issues).length > 0;

/** Ranges sorted by start time within each day. */
export function sortWeekly(weekly: WeeklyHours): WeeklyHours {
  const sorted = { ...weekly };
  for (const day of WEEKDAYS) sorted[day] = [...weekly[day]].sort((a, b) => a.start.localeCompare(b.start));
  return sorted;
}

// ---------------------------------------------------------------- zod issues -> field errors

/** First validation key per dotted path ("address.pincode" -> "pincode"). */
export function issuesToErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.');
    if (!(path in errors)) errors[path] = issue.message;
  }
  return errors;
}

// ---------------------------------------------------------------- dashboard

export const RANGE_PRESETS = ['today', '7d', '30d', 'custom'] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

/** Oldest date a custom dashboard range may start from, in days before today. */
export const MAX_DAYS_BACK = 90;

export function presetRange(preset: Exclude<RangePreset, 'custom'>, today: string): DateRange {
  if (preset === 'today') return { from: today, to: today };
  return { from: addDaysIso(today, preset === '7d' ? -6 : -29), to: today };
}

export type KpiKey = keyof DashboardData['kpis'];
export const KPI_KEYS: readonly KpiKey[] = [
  'avgWaitMins',
  'aiHandledPct',
  'noShowPct',
  'opdVolume',
  'routingAccuracyPct',
];
/** For these KPIs a fall is an improvement. */
export const LOWER_IS_BETTER: ReadonlySet<KpiKey> = new Set<KpiKey>(['avgWaitMins', 'noShowPct']);

/** Chart colours (data colours, not UI tokens): the brand teal and a 5-step sequential teal ramp. */
export const CHART_TEAL = '#0E7C86';
export const HEAT_RAMP = ['#E6F4F5', '#B3DEE1', '#6FBEC4', '#2E979F', '#0B5E66'] as const;
/** Ramp steps dark enough to need white text. */
export const HEAT_DARK_FROM = 3;

/** 0..4 step of the ramp for a value, using equal intervals up to the maximum. */
export function heatStep(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.min(HEAT_RAMP.length - 1, Math.floor((value / max) * HEAT_RAMP.length));
}

// ---------------------------------------------------------------- reports

export interface DailySummaryRow {
  date: string;
  total: number;
  completed: number;
  noShows: number;
  cancelled: number;
}

export function dailySummary(appointments: readonly AppointmentView[]): DailySummaryRow[] {
  const byDate = new Map<string, DailySummaryRow>();
  for (const a of appointments) {
    const row = byDate.get(a.date) ?? { date: a.date, total: 0, completed: 0, noShows: 0, cancelled: 0 };
    row.total += 1;
    if (a.status === 'completed') row.completed += 1;
    if (a.status === 'no_show') row.noShows += 1;
    if (a.status === 'cancelled') row.cancelled += 1;
    byDate.set(a.date, row);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export interface DepartmentVolumeRow {
  departmentId: string;
  total: number;
  completed: number;
  noShows: number;
  cancelled: number;
  /** No-shows as a share of appointments that were not cancelled. */
  noShowRate: number;
}

export function departmentVolume(appointments: readonly AppointmentView[]): DepartmentVolumeRow[] {
  const byDept = new Map<string, DepartmentVolumeRow>();
  for (const a of appointments) {
    const row = byDept.get(a.departmentId) ?? {
      departmentId: a.departmentId,
      total: 0,
      completed: 0,
      noShows: 0,
      cancelled: 0,
      noShowRate: 0,
    };
    row.total += 1;
    if (a.status === 'completed') row.completed += 1;
    if (a.status === 'no_show') row.noShows += 1;
    if (a.status === 'cancelled') row.cancelled += 1;
    byDept.set(a.departmentId, row);
  }
  return [...byDept.values()]
    .map((row) => {
      const held = row.total - row.cancelled;
      return { ...row, noShowRate: held > 0 ? row.noShows / held : 0 };
    })
    .sort((a, b) => b.total - a.total);
}

export const byDateTime = (a: AppointmentView, b: AppointmentView): number =>
  a.date.localeCompare(b.date) || a.start.localeCompare(b.start);
