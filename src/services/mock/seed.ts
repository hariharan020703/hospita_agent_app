// Builds the mock database from src/data/*.json: validates every record with its zod schema and turns the
// relative day offsets in operational data into real dates around today. Agent sample data (saved health records,
// care plans with their chat, doctor follow-ups) comes from src/data/records and src/data/care.
import { z } from 'zod';
import agentActivityJson from '@/data/agents/activity.json';
import analyticsJson from '@/data/analytics.json';
import appointmentsJson from '@/data/appointments.json';
import carePlansJson from '@/data/care/plans.json';
import phrasesJson from '@/data/care/phrases.json';
import departmentsJson from '@/data/departments.json';
import doctorsJson from '@/data/doctors.json';
import escalationsJson from '@/data/escalations.json';
import hospitalJson from '@/data/hospital.json';
import notificationsJson from '@/data/notifications.json';
import patientsJson from '@/data/patients.json';
import queuesJson from '@/data/queues.json';
import recordsJson from '@/data/records/records.json';
import redFlagsJson from '@/data/redFlags.json';
import schedulesJson from '@/data/schedules.json';
import symptomRulesJson from '@/data/symptomRules.json';
import triageJson from '@/data/triage.json';
import usersJson from '@/data/users.json';
import { addDaysIso, atTime, toIsoDate } from '@/lib/time';
import {
  AGENT_IDS,
  agentActivitySeedSchema,
  analyticsSeedSchema,
  appointmentSeedSchema,
  careMessageSeedSchema,
  carePlanSeedSchema,
  doctorQuerySeedSchema,
  departmentSchema,
  doctorDaySeedSchema,
  doctorSchema,
  escalationSeedSchema,
  hospitalSchema,
  leaveSeedSchema,
  notificationSeedSchema,
  patientSchema,
  phraseSchema,
  recordSeedSchema,
  redFlagSchema,
  scheduleSchema,
  symptomRuleSchema,
  triageSeedSchema,
  userSchema,
  type CareLine,
  type DailyMetric,
  type HourlyLoad,
} from '@/types';
import type { DbState } from './state';

export const DB_VERSION = 5;

// Scans behind the sample health records (and the demo samples a patient can pick).
const recordImages: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('/src/data/records/samples/*.svg', { eager: true, query: '?url', import: 'default' }),
  ).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1), url]),
);

function parse<T extends z.ZodTypeAny>(name: string, schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`Seed file ${name} is invalid at ${issue?.path.join('.') ?? '?'}: ${issue?.message ?? 'unknown'}`);
  }
  return result.data as z.infer<T>;
}

export function createSeedState(now: Date): DbState {
  const today = toIsoDate(now);
  const dateOf = (day: number) => addDaysIso(today, day);
  const stamp = (day: number, hhmm: string) => atTime(dateOf(day), hhmm).toISOString();
  const nowIso = now.toISOString();

  const schedules = parse(
    'schedules.json',
    z.object({ schedules: z.array(scheduleSchema), leaves: z.array(leaveSeedSchema) }),
    schedulesJson,
  );

  const appointments = parse('appointments.json', z.array(appointmentSeedSchema), appointmentsJson).map(
    ({ day, checkedInAt, calledAt, completedAt, ...rest }) => {
      const createdAt = stamp(Math.min(day, 0) - 1, '19:00');
      return {
        ...rest,
        date: dateOf(day),
        ...(checkedInAt ? { checkedInAt: stamp(day, checkedInAt) } : {}),
        ...(calledAt ? { calledAt: stamp(day, calledAt) } : {}),
        ...(completedAt ? { completedAt: stamp(day, completedAt) } : {}),
        createdAt,
        updatedAt: completedAt ? stamp(day, completedAt) : createdAt,
      };
    },
  );

  return {
    version: DB_VERSION,
    seededFor: today,
    hospital: parse('hospital.json', hospitalSchema, hospitalJson),
    users: parse('users.json', z.array(userSchema), usersJson),
    patients: parse('patients.json', z.array(patientSchema), patientsJson),
    departments: parse('departments.json', z.array(departmentSchema), departmentsJson),
    doctors: parse('doctors.json', z.array(doctorSchema), doctorsJson),
    schedules: schedules.schedules,
    leaves: schedules.leaves.map(({ fromDay, toDay, ...rest }) => ({
      ...rest,
      from: dateOf(fromDay),
      to: dateOf(toDay),
      requestedAt: stamp(Math.min(fromDay, 0) - 2, '11:00'),
      ...(rest.status !== 'pending' ? { decidedAt: stamp(Math.min(fromDay, 0) - 1, '10:00') } : {}),
    })),
    appointments,
    doctorDays: parse('queues.json', z.array(doctorDaySeedSchema), queuesJson).map(({ day, ...rest }) => ({
      ...rest,
      date: dateOf(day),
      updatedAt: nowIso,
    })),
    triage: parse('triage.json', z.array(triageSeedSchema), triageJson).map(({ day, at, ...rest }) => ({
      ...rest,
      createdAt: stamp(day, at),
    })),
    escalations: parse('escalations.json', z.array(escalationSeedSchema), escalationsJson).map(
      ({ day, at, ...rest }) => ({
        ...rest,
        createdAt: stamp(day, at),
        ...(rest.status === 'resolved' ? { resolvedAt: stamp(day, at) } : {}),
      }),
    ),
    symptomRules: parse('symptomRules.json', z.array(symptomRuleSchema), symptomRulesJson),
    redFlags: parse('redFlags.json', z.array(redFlagSchema), redFlagsJson),
    notifications: parse('notifications.json', z.array(notificationSeedSchema), notificationsJson).map(
      ({ day, at, params, ...rest }) => ({
        ...rest,
        // "@day:N" in a parameter is a date relative to today.
        params: Object.fromEntries(
          Object.entries(params).map(([k, v]) => [
            k,
            typeof v === 'string' && v.startsWith('@day:') ? dateOf(Number(v.slice(5))) : v,
          ]),
        ),
        createdAt: stamp(day, at),
      }),
    ),
    // Dr. Meena runs her own queue (the demo doctor account): the simulation never moves it, so the patient in her
    // room stays there until she completes the consultation.
    manualDoctorIds: ['doc_01'],
    agentSettings: Object.fromEntries(AGENT_IDS.map((id) => [id, true])) as DbState['agentSettings'],
    agentActivity: parse('agents/activity.json', z.array(agentActivitySeedSchema), agentActivityJson).map(
      ({ day, time, ...rest }) => ({ ...withDates(rest, dateOf), at: stamp(day, time) }),
    ),
    ...agentSamples(dateOf, stamp),
    notes: [],
  };
}

