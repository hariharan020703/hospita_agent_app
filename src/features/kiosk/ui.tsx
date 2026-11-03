// Small building blocks shared by the kiosk screens: large touch-friendly text and controls.
import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Info, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';

/** Screen heading. Takes focus when the screen appears so screen-reader users hear where they are. */
export function ScreenTitle({
  children,
  className,
  focusOnMount = true,
  id,
}: {
  children: ReactNode;
  className?: string;
  focusOnMount?: boolean;
  id?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnMount) ref.current?.focus({ preventScroll: true });
  }, [focusOnMount]);
  return (
    <h1
      ref={ref}
      id={id}
      tabIndex={-1}
      className={cn('text-balance text-2xl font-bold leading-tight text-fg focus:outline-none', className)}
    >
      {children}
    </h1>
  );
}

const NOTICE_TONES = {
  info: 'border-info/30 bg-info-soft text-info-ink',
  warning: 'border-warning/40 bg-warning-soft text-warning-ink',
  success: 'border-success/30 bg-success-soft text-success-ink',
} as const;

/** Highlighted message. Warnings and errors are amber: red is reserved for emergencies. */
export function Notice({
  tone = 'info',
  icon: Icon = Info,
  role,
  children,
  className,
}: {
  tone?: keyof typeof NOTICE_TONES;
  icon?: LucideIcon;
  role?: 'status' | 'alert';
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={role}
      className={cn('flex items-start gap-3 rounded-2xl border-2 px-5 py-4 text-base', NOTICE_TONES[tone], className)}
    >
      <Icon aria-hidden className="mt-1 h-7 w-7 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">{children}</div>
    </div>
  );
}

export function BackButton({ onClick, label }: { onClick: () => void; label?: string }) {
  const { t } = useTranslation();
  return (
    <Button variant="outline" size="lg" icon={ArrowLeft} onClick={onClick}>
      {label ?? t('actions.back')}
    </Button>
  );
}

export interface Fact {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  /** Smaller second line, e.g. the floor and wing under a department name. */
  detail?: string | undefined;
  /** Announce changes politely (live queue numbers). */
  live?: boolean;
}

/** Label/value tiles for a visit: department, doctor, room, expected time, patients ahead. */
export function FactList({ facts, className }: { facts: Fact[]; className?: string }) {
  return (
    <dl className={cn('grid gap-4 sm:grid-cols-2', className)}>
      {facts.map(({ icon: Icon, label, value, detail, live }) => (
        <div key={label} className="rounded-2xl border bg-surface-muted px-5 py-4">
          <dt className="flex items-center gap-2 text-lg text-fg-muted">
            <Icon aria-hidden className="h-6 w-6 shrink-0" />
            {label}
          </dt>
          <dd className="mt-1 text-lg font-bold text-fg" aria-live={live ? 'polite' : undefined}>
            {value}
            {detail && <span className="block text-lg font-normal text-fg-muted">{detail}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
