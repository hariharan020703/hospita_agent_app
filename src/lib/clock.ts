// The app's clock. Real time by default; VITE_FIXED_NOW pins the start time for demos and tests, shared by every
// open tab through a stored anchor so kiosk, desk, doctor and patient screens agree on "now".
import { env } from '@/config/env';
import { readJson, removeKey, writeJson } from './storage';
import { toIsoDate } from './time';

const ANCHOR_KEY = 'mediflow.clock';

interface Anchor {
  /** Real epoch ms when the anchor was set. */
  real: number;
  /** App epoch ms at that real moment. */
  app: number;
  speed: number;
  config: string;
}

let anchor: Anchor | null | undefined;
let testNow: Date | null = null;

function parseFixed(value: string, real: Date): number | null {
  const hhmm = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (hhmm) {
    const date = new Date(real);
    date.setHours(Number(hhmm[1]), Number(hhmm[2]), 0, 0);
    return date.getTime();
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function loadAnchor(): Anchor | null {
  if (!env.fixedNow) return null;
  const config = `${env.fixedNow}|${env.clockSpeed}`;
  const realNow = Date.now();
  const stored = readJson<Anchor>(ANCHOR_KEY);
  if (stored?.config === config && toIsoDate(new Date(stored.real)) === toIsoDate(new Date(realNow))) return stored;
  const app = parseFixed(env.fixedNow, new Date(realNow));
  if (app === null) return null;
  const fresh: Anchor = { real: realNow, app, speed: env.clockSpeed, config };
  writeJson(ANCHOR_KEY, fresh);
  return fresh;
}

export function now(): Date {
  if (testNow) return new Date(testNow);
  if (anchor === undefined) anchor = loadAnchor();
  if (!anchor) return new Date();
  return new Date(anchor.app + (Date.now() - anchor.real) * anchor.speed);
}

export const todayIso = (): string => toIsoDate(now());

/** Restart a pinned clock from VITE_FIXED_NOW (used when sample data is reset). */
export function resetClock(): void {
  removeKey(ANCHOR_KEY);
  anchor = undefined;
}

/** Tests only: freeze the clock at a given moment (null to release). */
export function setTestNow(date: Date | null): void {
  testNow = date;
}