/** Saved health records, care plans with their chat history and check-ins, and doctors' follow-up queries. */
function agentSamples(dateOf: (day: number) => string, stamp: (day: number, hhmm: string) => string) {
  const phrases = parse('care/phrases.json', z.array(phraseSchema), phrasesJson);
  const normal = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ');
  const careLine = (en: string): CareLine => {
    const ta = phrases.find((p) => normal(p.en) === normal(en))?.ta;
    return ta ? { en, ta } : { en };
  };
  const care = parse(
    'care/plans.json',
    z.object({
      plans: z.array(carePlanSeedSchema),
      messages: z.array(careMessageSeedSchema),
      queries: z.array(doctorQuerySeedSchema),
    }),
    carePlansJson,
  );
  return {
    records: parse('records/records.json', z.array(recordSeedSchema), recordsJson).map(
      ({ day, at, image, ...rest }) => ({
        ...rest,
        fileType: 'image' as const,
        imageUrl: recordImages[image] ?? '',
        status: 'saved' as const,
        createdAt: stamp(day, at),
        savedAt: stamp(day, at),
      }),
    ),
    carePlans: care.plans.map(
      ({ day, at, complaint, medicines, advice, tests, followUpDay, checkIns, doses, ...rest }) => {
        const start = dateOf(day);
        return {
          ...rest,
          complaint: careLine(complaint),
          medicines: medicines.map((m) => ({ ...m, startDate: start, endDate: addDaysIso(start, m.days - 1) })),
          advice: advice.map(careLine),
          tests: tests.map(careLine),
          followUpDate: followUpDay === null ? null : dateOf(followUpDay),
          checkIns: checkIns.map(({ sentDay, sentAt, repliedAt, ...c }) => ({
            ...c,
            sentAt: stamp(sentDay, sentAt),
            ...(repliedAt ? { repliedAt: stamp(sentDay, repliedAt) } : {}),
          })),
          doses: doses.map(({ day: doseDay, at: doseAt, ...d }) => ({
            ...d,
            date: dateOf(doseDay),
            at: stamp(doseDay, doseAt),
          })),
          createdAt: stamp(day, at),
        };
      },
    ),
    careMessages: care.messages.map(({ day, at, ...rest }) => ({ ...withDates(rest, dateOf), at: stamp(day, at) })),
    doctorQueries: care.queries.map(({ day, at, answeredDay, answeredAt, ...rest }) => ({
      ...rest,
      createdAt: stamp(day, at),
      ...(answeredDay !== undefined && answeredAt ? { answeredAt: stamp(answeredDay, answeredAt) } : {}),
    })),
  };
}

/** Replaces "@day:N" strings anywhere in seed parameters with the date N days from today. */
function withDates<T>(value: T, dateOf: (day: number) => string): T {
  if (typeof value === 'string') {
    return (value.startsWith('@day:') ? dateOf(Number(value.slice(5))) : value) as T;
  }
  if (Array.isArray(value)) return value.map((v: unknown) => withDates(v, dateOf)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withDates(v, dateOf)])) as T;
  }
  return value;
}

export interface AnalyticsHistory {
  daily: (DailyMetric & { date: string })[];
  hourly: HourlyLoad[];
}

/** Read-only operational history for the admin dashboard (not persisted with the mutable data). */
export function analyticsHistory(today: string): AnalyticsHistory {
  const seed = parse('analytics.json', analyticsSeedSchema, analyticsJson);
  return { daily: seed.daily.map((d) => ({ ...d, date: addDaysIso(today, d.day) })), hourly: seed.hourly };
}
