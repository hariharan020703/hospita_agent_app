// Searchable single select following the WAI-ARIA combobox pattern (input + listbox, aria-activedescendant).
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { controlClasses, type FieldControlProps } from './Field';

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  keywords?: string;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder,
  emptyText,
  control,
  renderOption,
}: {
  options: readonly ComboboxOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText: string;
  /** Props from <Field> (id, aria-describedby, aria-invalid). */
  control?: FieldControlProps;
  renderOption?: (option: ComboboxOption) => ReactNode;
}) {
  const listId = useId();
  const autoId = useId();
  const inputId = control?.id ?? autoId;
  const selected = options.find((o) => o.value === value) ?? null;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapper = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.description ?? ''} ${o.keywords ?? ''}`.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const choose = (option: ComboboxOption) => {
    onChange(option.value);
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) setOpen(true);
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (filtered.length ? (i + delta + filtered.length) % filtered.length : 0));
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      const option = filtered[active];
      if (option) choose(option);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  const activeOption = open ? filtered[active] : undefined;

  return (
    <div ref={wrapper} className="relative">
      <input
        {...control}
        id={inputId}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeOption ? `${listId}-${activeOption.value}` : undefined}
        autoComplete="off"
        value={open ? query : (selected?.label ?? '')}
        placeholder={selected?.label ?? placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={controlClasses('pr-9')}
      />
      <ChevronsUpDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border bg-surface p-1 shadow-lg scrollbar-thin"
        >
          {filtered.length === 0 && <li className="px-3 py-2 text-sm text-fg-subtle">{emptyText}</li>}
          {filtered.map((option, index) => {
            const isSelected = option.value === value;
            return (
              // Keyboard selection happens on the input (arrow keys + Enter), per the ARIA combobox pattern.
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events
              <li
                key={option.value}
                id={`${listId}-${option.value}`}
                role="option"
                aria-selected={isSelected}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choose(option)}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  'flex cursor-pointer items-start gap-2 rounded-md px-3 py-2 text-sm',
                  index === active && 'bg-surface-sunken',
                )}
              >
                <Check
                  aria-hidden
                  className={cn('mt-0.5 h-4 w-4 shrink-0 text-primary-ink', !isSelected && 'invisible')}
                />
                <span className="min-w-0">
                  {renderOption ? (
                    renderOption(option)
                  ) : (
                    <>
                      <span className="block font-medium text-fg">{option.label}</span>
                      {option.description && <span className="block text-fg-subtle">{option.description}</span>}
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
