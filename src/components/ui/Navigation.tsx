// Stepper, breadcrumbs, page header, sidebar and top bar.
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Stepper({ steps, current, label }: { steps: readonly string[]; current: number; label: string }) {
  return (
    <ol aria-label={label} className="flex items-center gap-2">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step} aria-current={active ? 'step' : undefined} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={cn(
                'grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold',
                done && 'bg-primary text-primary-fg',
                active && 'bg-primary-soft text-primary-ink ring-2 ring-primary',
                !done && !active && 'bg-surface-sunken text-fg-subtle',
              )}
            >
              {done ? <Check aria-hidden className="h-4 w-4" /> : index + 1}
            </span>
            <span
              className={cn('hidden truncate text-sm sm:block', active ? 'font-semibold text-fg' : 'text-fg-muted')}
            >
              {step}
            </span>
            {index < steps.length - 1 && <span aria-hidden className="h-px min-w-4 flex-1 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

export interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('a11y.breadcrumb')}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-fg-muted">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {item.to && !last ? (
                <Link to={item.to} className="rounded hover:text-fg hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} className={cn(last && 'font-medium text-fg')}>
                  {item.label}
                </span>
              )}
              {!last && <ChevronRight aria-hidden className="h-3.5 w-3.5" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: readonly Crumb[];
  className?: string;
}) {
  return (
    <header className={cn('mb-6 space-y-2', className)}>
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-fg">{title}</h1>
          {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: number;
}

export function Sidebar({
  items,
  header,
  footer,
  onNavigate,
}: {
  items: readonly NavItem[];
  header?: ReactNode;
  footer?: ReactNode;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col gap-4 bg-surface p-3">
      {header && <div className="px-2 pt-1">{header}</div>}
      <nav aria-label={t('a11y.mainNav')} className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <ul className="space-y-0.5">
          {items.map(({ to, label, icon: Icon, end, badge }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-soft text-primary-ink'
                      : 'text-fg-muted hover:bg-surface-sunken hover:text-fg',
                  )
                }
              >
                <Icon aria-hidden className="h-5 w-5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {badge !== undefined && badge > 0 && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-fg">{badge}</span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {footer}
    </div>
  );
}

export function Topbar({ start, end, className }: { start?: ReactNode; end?: ReactNode; className?: string }) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b bg-surface/95 px-4 backdrop-blur sm:px-6',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">{start}</div>
      <div className="flex items-center gap-1 sm:gap-2">{end}</div>
    </header>
  );
}
