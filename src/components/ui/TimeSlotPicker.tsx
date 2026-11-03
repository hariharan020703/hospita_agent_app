// Slot grid grouped into morning / afternoon / evening. Each group is a radiogroup; unavailable slots are disabled.
import { useTranslation } from 'react-i18next';
import { Moon, Sun, Sunrise } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/format';
import { partOfDay, type Slot } from '@/features/appointments/availability';
import type { Lang } from '@/types';
import { EmptyState } from './States';

const PARTS = [
  { id: 'morning', icon: Sunrise },
  { id: 'afternoon', icon: Sun },
  { id: 'evening', icon: Moon },
] as const;

export function TimeSlotPicker({
  slots,
  value,
  onChange,
  showUnavailable = true,
  size = 'md',
}: {
  slots: readonly Slot[];
  value: string | null;
  onChange: (start: string) => void;
  showUnavailable?: boolean;
  size?: 'md' | 'lg';
}) {
  const { t, i18n } = useTranslation();
  const lang: Lang = i18n.language === 'ta' ? 'ta' : 'en';
  const shown = showUnavailable
    ? slots.filter((s) => s.status !== 'past')
    : slots.filter((s) => s.status === 'available');
  if (shown.length === 0 || !shown.some((s) => s.status === 'available')) {
    return <EmptyState title={t('slots.none')} className="py-8" />;
  }
  return (
    <div className="space-y-5">
      {PARTS.map(({ id, icon: Icon }) => {
        const group = shown.filter((s) => partOfDay(s.start) === id);
        if (group.length === 0) return null;
        const headingId = `slots-${id}`;
        return (
          <section key={id} aria-labelledby={headingId}>
            <h3 id={headingId} className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg-muted">
              <Icon aria-hidden className="h-4 w-4" />
              {t(`slots.${id}`)}
            </h3>
            <div
              role="radiogroup"
              aria-labelledby={headingId}
              className={cn(
                'grid gap-2',
                size === 'lg' ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-3 xs:grid-cols-4 sm:grid-cols-5',
              )}
            >
              {group.map((slot) => {
                const available = slot.status === 'available';
                const selected = slot.start === value;
                const time = formatTime(slot.start, lang);
                return (
                  <button
                    key={slot.start}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={t('slots.slotLabel', {
                      time,
                      status: t(
                        available ? 'slots.available' : slot.status === 'booked' ? 'slots.booked' : 'slots.unavailable',
                      ),
                    })}
                    disabled={!available}
                    onClick={() => onChange(slot.start)}
                    className={cn(
                      'rounded-lg border text-sm font-semibold tabular transition-colors',
                      size === 'lg' ? 'min-h-16 text-lg' : 'min-h-11',
                      selected && 'border-primary bg-primary text-primary-fg',
                      !selected &&
                        available &&
                        'border-border-strong bg-surface text-fg hover:border-primary hover:bg-primary-soft',
                      !available && 'cursor-not-allowed border-dashed bg-surface-muted text-fg-subtle line-through',
                    )}
                  >
                    {time}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
