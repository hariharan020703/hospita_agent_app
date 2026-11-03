import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface MenuItem {
  id: string;
  label: ReactNode;
  icon?: LucideIcon;
  onSelect: () => void;
  tone?: 'default' | 'danger';
}

/** Button + role="menu" popup (arrow keys, Escape, click outside). */
export function DropdownMenu({
  trigger,
  label,
  items,
  header,
  align = 'right',
}: {
  trigger: ReactNode;
  label: string;
  items: readonly MenuItem[];
  header?: ReactNode;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  const onMenuKey = (event: KeyboardEvent) => {
    const list = itemRefs.current.filter((el): el is HTMLButtonElement => Boolean(el));
    const index = list.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      list[(index + delta + list.length) % list.length]?.focus();
    }
    if (event.key === 'Tab') setOpen(false);
  };

  return (
    <div ref={wrapper} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 items-center gap-2 rounded-lg px-2 hover:bg-surface-sunken"
      >
        {trigger}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          tabIndex={-1}
          onKeyDown={onMenuKey}
          className={cn(
            'absolute z-40 mt-1 w-60 rounded-xl border bg-surface p-1 shadow-lg',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {header && <div className="border-b px-3 py-2">{header}</div>}
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  'flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-surface-sunken focus:bg-surface-sunken focus:outline-none',
                  item.tone === 'danger' ? 'text-danger-ink' : 'text-fg',
                )}
              >
                {Icon && <Icon aria-hidden className="h-4 w-4 shrink-0" />}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
