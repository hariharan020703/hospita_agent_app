import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Inbox, RotateCcw, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { errorCodeOf } from '@/services/errors';
import { Button } from './Button';

export function EmptyState({
  icon: Icon = Inbox,
  title,
  body,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-xl border border-dashed bg-surface px-6 py-10 text-center',
        className,
      )}
    >
      <span className="grid h-12 w-12 place-items-center rounded-full bg-surface-sunken text-fg-subtle">
        <Icon aria-hidden className="h-6 w-6" />
      </span>
      <div className="max-w-md space-y-1">
        <p className="font-semibold text-fg">{title}</p>
        {body && <p className="text-sm text-fg-muted">{body}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title,
  className,
}: {
  error?: unknown;
  onRetry?: () => void;
  title?: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  const code = error === undefined ? null : errorCodeOf(error);
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft/40 px-6 py-8 text-center',
        className,
      )}
    >
      <AlertTriangle aria-hidden className="h-7 w-7 text-warning-ink" />
      <div className="max-w-md space-y-1">
        <p className="font-semibold text-fg">{title ?? t('states.errorTitle')}</p>
        <p className="text-sm text-fg-muted">
          {code && code !== 'UNKNOWN' ? t(`errors.${code}`) : t('states.errorBody')}
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" icon={RotateCcw} onClick={onRetry}>
          {t('actions.retry')}
        </Button>
      )}
    </div>
  );
}
