// "Are you still there?" countdown shown before the kiosk resets itself. It sits above everything, including the
// emergency screen, and announces the countdown politely (at the start and at 5 seconds, not every second).
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Hand } from 'lucide-react';
import { Button } from '@/components/ui';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export function IdleDialog({
  secondsLeft,
  totalSeconds,
  onStay,
}: {
  secondsLeft: number;
  totalSeconds: number;
  onStay: () => void;
}) {
  const { t } = useTranslation('kiosk');
  const panelRef = useRef<HTMLDivElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);
  const [spoken, setSpoken] = useState('');
  useFocusTrap(panelRef, stayRef);

  useEffect(() => {
    if (secondsLeft === totalSeconds || secondsLeft === 5) setSpoken(t('idle.announce', { count: secondsLeft }));
  }, [secondsLeft, totalSeconds, t]);

  const progress = Math.max(0, Math.min(1, secondsLeft / totalSeconds));

  return createPortal(
    <div className="no-print fixed inset-0 z-[90] flex items-center justify-center p-6">
      <div aria-hidden className="absolute inset-0 animate-fade-in bg-black/60" />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="kiosk-idle-title"
        aria-describedby="kiosk-idle-body"
        tabIndex={-1}
        className="relative w-full max-w-2xl animate-slide-up space-y-4 rounded-3xl bg-surface p-5 text-center shadow-lg"
      >
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary-soft text-primary-ink">
          <Hand aria-hidden className="h-10 w-10" />
        </span>
        <h2 id="kiosk-idle-title" className="text-2xl font-bold text-fg">
          {t('idle.title')}
        </h2>
        <p id="kiosk-idle-body" className="text-balance text-lg text-fg-muted">
          {t('idle.body')}
        </p>
        <div aria-hidden className="space-y-3">
          <p className="text-5xl font-extrabold text-primary-ink tabular">{secondsLeft}</p>
          <div className="mx-auto h-3 max-w-md overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
        <p aria-live="polite" className="sr-only">
          {spoken}
        </p>
        <Button ref={stayRef} size="lg" block onClick={onStay}>
          {t('idle.stillHere')}
        </Button>
      </div>
    </div>,
    document.body,
  );
}
