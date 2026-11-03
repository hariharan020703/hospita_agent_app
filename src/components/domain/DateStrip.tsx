import { useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { formatDate, formatWeekday } from '@/lib/format';
import { useLocale } from '@/hooks/useLocale';

/** Horizontal row of upcoming days (radio group with arrow keys). */
export function DateStrip({
  dates,
  value,
  onChange,
  today,
  label,
  isClosed,
}: {
  dates: readonly string[];
  value: string | null;
  onChange: (date: string) => void;
  today: string;
  label: string;
  isClosed?: (date: string) => boolean;
}) {
  const { t } = useTranslation();
  const { lang } = useLocale();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = Math.min(dates.length - 1, Math.max(0, index + delta));
    refs.current[next]?.focus();
  };
  const selectedIndex = Math.max(
    0,
    dates.findIndex((d) => d === value),
  );
  return (
    <div role="radiogroup" aria-label={label} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 scrollbar-thin">
      {dates.map((date, index) => {
        const selected = date === value;
        const closed = isClosed?.(date) ?? false;
        const dayLabel = date === today ? t('dates.today') : formatWeekday(date, lang);
        return (
          <button
            key={date}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={formatDate(date, lang, 'long')}
            tabIndex={index === selectedIndex ? 0 : -1}
            disabled={closed}
            onClick={() => onChange(date)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn(
              'flex min-h-16 min-w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-xl border px-2 py-2 transition-colors',
              selected
                ? 'border-primary bg-primary text-primary-fg'
                : 'border-border-strong bg-surface hover:border-primary',
              closed && 'cursor-not-allowed opacity-40',
            )}
          >
            <span className={cn('text-xs font-medium', selected ? 'text-primary-fg' : 'text-fg-muted')}>
              {dayLabel}
            </span>
            <span className="text-lg font-bold tabular">{Number(date.slice(8))}</span>
          </button>
        );
      })}
    </div>
  );
}
