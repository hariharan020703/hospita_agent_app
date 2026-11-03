// Dashboard charts. Imported only by the dashboard page so recharts stays in that chunk.
// Every chart has a text alternative ("View as table") and never relies on colour alone.
import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type LabelProps,
} from 'recharts';
import { Card, CardBody, CardHeader } from '@/components/ui';
import { formatDate, formatNumber, formatPercent, INTL_LOCALE } from '@/lib/format';
import { WEEKDAYS, type HourlyLoad, type Lang } from '@/types';
import { CHART_TEAL, HEAT_DARK_FROM, HEAT_RAMP, heatStep } from '../lib';
import { SimpleTable } from './Common';

// Axes, grid and tooltip follow the theme through CSS variables (muted greys in light and dark).
const GRID = 'rgb(var(--color-border))';
const AXIS = 'rgb(var(--color-text-subtle))';
const INK = 'rgb(var(--color-text))';
const TOOLTIP_STYLE = {
  background: 'rgb(var(--color-surface))',
  border: '1px solid rgb(var(--color-border))',
  borderRadius: 8,
  color: 'rgb(var(--color-text))',
  fontSize: 12,
  boxShadow: '0 4px 12px -2px rgb(15 23 42 / 0.10)',
} as const;
const TICK = { fill: AXIS, fontSize: 12 } as const;

