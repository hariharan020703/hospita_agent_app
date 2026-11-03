// Weekly opening-hours editor: per weekday, any number of time ranges with add/remove. Used for doctor schedules
// and hospital OPD hours. Validation (start < end, no overlaps) is computed by the caller with `validateWeekly`.
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button, FieldError, IconButton, Input, useValidationMessage } from '@/components/ui';
import { fromMinutes, toMinutes } from '@/lib/time';
import { WEEKDAYS, type TimeRange, type Weekday, type WeeklyHours } from '@/types';
import type { RangeIssue, WeeklyIssues } from '../lib';

export function WeeklyHoursEditor({
  value,
  onChange,
  issues,
  label,
}: {
  value: WeeklyHours;
  onChange: (value: WeeklyHours) => void;
  issues: WeeklyIssues;
  label: string;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const translate = useValidationMessage();
  const baseId = useId();
  const issueText = (issue: RangeIssue) => (issue === 'overlap' ? t('hours.overlap') : translate(issue));

  const setDay = (day: Weekday, ranges: TimeRange[]) => onChange({ ...value, [day]: ranges });
  const setRange = (day: Weekday, index: number, patch: Partial<TimeRange>) =>
    setDay(
      day,
      value[day].map((range, i) => (i === index ? { ...range, ...patch } : range)),
    );
  const addRange = (day: Weekday) => {
    const ranges = value[day];
    const last = ranges[ranges.length - 1];
    const start = last ? last.end : '09:00';
    const end = fromMinutes(Math.min(toMinutes(start) + 120, 23 * 60 + 59));
    setDay(day, [...ranges, { start, end }]);
  };

  return (
    <div role="group" aria-label={label} className="divide-y rounded-xl border bg-surface">
      {WEEKDAYS.map((day) => {
        const dayName = t(`common:weekdays.${day}`);
        const ranges = value[day];
        return (
          <fieldset key={day} className="grid gap-2 px-4 py-3 sm:grid-cols-[9rem_1fr] sm:items-start">
            <legend className="sr-only">{dayName}</legend>
            <p aria-hidden className="pt-2 text-sm font-semibold text-fg">
              {dayName}
            </p>
            <div className="space-y-2">
              {ranges.length === 0 && <p className="pt-2 text-sm text-fg-muted">{t('hours.closed')}</p>}
              {ranges.map((range, index) => {
                const issue = issues[day]?.[index];
                const errorId = `${baseId}-${day}-${index}`;
                const n = index + 1;
                const invalid = issue ? { 'aria-invalid': true, 'aria-describedby': errorId } : {};
                return (
                  <div key={index} className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        type="time"
                        step={300}
                        value={range.start}
                        aria-label={t('hours.start', { day: dayName, n })}
                        {...invalid}
                        onChange={(e) => setRange(day, index, { start: e.target.value })}
                        className="w-36"
                      />
                      <span aria-hidden className="text-fg-subtle">
                        –
                      </span>
                      <Input
                        type="time"
                        step={300}
                        value={range.end}
                        aria-label={t('hours.end', { day: dayName, n })}
                        {...invalid}
                        onChange={(e) => setRange(day, index, { end: e.target.value })}
                        className="w-36"
                      />
                      <IconButton
                        icon={Trash2}
                        size="sm"
                        label={t('hours.remove', { day: dayName, n })}
                        onClick={() =>
                          setDay(
                            day,
                            ranges.filter((_, i) => i !== index),
                          )
                        }
                      />
                    </div>
                    {issue && <FieldError id={errorId}>{issueText(issue)}</FieldError>}
                  </div>
                );
              })}
              <Button
                variant="ghost"
                size="sm"
                icon={Plus}
                onClick={() => addRange(day)}
                aria-label={t('hours.addFor', { day: dayName })}
              >
                {t('hours.add')}
              </Button>
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
