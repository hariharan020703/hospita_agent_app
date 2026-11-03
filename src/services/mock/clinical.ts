// Mock triage records and routing rules, escalations, notifications and dashboard analytics.
import { newId } from '@/lib/id';
import { addDaysIso, diffDaysIso, minutesOfDay, toIsoDate, toMinutes } from '@/lib/time';
import {
  redFlagSchema,
  symptomRuleSchema,
  type DailyMetric,
  type DashboardData,
  type DateRange,
  type Escalation,
  type Kpi,
  type TriageSession,
} from '@/types';
import { ServiceError } from '../errors';
import type { AnalyticsService, EscalationService, NotificationService, TriageService } from '../types';
import { isoNow, mustFind, replaceById, request, today } from './core';
import type { DbState } from './state';

function escalationFromTriage(session: TriageSession): Escalation | null {
  if (session.outcome !== 'escalated' || !session.escalationReason) return null;
  const said = session.messages.filter((m) => m.from === 'patient').map((m) => m.text);
  return {
    id: newId('esc'),
    triageId: session.id,
    ...(session.patientId ? { patientId: session.patientId } : {}),
    channel: session.channel,
    reason: session.escalationReason,
    summary: said.join(' · ').slice(0, 500) || '—',
    status: 'open',
    createdAt: session.createdAt,
  };
}

export const mockTriageService: TriageService = {
  rules: () =>
    request((db) => {
      const state = db.getState();
      return {
        symptomRules: state.symptomRules,
        redFlags: state.redFlags,
        departments: state.departments.map(({ id, active, bookable }) => ({ id, active, bookable })),
      };
    }),

  save: (input) =>
    request((db) => {
      const state = db.getState();
      const session: TriageSession = { ...input, id: newId('tri'), createdAt: isoNow() };
      const escalation = escalationFromTriage(session);
      db.setState({
        triage: [...state.triage, session],
        ...(escalation ? { escalations: [...state.escalations, escalation] } : {}),
      });
      return session;
    }),

  get: (id) => request((db) => mustFind(db.getState().triage, id)),

  listSymptomRules: (departmentId) =>
    request((db) => db.getState().symptomRules.filter((r) => !departmentId || r.departmentId === departmentId)),

  saveSymptomRule: (input) =>
    request((db) => {
      const state = db.getState();
      const parsed = symptomRuleSchema.safeParse({ ...input, id: input.id ?? newId('sr') });
      if (!parsed.success) throw new ServiceError('VALIDATION');
      const exists = state.symptomRules.some((r) => r.id === parsed.data.id);
      db.setState({
        symptomRules: exists ? replaceById(state.symptomRules, parsed.data) : [...state.symptomRules, parsed.data],
      });
      return parsed.data;
    }),

  deleteSymptomRule: (id) =>
    request((db) => {
      const state = db.getState();
      mustFind(state.symptomRules, id);
      db.setState({ symptomRules: state.symptomRules.filter((r) => r.id !== id) });
    }),

  listRedFlags: () => request((db) => db.getState().redFlags),

  saveRedFlag: (input) =>
    request((db) => {
      const state = db.getState();
      const parsed = redFlagSchema.safeParse({ ...input, id: input.id ?? newId('rf') });
      if (!parsed.success) throw new ServiceError('VALIDATION');
      const exists = state.redFlags.some((r) => r.id === parsed.data.id);
      db.setState({ redFlags: exists ? replaceById(state.redFlags, parsed.data) : [...state.redFlags, parsed.data] });
      return parsed.data;
    }),

  deleteRedFlag: (id) =>
    request((db) => {
      const state = db.getState();
      mustFind(state.redFlags, id);
      db.setState({ redFlags: state.redFlags.filter((r) => r.id !== id) });
    }),
};

export const mockEscalationService: EscalationService = {
  list: (filter = {}) =>
    request((db) =>
      db
        .getState()
        .escalations.filter((e) => !filter.status || e.status === filter.status)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    ),

  create: (input) =>
    request((db) => {
      const state = db.getState();
      const escalation: Escalation = { id: newId('esc'), ...input, status: 'open', createdAt: isoNow() };
      db.setState({ escalations: [...state.escalations, escalation] });
      return escalation;
    }),

  resolve: (id, resolution, userId) =>
    request((db) => {
      const state = db.getState();
      const escalation: Escalation = {
        ...mustFind(state.escalations, id),
        status: 'resolved',
        resolution: resolution.trim(),
        resolvedBy: userId,
        resolvedAt: isoNow(),
      };
      db.setState({ escalations: replaceById(state.escalations, escalation) });
      return escalation;
    }),
};

export const mockNotificationService: NotificationService = {
  list: (userId) =>
    request((db) =>
      db
        .getState()
        .notifications.filter((n) => n.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    ),

  markRead: (id) =>
    request((db) => {
      const state = db.getState();
      db.setState({ notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) });
    }),

  markAllRead: (userId) =>
    request((db) => {
      const state = db.getState();
      db.setState({ notifications: state.notifications.map((n) => (n.userId === userId ? { ...n, read: true } : n)) });
    }),
};

// ------------------------------------------------------------------ analytics

