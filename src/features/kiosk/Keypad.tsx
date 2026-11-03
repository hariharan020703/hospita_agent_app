// On-screen keypads so the kiosk never needs a physical keyboard. Physical keys still work (handy for staff),
// except while a text field has focus.
import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Delete } from 'lucide-react';
import { cn } from '@/lib/cn';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

function KeyButton({
  children,
  onPress,
  label,
  className,
}: {
  children: ReactNode;
  onPress: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={label}
      className={cn(
        'grid min-h-14 min-w-16 select-none place-items-center rounded-2xl border-2 border-border-strong bg-surface',
        'text-xl font-bold text-fg shadow-xs transition-colors hover:bg-surface-sunken active:bg-primary-soft',
        className,
      )}
    >
      {children}
    </button>
  );
}

function usePhysicalKeys(allowed: string, onKey: (key: string) => void, onBackspace: () => void) {
  const handlers = useRef({ onKey, onBackspace });
  useEffect(() => {
    handlers.current = { onKey, onBackspace };
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'Backspace') {
        event.preventDefault();
        handlers.current.onBackspace();
        return;
      }
      const key = event.key.toUpperCase();
      if (key.length === 1 && allowed.includes(key)) {
        event.preventDefault();
        handlers.current.onKey(key);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [allowed]);
}

interface KeypadProps {
  /** Accessible name of the keypad, e.g. "Keypad for the mobile number". */
  label: string;
  onBackspace: () => void;
  onClear: () => void;
  className?: string;
}

/** Telephone-style 3×4 keypad: digits, Clear and Delete. */
export function NumericKeypad({
  label,
  onDigit,
  onBackspace,
  onClear,
  className,
}: KeypadProps & { onDigit: (d: string) => void }) {
  const { t } = useTranslation(['kiosk', 'common']);
  usePhysicalKeys('0123456789', onDigit, onBackspace);
  return (
    <div role="group" aria-label={label} className={cn('grid grid-cols-3 gap-3', className)}>
      {DIGITS.map((d) => (
        <KeyButton key={d} onPress={() => onDigit(d)}>
          {d}
        </KeyButton>
      ))}
      <KeyButton onPress={onClear} label={t('keypad.clear')} className="text-base text-fg-muted">
        {t('common:actions.clear')}
      </KeyButton>
      <KeyButton onPress={() => onDigit('0')}>0</KeyButton>
      <KeyButton onPress={onBackspace} label={t('keypad.backspace')}>
        <Delete aria-hidden className="h-9 w-9" />
      </KeyButton>
    </div>
  );
}

/** Letters and digits for booking IDs. Only the characters used in IDs are offered (no 0/O or 1/I mix-ups). */
export function CodeKeypad({
  label,
  chars,
  onChar,
  onBackspace,
  onClear,
  className,
}: KeypadProps & { chars: string; onChar: (c: string) => void }) {
  const { t } = useTranslation(['kiosk', 'common']);
  usePhysicalKeys(chars, onChar, onBackspace);
  return (
    <div role="group" aria-label={label} className={cn('space-y-3', className)}>
      <div className="grid grid-cols-8 gap-3">
        {Array.from(chars).map((c) => (
          <KeyButton key={c} onPress={() => onChar(c)} className="font-mono">
            {c}
          </KeyButton>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <KeyButton onPress={onClear} label={t('keypad.clear')} className="text-base text-fg-muted">
          {t('common:actions.clear')}
        </KeyButton>
        <KeyButton onPress={onBackspace} label={t('keypad.backspace')}>
          <Delete aria-hidden className="h-9 w-9" />
        </KeyButton>
      </div>
    </div>
  );
}
