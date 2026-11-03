import { z } from 'zod';
import { dayOffsetSchema, weekdaySchema } from './common';

export const dailyMetricSchema = z.object({
  /** Negative offset: -1 is yesterday. Today is computed live from appointments. */
  day: dayOffsetSchema,
  opdVolume: z.number().int().min(0),
  avgWaitMins: z.number().min(0),
  aiQueries: z.number().int().min(0),
  aiHandled: z.number().int().min(0),
  booked: z.number().int().min(0),
  noShows: z.number().int().min(0),
  routedTotal: z.number().int().min(0),
  routedCorrectly: z.number().int().min(0),
  byDepartment: z.record(z.number().int().min(0)),
  byLang: z.object({ en: z.number().int().min(0), ta: z.number().int().min(0) }),
});
export type DailyMetric = z.infer<typeof dailyMetricSchema>;

export const hourlyLoadSchema = z.object({
  weekday: weekdaySchema,
  hour: z.number().int().min(0).max(23),
  avgPatients: z.number().min(0),
});
export type HourlyLoad = z.infer<typeof hourlyLoadSchema>;

export const analyticsSeedSchema = z.object({
  daily: z.array(dailyMetricSchema),
  hourly: z.array(hourlyLoadSchema),
});

export type DateRangePreset = 'today' | '7d' | '30d' | 'custom';
export interface DateRange {
  from: string;
  to: string;
}

export interface Kpi {
  value: number;
  previous: number | null;
}

export interface DashboardData {
  range: DateRange;
  kpis: {
    avgWaitMins: Kpi;
    aiHandledPct: Kpi;
    noShowPct: Kpi;
    opdVolume: Kpi;
    routingAccuracyPct: Kpi;
  };
  waitTrend: { date: string; avgWaitMins: number }[];
  volumeByDepartment: { departmentId: string; count: number }[];
  langSplit: { lang: 'en' | 'ta'; count: number }[];
  heatmap: HourlyLoad[];
}
