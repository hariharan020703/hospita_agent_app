import { forwardRef, type ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'dangerOutline';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-fg hover:bg-primary-hover shadow-xs',
  secondary: 'bg-primary-soft text-primary-ink hover:bg-primary-soft/70',
  outline: 'border border-border-strong bg-surface text-fg hover:bg-surface-sunken',
  ghost: 'text-fg-muted hover:bg-surface-sunken hover:text-fg',
  danger: 'bg-danger text-white hover:bg-danger-hover shadow-xs',
  dangerOutline: 'border border-danger/40 bg-surface text-danger-ink hover:bg-danger-soft',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-sm gap-1.5 rounded-lg',
  md: 'min-h-11 px-4 text-sm gap-2 rounded-lg',
  lg: 'min-h-12 px-5 text-base gap-2 rounded-xl',
  xl: 'min-h-16 px-8 text-xl gap-3 rounded-2xl',
};

const ICON_SIZES: Record<ButtonSize, string> = { sm: 'h-4 w-4', md: 'h-4 w-4', lg: 'h-5 w-5', xl: 'h-7 w-7' };

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', block = false): string {
  return cn(
    'inline-flex select-none items-center justify-center font-semibold leading-snug transition-colors',
    'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    block && 'w-full',
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    block,
    loading,
    icon: Icon,
    iconRight: IconRight,
    className,
    children,
    disabled,
    type,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonClasses(variant, size, block), className)}
      {...rest}
    >
      {loading ? (
        <Spinner className={ICON_SIZES[size]} />
      ) : (
        Icon && <Icon aria-hidden className={cn('shrink-0', ICON_SIZES[size])} />
      )}
      {children}
      {IconRight && !loading && <IconRight aria-hidden className={cn('shrink-0', ICON_SIZES[size])} />}
    </button>
  );
});
