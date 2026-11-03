// Same contract as the shared <Field>, plus `errorText` for messages that are not validation keys
// (duplicate registration number, overlapping hours, photo too large). Validation keys still go in `error`.
import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FieldError, useValidationMessage, type FieldControlProps } from '@/components/ui';
import { cn } from '@/lib/cn';

export function FormField({
  label,
  hint,
  error,
  errorText,
  required,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  /** Validation key ("required", "min:5"); translated here. */
  error?: string | undefined;
  /** Already-translated message; wins over `error`. */
  errorText?: string | null | undefined;
  required?: boolean;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}) {
  const id = useId();
  const { t } = useTranslation();
  const translate = useValidationMessage();
  const message = errorText || translate(error);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = message ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-fg">
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
        ...(message ? { 'aria-invalid': true } : {}),
        ...(required ? { 'aria-required': true } : {}),
      })}
      {hint && (
        <p id={hintId} className="text-sm text-fg-subtle">
          {hint}
        </p>
      )}
      {message && <FieldError id={errorId}>{message}</FieldError>}
    </div>
  );
}
