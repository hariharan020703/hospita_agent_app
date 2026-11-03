// Small shared pieces of the admin screens: a plain data table (chart text alternatives) and a from/to date range.
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DatePicker, Field } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { DateRange } from '@/types';

/** Plain, accessible table. Columns from `numericFrom` onwards are right-aligned. */
export function SimpleTable({
  caption,
  headers,
  rows,
  numericFrom = 1,
}: {
  caption: string;
  headers: readonly string[];
  rows: readonly (readonly ReactNode[])[];
  numericFrom?: number;
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b text-left">
          {headers.map((header, i) => (
            <th
              key={header}
              scope="col"
              className={cn('px-2 py-1.5 font-semibold text-fg-muted', i >= numericFrom && 'text-right')}
            >
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r} className="border-b last:border-0">
            {row.map((cell, i) =>
              i === 0 ? (
                <th key={i} scope="row" className="px-2 py-1.5 text-left font-medium text-fg">
                  {cell}
                </th>
              ) : (
                <td key={i} className={cn('px-2 py-1.5 text-fg tabular', i >= numericFrom && 'text-right')}>
                  {cell}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Two date pickers; "from" can never pass "to". */
export function DateRangeFields({
  value,
  onChange,
  min,
  max,
  className,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  min?: string;
  max?: string;
  className?: string;
}) {
  const { t } = useTranslation('admin');
  const fromMax = max !== undefined && max < value.to ? max : value.to;
  const toMin = min !== undefined && min > value.from ? min : value.from;
  return (
    <div className={cn('grid gap-3 sm:grid-cols-2', className)}>
      <Field label={t('range.from')}>
        {(c) => (
          <DatePicker
            control={c}
            value={value.from}
            min={min}
            max={fromMax}
            onChange={(from) => onChange({ from, to: value.to < from ? from : value.to })}
          />
        )}
      </Field>
      <Field label={t('range.to')}>
        {(c) => (
          <DatePicker
            control={c}
            value={value.to}
            min={toMin}
            max={max}
            onChange={(to) => onChange({ from: value.from > to ? to : value.from, to })}
          />
        )}
      </Field>
    </div>
  );
}
