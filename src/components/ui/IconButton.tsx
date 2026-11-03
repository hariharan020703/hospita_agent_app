import { forwardRef, type ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: LucideIcon;
  /** Accessible name; required because the button shows only an icon. */
  label: string;
  variant?: 'ghost' | 'outline' | 'primary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  badge?: number;
}

const VARIANTS = {
  ghost: 'text-fg-muted hover:bg-surface-sunken hover:text-fg',
  outline: 'border border-border-strong bg-surface text-fg hover:bg-surface-sunken',
  primary: 'bg-primary text-primary-fg hover:bg-primary-hover',
  danger: 'bg-danger text-white hover:bg-danger-hover',
};
const SIZES = { sm: 'h-9 w-9', md: 'h-11 w-11', lg: 'h-14 w-14' };
const ICONS = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-6 w-6' };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, variant = 'ghost', size = 'md', badge, className, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      aria-label={label}
      title={label}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      <Icon aria-hidden className={ICONS[size]} />
      {badge !== undefined && badge > 0 && (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold leading-none text-primary-fg ring-2 ring-surface"
        >
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
});
