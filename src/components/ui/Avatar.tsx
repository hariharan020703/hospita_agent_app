import { cn } from '@/lib/cn';

export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter((part) => part && !/^dr\.?$/i.test(part))
    .slice(0, 2)
    .map((part) => [...part][0]?.toUpperCase() ?? '')
    .join('');

const SIZES = { sm: 'h-8 w-8 text-xs', md: 'h-11 w-11 text-sm', lg: 'h-16 w-16 text-lg', xl: 'h-24 w-24 text-2xl' };

/** Photo when available, otherwise initials. Decorative by default (the name is shown next to it). */
export function Avatar({
  name,
  src,
  size = 'md',
  className,
  alt,
}: {
  name: string;
  src?: string | undefined;
  size?: keyof typeof SIZES;
  className?: string;
  alt?: string;
}) {
  const classes = cn('shrink-0 rounded-full object-cover', SIZES[size], className);
  if (src) return <img src={src} alt={alt ?? ''} className={classes} />;
  return (
    <span
      aria-hidden={alt ? undefined : true}
      aria-label={alt}
      role={alt ? 'img' : undefined}
      className={cn(classes, 'grid place-items-center bg-primary-soft font-semibold text-primary-ink')}
    >
      {initials(name)}
    </span>
  );
}