export function ChartCard({
  title,
  description,
  table,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  table: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation('admin');
  return (
    <Card className={className}>
      <CardHeader title={title} description={description} />
      <CardBody className="space-y-3">
        {children}
        <details className="rounded-lg border bg-surface-muted text-sm">
          <summary className="cursor-pointer select-none rounded-lg px-3 py-2 font-medium text-fg">
            {t('dashboard.viewAsTable')}
          </summary>
          <div className="max-h-80 overflow-auto px-3 pb-3 scrollbar-thin">{table}</div>
        </details>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------- (a) wait-time trend

export function WaitTrendChart({ data, lang }: { data: { date: string; avgWaitMins: number }[]; lang: Lang }) {
  const { t } = useTranslation('admin');
  const minutes = (value: number) => t('units.minutes', { value: formatNumber(value, lang, 1) });
  const rows = data.map((d) => ({ ...d, label: formatDate(d.date, lang, 'short') }));
  const last = rows.length - 1;
  const lastRow = rows[last];

  const lastLabel = (props: LabelProps) => {
    if (props.index !== last || props.x === undefined || props.y === undefined) return null;
    return (
      <text x={Number(props.x)} y={Number(props.y) - 10} textAnchor="end" fill={INK} fontSize={12} fontWeight={600}>
        {minutes(Number(props.value))}
      </text>
    );
  };

  return (
    <ChartCard
      title={t('dashboard.charts.waitTrend')}
      description={t('dashboard.charts.waitTrendHint')}
      table={
        <SimpleTable
          caption={t('dashboard.charts.waitTrend')}
          headers={[t('dashboard.table.date'), t('dashboard.table.avgWait')]}
          rows={rows.map((r) => [formatDate(r.date, lang, 'medium'), minutes(r.avgWaitMins)])}
        />
      }
    >
      <div
        className="h-64"
        role="img"
        aria-label={
          lastRow
            ? t('dashboard.charts.waitTrendSummary', {
                count: rows.length,
                latest: minutes(lastRow.avgWaitMins),
              })
            : t('dashboard.noData')
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 24, right: 16, bottom: 0, left: 0 }} accessibilityLayer={false}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={20} />
            <YAxis tick={TICK} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ fontWeight: 600 }}
              cursor={{ stroke: GRID }}
              formatter={(value) => [minutes(Number(value)), t('dashboard.table.avgWait')]}
            />
            <Line
              type="monotone"
              dataKey="avgWaitMins"
              stroke={CHART_TEAL}
              strokeWidth={2}
              dot={rows.length === 1 ? { r: 4, fill: CHART_TEAL, strokeWidth: 0 } : false}
              activeDot={{ r: 5, fill: CHART_TEAL, stroke: 'rgb(var(--color-surface))', strokeWidth: 2 }}
              isAnimationActive={false}
            >
              <LabelList dataKey="avgWaitMins" content={lastLabel} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

// ---------------------------------------------------------------- (b) volume by department

export function DepartmentVolumeChart({ data, lang }: { data: { name: string; count: number }[]; lang: Lang }) {
  const { t } = useTranslation('admin');
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const height = Math.max(160, data.length * 34 + 32);
  const top = data[0];
  return (
    <ChartCard
      title={t('dashboard.charts.volume')}
      description={t('dashboard.charts.volumeHint')}
      table={
        <SimpleTable
          caption={t('dashboard.charts.volume')}
          headers={[t('dashboard.table.department'), t('dashboard.table.visits'), t('dashboard.table.share')]}
          rows={data.map((d) => [
            d.name,
            formatNumber(d.count, lang),
            formatPercent(total ? d.count / total : 0, lang),
          ])}
        />
      }
    >
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-fg-muted">{t('dashboard.noData')}</p>
      ) : (
        <div
          style={{ height }}
          role="img"
          aria-label={
            top
              ? t('dashboard.charts.volumeSummary', {
                  department: top.name,
                  value: formatNumber(top.count, lang),
                  total: formatNumber(total, lang),
                })
              : ''
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 0, right: 48, bottom: 0, left: 0 }}
              barCategoryGap={6}
              accessibilityLayer={false}
            >
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={150}
                tick={{ fill: INK, fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ fontWeight: 600 }}
                cursor={{ fill: 'rgb(var(--color-surface-sunken))' }}
                formatter={(value) => [formatNumber(Number(value), lang), t('dashboard.table.visits')]}
              />
              <Bar dataKey="count" fill={CHART_TEAL} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
                <LabelList
                  dataKey="count"
                  position="right"
                  fill={INK}
                  fontSize={12}
                  formatter={(value) => formatNumber(Number(value), lang)}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

// ---------------------------------------------------------------- (c) peak-hour heatmap

const hourLabel = (hour: number, lang: Lang) =>
  new Intl.DateTimeFormat(INTL_LOCALE[lang], { hour: 'numeric' }).format(new Date(2000, 0, 1, hour));

export function PeakHeatmap({ data, lang }: { data: HourlyLoad[]; lang: Lang }) {
  const { t } = useTranslation(['admin', 'common']);
  const hours = [...new Set(data.map((d) => d.hour))].sort((a, b) => a - b);
  const values = new Map(data.map((d) => [`${d.weekday}-${d.hour}`, d.avgPatients]));
  const valueAt = (day: string, hour: number) => values.get(`${day}-${hour}`) ?? 0;
  const max = Math.max(0, ...data.map((d) => d.avgPatients));
  const step = max / HEAT_RAMP.length;
  const fmt = (value: number) => formatNumber(value, lang, value < 10 ? 1 : 0);
  const days = WEEKDAYS.filter((day) => hours.some((hour) => values.has(`${day}-${hour}`)));

  return (
    <ChartCard
      title={t('dashboard.charts.heatmap')}
      description={t('dashboard.charts.heatmapHint')}
      table={
        <SimpleTable
          caption={t('dashboard.charts.heatmap')}
          headers={[t('dashboard.table.day'), ...hours.map((h) => hourLabel(h, lang))]}
          rows={days.map((day) => [t(`common:weekdaysShort.${day}`), ...hours.map((hour) => fmt(valueAt(day, hour)))])}
        />
      }
    >
      {days.length === 0 ? (
        <p className="py-8 text-center text-sm text-fg-muted">{t('dashboard.noData')}</p>
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto scrollbar-thin">
            <div
              className="grid min-w-[34rem] gap-0.5"
              style={{ gridTemplateColumns: `3.5rem repeat(${hours.length}, minmax(2rem, 1fr))` }}
            >
              <span aria-hidden />
              {hours.map((hour) => (
                <span key={hour} aria-hidden className="pb-1 text-center text-xs text-fg-subtle">
                  {hourLabel(hour, lang)}
                </span>
              ))}
              {days.map((day) => {
                const dayName = t(`common:weekdays.${day}`);
                return (
                  <Fragment key={day}>
                    <span aria-hidden className="flex items-center text-xs font-medium text-fg-muted">
                      {t(`common:weekdaysShort.${day}`)}
                    </span>
                    {hours.map((hour) => {
                      const value = valueAt(day, hour);
                      const level = heatStep(value, max);
                      const label = t('dashboard.charts.heatCell', {
                        day: dayName,
                        hour: hourLabel(hour, lang),
                        value: fmt(value),
                      });
                      return (
                        <div
                          key={`${day}-${hour}`}
                          title={label}
                          className="flex h-9 items-center justify-center rounded text-xs font-medium tabular"
                          style={{
                            background: HEAT_RAMP[level],
                            color: level >= HEAT_DARK_FROM ? '#FFFFFF' : '#0F172A',
                          }}
                        >
                          <span aria-hidden>{Math.round(value)}</span>
                          <span className="sr-only">{label}</span>
                        </div>
                      );
                    })}
                  </Fragment>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-fg-muted">
            <span className="font-medium">{t('dashboard.charts.heatLegend')}</span>
            <ul className="flex flex-wrap items-center gap-3">
              {HEAT_RAMP.map((colour, i) => (
                <li key={colour} className="flex items-center gap-1.5">
                  <span aria-hidden className="h-3.5 w-5 rounded-sm border" style={{ background: colour }} />
                  <span className="tabular">
                    {i === HEAT_RAMP.length - 1
                      ? t('dashboard.charts.heatAbove', { value: fmt(step * i) })
                      : t('dashboard.charts.heatRange', { from: fmt(step * i), to: fmt(step * (i + 1)) })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </ChartCard>
  );
}

// ---------------------------------------------------------------- (d) Tamil / English split

export function LanguageSplit({ data, lang }: { data: { lang: Lang; count: number }[]; lang: Lang }) {
  const { t } = useTranslation(['admin', 'common']);
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const rows = data.map((d) => ({ ...d, share: total ? d.count / total : 0, name: t(`common:language.${d.lang}`) }));
  return (
    <ChartCard
      title={t('dashboard.charts.language')}
      description={t('dashboard.charts.languageHint')}
      table={
        <SimpleTable
          caption={t('dashboard.charts.language')}
          headers={[t('dashboard.table.language'), t('dashboard.table.conversations'), t('dashboard.table.share')]}
          rows={rows.map((r) => [r.name, formatNumber(r.count, lang), formatPercent(r.share, lang)])}
        />
      }
    >
      {total === 0 ? (
        <p className="py-8 text-center text-sm text-fg-muted">{t('dashboard.noData')}</p>
      ) : (
        <ul className="space-y-4 py-2">
          {rows.map((r) => (
            <li key={r.lang} className="space-y-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span lang={r.lang} className="font-semibold text-fg">
                  {r.name}
                </span>
                <span className="tabular text-fg-muted">
                  <span className="font-semibold text-fg">{formatPercent(r.share, lang)}</span>
                  {' · '}
                  {t('dashboard.charts.conversations', { count: r.count, value: formatNumber(r.count, lang) })}
                </span>
              </div>
              <div aria-hidden className="h-3 overflow-hidden rounded-full bg-surface-sunken">
                <div className="h-full rounded-full bg-primary" style={{ width: `${r.share * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}