type DayMetrics = Omit<DailyMetric, 'day'> & { date: string };

/** Today's figures computed from live appointments and triage sessions. */
function liveMetrics(state: DbState, date: string): DayMetrics {
  const appointments = state.appointments.filter((a) => a.date === date && a.status !== 'cancelled');
  const waits = appointments
    .filter((a) => a.calledAt && a.checkedInAt)
    .map((a) => {
      const called = minutesOfDay(new Date(a.calledAt ?? ''));
      const ready = Math.max(minutesOfDay(new Date(a.checkedInAt ?? '')), toMinutes(a.start));
      return Math.max(0, called - ready);
    });
  const sessions = state.triage.filter((t) => toIsoDate(new Date(t.createdAt)) === date);
  const routed = appointments.filter((a) => a.triageId);
  const byDepartment: Record<string, number> = {};
  for (const a of appointments) byDepartment[a.departmentId] = (byDepartment[a.departmentId] ?? 0) + 1;
  return {
    date,
    opdVolume: appointments.length,
    avgWaitMins: waits.length ? waits.reduce((s, w) => s + w, 0) / waits.length : 0,
    aiQueries: sessions.length,
    aiHandled: sessions.filter((t) => t.outcome !== 'escalated').length,
    booked: appointments.filter((a) => a.source === 'app').length,
    noShows: appointments.filter((a) => a.status === 'no_show').length,
    routedTotal: routed.length,
    routedCorrectly: routed.filter(
      (a) => state.triage.find((t) => t.id === a.triageId)?.departmentId === a.departmentId,
    ).length,
    byDepartment,
    byLang: { en: sessions.filter((t) => t.lang === 'en').length, ta: sessions.filter((t) => t.lang === 'ta').length },
  };
}

const ratio = (num: number, den: number) => (den > 0 ? num / den : 0);

function summarize(days: DayMetrics[]) {
  const volume = days.reduce((s, d) => s + d.opdVolume, 0);
  const sum = (pick: (d: DayMetrics) => number) => days.reduce((s, d) => s + pick(d), 0);
  return {
    avgWaitMins: ratio(
      sum((d) => d.avgWaitMins * d.opdVolume),
      volume,
    ),
    aiHandledPct: ratio(
      sum((d) => d.aiHandled),
      sum((d) => d.aiQueries),
    ),
    noShowPct: ratio(
      sum((d) => d.noShows),
      sum((d) => d.booked),
    ),
    opdVolume: volume,
    routingAccuracyPct: ratio(
      sum((d) => d.routedCorrectly),
      sum((d) => d.routedTotal),
    ),
  };
}

export const mockAnalyticsService: AnalyticsService = {
  dashboard: async (range: DateRange) => {
    const { analyticsHistory } = await import('./seed');
    return request((db): DashboardData => {
      const state = db.getState();
      const todayIso = today();
      const history = analyticsHistory(todayIso);
      const earliest = history.daily[0]?.date ?? todayIso;
      const metricsOn = (date: string): DayMetrics | null =>
        date === todayIso ? liveMetrics(state, date) : (history.daily.find((d) => d.date === date) ?? null);
      const daysIn = (from: string, to: string) => {
        const list: DayMetrics[] = [];
        for (let date = from; date <= to; date = addDaysIso(date, 1)) {
          const m = metricsOn(date);
          if (m) list.push(m);
        }
        return list;
      };

      const from = range.from < earliest ? earliest : range.from;
      const to = range.to > todayIso ? todayIso : range.to;
      if (from > to) throw new ServiceError('VALIDATION', 'Empty date range');
      const length = diffDaysIso(from, to) + 1;
      const current = daysIn(from, to);
      const previousDays = daysIn(addDaysIso(from, -length), addDaysIso(from, -1));
      const now = summarize(current);
      const before = previousDays.length === length ? summarize(previousDays) : null;
      const kpi = (key: keyof ReturnType<typeof summarize>): Kpi => ({
        value: now[key],
        previous: before ? before[key] : null,
      });

      const volumeByDepartment = new Map<string, number>();
      const lang = { en: 0, ta: 0 };
      for (const d of current) {
        for (const [dept, count] of Object.entries(d.byDepartment))
          volumeByDepartment.set(dept, (volumeByDepartment.get(dept) ?? 0) + count);
        lang.en += d.byLang.en;
        lang.ta += d.byLang.ta;
      }

      return {
        range: { from, to },
        kpis: {
          avgWaitMins: kpi('avgWaitMins'),
          aiHandledPct: kpi('aiHandledPct'),
          noShowPct: kpi('noShowPct'),
          opdVolume: kpi('opdVolume'),
          routingAccuracyPct: kpi('routingAccuracyPct'),
        },
        waitTrend: current.map((d) => ({ date: d.date, avgWaitMins: Math.round(d.avgWaitMins * 10) / 10 })),
        volumeByDepartment: [...volumeByDepartment.entries()]
          .map(([departmentId, count]) => ({ departmentId, count }))
          .sort((a, b) => b.count - a.count),
        langSplit: [
          { lang: 'ta', count: lang.ta },
          { lang: 'en', count: lang.en },
        ],
        heatmap: history.hourly,
      };
    });
  },
};
