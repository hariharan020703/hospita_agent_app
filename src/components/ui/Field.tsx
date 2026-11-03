import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
}

/** Turns a validation message key ("required", "tooShort:2") into translated text. */
export function useValidationMessage() {
  const { t } = useTranslation('validation');
  return (message: string | undefined): string | undefined => {
    if (!message) return undefined;
    const [key = 'invalid', count] = message.split(':');
    const translated = t(key as 'invalid', { count: count ? Number(count) : 0, defaultValue: '' });
    return translated || t('invalid');
  };
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-sm font-medium text-warning-ink">
      <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function Field({
  label,
  hint,
  error,
  required,
  className,
  labelClassName,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  /** Validation message key from zod/react-hook-form; translated here. */
  error?: string | undefined;
  required?: boolean;
  className?: string;
  labelClassName?: string;
  children: (control: FieldControlProps) => ReactNode;
}) {
  const id = useId();
  const { t } = useTranslation();
  const translate = useValidationMessage();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className={cn('block text-sm font-medium text-fg', labelClassName)}>
        {label}
        {required && (
          <span aria-hidden className="ml-0.5 text-fg-subtle">
            *
          </span>
        )}
        {required && <span className="sr-only"> ({t('a11y.required')})</span>}
      </label>
      {children({
        id,
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
        ...(error ? { 'aria-invalid': true } : {}),
        ...(required ? { 'aria-required': true } : {}),
      })}
      {hint && (
        <p id={hintId} className="text-sm text-fg-subtle">
          {hint}
        </p>
      )}
      {error && <FieldError id={errorId}>{translate(error)}</FieldError>}
    </div>
  );
}

export const controlClasses = (extra?: string) =>
  cn(
    'block w-full min-h-11 rounded-lg border border-border-strong bg-surface px-3 py-2 text-base text-fg shadow-xs sm:text-sm',
    'placeholder:text-fg-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30',
    'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-fg-subtle',
    'aria-[invalid=true]:border-warning aria-[invalid=true]:ring-warning/20',
    extra,
  );
