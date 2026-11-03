// Reads a lab value against its printed reference range ("< 200", "> 40", "70 - 100") to flag it high or low.
import type { RangeFlag } from '@/types';

const number = (text: string): number | null => {
  const match = /-?\d+(?:\.\d+)?/.exec(text.replace(/,/g, ''));
  return match ? Number(match[0]) : null;
};

export function rangeFlag(value: string, range: string): RangeFlag {
  const v = number(value);
  const r = range.trim();
  if (v === null || !r) return 'unknown';
  const between = /(-?\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(-?\d+(?:\.\d+)?)/.exec(r);
  if (between) {
    const low = Number(between[1]);
    const high = Number(between[2]);
    return v < low ? 'low' : v > high ? 'high' : 'normal';
  }
  const limit = number(r);
  if (limit === null) return 'unknown';
  if (/^(<|≤|up to|below)/i.test(r)) return v > limit ? 'high' : 'normal';
  if (/^(>|≥|above)/i.test(r)) return v < limit ? 'low' : 'normal';
  return 'unknown';
}

/** Below this, an extracted field is highlighted for the patient to check. */
export const LOW_FIELD_CONFIDENCE = 75;
