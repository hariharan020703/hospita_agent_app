import { cn } from '@/lib/cn';

/** MediFlow mark: a teal rounded square with a cross formed by two flowing strokes. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('h-8 w-8 shrink-0', className)}>
      <rect width="32" height="32" rx="8" fill="#0E7C86" />
      <path d="M16 7v18M7 16h18" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <circle cx="16" cy="16" r="3" fill="#0E7C86" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

export function Logo({ className, subtitle }: { className?: string; subtitle?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark />
      <span className="flex flex-col leading-tight">
        <span className="text-base font-bold tracking-tight text-fg">MediFlow</span>
        {subtitle && <span className="text-xs text-fg-subtle">{subtitle}</span>}
      </span>
    </span>
  );
}
