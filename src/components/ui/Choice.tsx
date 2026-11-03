// Checkbox, radio group, switch and segmented control.
import { forwardRef, useId, useRef, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { FieldError, useValidationMessage } from './Field';

export const Checkbox = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
    label: ReactNode;
    description?: ReactNode;
    error?: string | undefined;
  }
>(function Checkbox({ label, description, error, className, id, ...rest }, ref) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const translate = useValidationMessage();
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={inputId} className="flex cursor-pointer items-start gap-3">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-border-strong accent-[rgb(var(--color-primary))]"
          {...rest}
        />
        <span className="min-w-0 text-sm">
          <span className="font-medium text-fg">{label}</span>
          {description && <span className="mt-0.5 block text-fg-muted">{description}</span>}
        </span>
      </label>
      {error && <FieldError id={errorId}>{translate(error)}</FieldError>}
    </div>
  );
});

export interface ChoiceOption<T extends string> {
  value: T;
  label: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  disabled?: boolean;
}

export function RadioGroup<T extends string>({
  legend,
  name,
  value,
  onChange,
  options,
  error,
  layout = 'stack',
  legendHidden,
}: {
  legend: ReactNode;
  name: string;
  value: T | undefined;
  onChange: (value: T) => void;
  options: readonly ChoiceOption<T>[];
  error?: string | undefined;
  layout?: 'stack' | 'inline' | 'cards';
  legendHidden?: boolean;
}) {
  const translate = useValidationMessage();
  const errorId = useId();
  return (
    <fieldset aria-describedby={error ? errorId : undefined} className="space-y-2">
      <legend className={cn('text-sm font-medium text-fg', legendHidden && 'sr-only')}>{legend}</legend>
      <div
        className={cn(
          layout === 'stack' && 'space-y-2',
          layout === 'inline' && 'flex flex-wrap gap-2',
          layout === 'cards' && 'grid gap-2 sm:grid-cols-2',
        )}
      >
        {options.map((o) => {
          const checked = value === o.value;
          const Icon = o.icon;
          return (
            <label
              key={o.value}
              className={cn(
                'flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                checked
                  ? 'border-primary bg-primary-soft/60'
                  : 'border-border-strong bg-surface hover:bg-surface-sunken',
                o.disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                disabled={o.disabled}
                onChange={() => onChange(o.value)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--color-primary))]"
              />
              {Icon && <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-fg-muted" />}
              <span className="min-w-0">
                <span className="font-medium text-fg">{o.label}</span>
                {o.description && <span className="mt-0.5 block text-fg-muted">{o.description}</span>}
              </span>
            </label>
          );
        })}
      </div>
      {error && <FieldError id={errorId}>{translate(error)}</FieldError>}
    </fieldset>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="min-w-0 text-sm">
        <span id={`${id}-label`} className="font-medium text-fg">
          {label}
        </span>
        {description && (
          <span id={`${id}-desc`} className="mt-0.5 block text-fg-muted">
            {description}
          </span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
          checked ? 'bg-primary' : 'bg-border-strong',
        )}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </button>
    </div>
  );
}

/** Compact single choice (role="radiogroup") with arrow-key navigation. */
export function SegmentedControl<T extends string>({
  label,
  value,
  onChange,
  options,
  size = 'md',
  className,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly ChoiceOption<T>[];
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const delta =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + options.length) % options.length;
    const option = options[next];
    if (option && !option.disabled) {
      onChange(option.value);
      refs.current[next]?.focus();
    }
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-surface-sunken p-1', className)}
    >
      {options.map((o, i) => {
        const selected = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors',
              size === 'sm' && 'min-h-8 px-2.5 text-xs',
              size === 'md' && 'min-h-10 px-3 text-sm',
              size === 'lg' && 'min-h-16 px-6 text-lg',
              selected ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg',
            )}
          >
            {Icon && <Icon aria-hidden className="h-4 w-4" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
