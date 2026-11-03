// Inactivity reset for the public kiosk. After `idleSeconds` without a touch, tap or key press a countdown starts;
// any activity (or "I'm still here") cancels it, otherwise `onReset` runs when it reaches zero.
import { useCallback, useEffect, useRef, useState } from 'react';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart'] as const;

export function useIdleReset({
  enabled,
  idleSeconds,
  countdownSeconds = 10,
  onReset,
}: {
  /** Off on the attract screen: there is nothing to reset. */
  enabled: boolean;
  idleSeconds: number;
  countdownSeconds?: number;
  onReset: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [armKey, setArmKey] = useState(0);
  const warningRef = useRef(false);
  const onResetRef = useRef(onReset);

  useEffect(() => {
    onResetRef.current = onReset;
  }, [onReset]);

  // Idle timer: restarts on every interaction. An interaction while the warning is open also dismisses it.
  useEffect(() => {
    if (!enabled) {
      warningRef.current = false;
      setSecondsLeft(null);
      return;
    }
    let timer: number | undefined;
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        warningRef.current = true;
        setSecondsLeft(countdownSeconds);
      }, idleSeconds * 1000);
    };
    const onActivity = () => {
      if (warningRef.current) {
        warningRef.current = false;
        setSecondsLeft(null);
      }
      arm();
    };
    arm();
    ACTIVITY_EVENTS.forEach((type) => window.addEventListener(type, onActivity, { capture: true, passive: true }));
    return () => {
      window.clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((type) => window.removeEventListener(type, onActivity, { capture: true }));
    };
  }, [enabled, idleSeconds, countdownSeconds, armKey]);

  // Countdown, one tick per second while the warning is open.
  const counting = secondsLeft !== null;
  useEffect(() => {
    if (!counting) return;
    const id = window.setInterval(() => setSecondsLeft((s) => (s === null ? null : Math.max(0, s - 1))), 1000);
    return () => window.clearInterval(id);
  }, [counting]);

  useEffect(() => {
    if (secondsLeft !== 0) return;
    warningRef.current = false;
    setSecondsLeft(null);
    setArmKey((k) => k + 1);
    onResetRef.current();
  }, [secondsLeft]);

  const stillHere = useCallback(() => {
    warningRef.current = false;
    setSecondsLeft(null);
    setArmKey((k) => k + 1);
  }, []);

  return { warning: secondsLeft !== null, secondsLeft: secondsLeft ?? countdownSeconds, stillHere };
}
