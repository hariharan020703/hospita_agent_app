import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { controlClasses } from './Field';

export function SearchInput({
  value,
  onChange,
  label,
  placeholder,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Accessible label (visually hidden). */
  label: string;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className={cn('relative', className)} role="search">
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
      />
      <input
        type="search"
        aria-label={label}
        value={value}
        placeholder={placeholder ?? label}
        onChange={(e) => onChange(e.target.value)}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- used only where search is the screen's primary task
        autoFocus={autoFocus}
        className={controlClasses('pl-9 pr-10 [&::-webkit-search-cancel-button]:hidden')}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={t('actions.clear')}
          className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-fg-subtle hover:bg-surface-sunken hover:text-fg"
        >
          <X aria-hidden className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
