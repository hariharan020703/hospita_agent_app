// Admin dashboard: KPIs with change vs the previous period, and four charts for a chosen date range.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Card, ErrorState, PageHeader, SegmentedControl, Skeleton } from '@/components/ui';
import { useDashboard } from '@/hooks/queries/clinical';
import { useDepartments } from '@/hooks/queries/directory';
import { useLocale } from '@/hooks/useLocale';
import { todayIso } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { formatDate, formatNumber, formatPercent } from '@/lib/format';
import { addDaysIso, diffDaysIso } from '@/lib/time';
import type { DateRange, Kpi } from '@/types';
import { DateRangeFields } from '../components/Common';
import { DepartmentVolumeChart, LanguageSplit, PeakHeatmap, WaitTrendChart } from '../components/DashboardCharts';
import {
  KPI_KEYS,
  LOWER_IS_BETTER,
  MAX_DAYS_BACK,
  presetRange,
  RANGE_PRESETS,
  type KpiKey,
  type RangePreset,
} from '../lib';

function KpiCard({ kpiKey, kpi }: { kpiKey: KpiKey; kpi: Kpi }) {
  const { t } = useTranslation('admin');
  const { lang } = useLocale();
  const isPct = kpiKey.endsWith('Pct');
  const value =
    kpiKey === 'avgWaitMins'
      ? t('units.minutes', { value: formatNumber(kpi.value, lang, 1) })
      : isPct
        ? formatPercent(kpi.value, lang)
        : formatNumber(kpi.value, lang);

  let change: { text: string; direction: 'up' | 'down' | 'flat'; good: boolean } | null = null;
  if (kpi.previous !== null) {
    const delta = kpi.value - kpi.previous;
    let magnitude: string;
    let flat: boolean;
    if (kpiKey === 'avgWaitMins') {
      flat = Math.abs(delta) < 0.05;
      magnitude = t('units.minutes', { value: formatNumber(Math.abs(delta), lang, 1) });
    } else if (isPct) {
      flat = Math.abs(delta) < 0.0005;
      magnitude = t('units.points', { value: formatNumber(Math.abs(delta) * 100, lang, 1) });
    } else if (kpi.previous > 0) {
      flat = delta === 0;
      magnitude = formatPercent(Math.abs(delta) / kpi.previous, lang);
    } else {
      flat = delta === 0;
      magnitude = formatNumber(Math.abs(delta), lang);
    }
    const direction = flat ? 'flat' : delta > 0 ? 'up' : 'down';
    const good = LOWER_IS_BETTER.has(kpiKey) ? delta < 0 : delta > 0;
    change = { text: `${direction === 'up' ? '+' : direction === 'down' ? '−' : ''}${magnitude}`, direction, good };
  }
  const Icon = change?.direction === 'up' ? ArrowUpRight : change?.direction === 'down' ? ArrowDownRight : Minus;

  return (
    <Card className="flex flex-col gap-2 p-4">
      <h2 className="text-sm font-medium text-fg-muted">{t(`dashboard.kpi.${kpiKey}`)}</h2>
      <p className="text-3xl font-bold tracking-tight text-fg tabular">{value}</p>
      {change === null ? (
        <p className="text-xs text-fg-subtle">{t('dashboard.kpi.noPrevious')}</p>
      ) : change.direction === 'flat' ? (
        <p className="flex items-center gap-1 text-xs font-medium text-fg-muted">
          <Minus aria-hidden className="h-4 w-4 shrink-0" />
          {t('dashboard.kpi.noChange')}
        </p>
      ) : (
        <p
          className={cn(
            'flex flex-wrap items-center gap-1 text-xs font-medium',
            change.good ? 'text-success-ink' : 'text-warning-ink',
          )}
        >
          <Icon aria-hidden className="h-4 w-4 shrink-0" />
          <span>{t('dashboard.kpi.change', { change: change.text })}</span>
          <span className="rounded bg-surface-sunken px-1.5 py-0.5">
            {change.good ? t('dashboard.kpi.better') : t('dashboard.kpi.worse')}
          </span>
        </p>
      )}
    </Card>
  );
}

function DashboardSkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">{t('states.loading')}</span>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {KPI_KEYS.map((key) => (
          <Skeleton key={key} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-80 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation('admin');
  const { lang, l } = useLocale();
  const [today] = useState(todayIso);
  const [preset, setPreset] = useState<RangePreset>('7d');
  const [custom, setCustom] = useState<DateRange>(() => ({ from: addDaysIso(today, -6), to: today }));
  const range = preset === 'custom' ? custom : presetRange(preset, today);
  const dashboard = useDashboard(range);
  const departments = useDepartments(true);

  const volume = (dashboard.data?.volumeByDepartment ?? []).map((v) => ({
    name: l(departments.data?.find((d) => d.id === v.departmentId)?.name) || v.departmentId,
    count: v.count,
  }));

  const shown = dashboard.data?.range ?? range;
  const days = diffDaysIso(shown.from, shown.to) + 1;

  return (
    <div className="space-y-6">
      <PageHeader title={t('dashboard.title')} description={t('dashboard.description')} />

      <section aria-labelledby="range-heading" className="space-y-3 rounded-xl border bg-surface p-4">
        <h2 id="range-heading" className="sr-only">
          {t('range.label')}
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl
            label={t('range.label')}
            value={preset}
            onChange={setPreset}
            options={RANGE_PRESETS.map((p) => ({ value: p, label: t(`range.presets.${p}`) }))}
          />
          <p className="text-sm text-fg-muted" aria-live="polite">
            {shown.from === shown.to
              ? t('range.showingDay', { date: formatDate(shown.from, lang, 'medium') })
              : t('range.showing', {
                  from: formatDate(shown.from, lang, 'medium'),
                  to: formatDate(shown.to, lang, 'medium'),
                })}{' '}
            · {t('range.comparedWith', { count: days })}
            {dashboard.isFetching && !dashboard.isPending && (
              <span className="ml-2 text-fg-subtle">{t('dashboard.updating')}</span>
            )}
          </p>
        </div>
        {preset === 'custom' && (
          <DateRangeFields
            value={custom}
            onChange={setCustom}
            min={addDaysIso(today, -MAX_DAYS_BACK)}
            max={today}
            className="max-w-xl"
          />
        )}
      </section>

      {dashboard.isPending ? (
        <DashboardSkeleton />
      ) : dashboard.isError ? (
        <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />
      ) : (
        <>
          <section aria-label={t('dashboard.kpiHeading')} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {KPI_KEYS.map((key) => (
              <KpiCard key={key} kpiKey={key} kpi={dashboard.data.kpis[key]} />
            ))}
          </section>
          <div className="grid gap-6 xl:grid-cols-2">
            <WaitTrendChart data={dashboard.data.waitTrend} lang={lang} />
            <DepartmentVolumeChart data={volume} lang={lang} />
            <PeakHeatmap data={dashboard.data.heatmap} lang={lang} />
            <LanguageSplit data={dashboard.data.langSplit} lang={lang} />
          </div>
        </>
      )}
    </div>
  );
}
