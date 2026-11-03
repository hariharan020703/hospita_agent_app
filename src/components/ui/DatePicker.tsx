// Month calendar (role="grid", arrow keys, Page Up/Down for months) and a date picker button that opens it.
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { addDays, addMonths, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatDate, formatMonthYear, formatWeekday } from '@/lib/format';
import { addDaysIso, parseIsoDate, toIsoDate } from '@/lib/time';
import type { Lang } from '@/types';
import { controlClasses, type FieldControlProps } from './Field';
import { IconButton } from './IconButton';

export function Calendar({
  value,
  onChange,
  min,
  max,
  isDisabled,
}: {
  value: string | null;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  isDisabled?: (iso: string) => boolean;
}) {
  const { t, i18n } = useTranslation();
  const lang: Lang = i18n.language === 'ta' ? 'ta' : 'en';
  const [focused, setFocused] = useState(value ?? min ?? toIsoDate(new Date()));
  const [month, setMonth] = useState(() => startOfMonth(parseIsoDate(focused)));
  const gridRef = useRef<HTMLTableElement>(null);
  const labelId = useId();

  const weeks = useMemo(() => {
    const first = startOfWeek(month, { weekStartsOn: 1 });
    return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(first, w * 7 + d)));
  }, [month]);

  const disabled = (iso: string) =>
    (min !== undefined && iso < min) || (max !== undefined && iso > max) || Boolean(isDisabled?.(iso));

  const move = (iso: string) => {
    setFocused(iso);
    const date = parseIsoDate(iso);
    if (!isSameMonth(date, month)) setMonth(startOfMonth(date));
  };

  useEffect(() => {
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus({ preventScroll: true });
  }, [focused]);

  const onKeyDown = (event: KeyboardEvent) => {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key in steps) {
      event.preventDefault();
      move(addDaysIso(focused, steps[event.key] ?? 0));
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      move(toIsoDate(addMonths(parseIsoDate(focused), event.key === 'PageUp' ? -1 : 1)));
    } else if ((event.key === 'Enter' || event.key === ' ') && !disabled(focused)) {
      event.preventDefault();
      onChange(focused);
    }
  };

  return (
    <div className="w-[19rem] max-w-full">
      <div className="mb-2 flex items-center justify-between">
        <IconButton
          icon={ChevronLeft}
          size="sm"
          label={t('datePicker.previousMonth')}
          onClick={() => setMonth((m) => addMonths(m, -1))}
        />
        <p id={labelId} aria-live="polite" className="text-sm font-semibold text-fg">
          {formatMonthYear(month, lang)}
        </p>
        <IconButton
          icon={ChevronRight}
          size="sm"
          label={t('datePicker.nextMonth')}
          onClick={() => setMonth((m) => addMonths(m, 1))}
        />
      </div>
      <table
        ref={gridRef}
        role="grid"
        aria-labelledby={labelId}
        className="w-full border-collapse text-center"
        onKeyDown={onKeyDown}
      >
        <thead>
          <tr>
            {weeks[0]?.map((day) => (
              <th key={day.toISOString()} scope="col" className="pb-1 text-xs font-medium text-fg-subtle">
                {formatWeekday(toIsoDate(day), lang).slice(0, lang === 'ta' ? 4 : 2)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]?.toISOString()}>
              {week.map((day) => {
                const iso = toIsoDate(day);
                const off = !isSameMonth(day, month);
                const isSelected = iso === value;
                const isDisabled = disabled(iso);
                return (
                  <td key={iso} role="gridcell" aria-selected={isSelected} className="p-0.5">
                    <button
                      type="button"
                      data-date={iso}
                      tabIndex={iso === focused ? 0 : -1}
                      aria-disabled={isDisabled || undefined}
                      aria-label={formatDate(iso, lang, 'long')}
                      onClick={() => !isDisabled && onChange(iso)}
                      onFocus={() => setFocused(iso)}
                      className={cn(
                        'h-9 w-9 rounded-lg text-sm tabular transition-colors',
                        off && 'text-fg-subtle/60',
                        isSelected ? 'bg-primary font-semibold text-primary-fg' : 'hover:bg-surface-sunken',
                        isDisabled && 'cursor-not-allowed text-fg-subtle/40 line-through hover:bg-transparent',
                      )}
                    >
                      {day.getDate()}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  isDisabled,
  control,
  placeholder,
}: {
  value: string | null;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  isDisabled?: (iso: string) => boolean;
  control?: FieldControlProps;
  placeholder?: string;
}) {
  const { t, i18n } = useTranslation();
  const lang: Lang = i18n.language === 'ta' ? 'ta' : 'en';
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapper} className="relative">
      <button
        ref={button}
        type="button"
        {...control}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={controlClasses('flex items-center justify-between gap-2 text-left')}
      >
        <span className={cn(!value && 'text-fg-subtle')}>
          {value ? formatDate(value, lang, 'medium') : (placeholder ?? t('datePicker.choose'))}
        </span>
        <CalendarDays aria-hidden className="h-4 w-4 text-fg-subtle" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={t('datePicker.choose')}
          className="absolute z-40 mt-1 rounded-xl border bg-surface p-3 shadow-lg"
        >
          <Calendar
            value={value}
            min={min}
            max={max}
            isDisabled={isDisabled}
            onChange={(iso) => {
              onChange(iso);
              setOpen(false);
              button.current?.focus();
            }}
          />
        </div>
      )}
    </div>
  );
}
