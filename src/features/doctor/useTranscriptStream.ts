import { useEffect, useState } from 'react';
import type { TranscriptLine } from '@/types';

const TICK_MS = 45;
/** Pause between two speakers, in ticks. */
const GAP_TICKS = 8;

/**
 * Plays a transcript the way live captions arrive: each line types out over its own duration, with a short gap
 * before the next speaker. Pausing freezes it; `heard` counts lines that have started.
 */
export function useTranscriptStream(lines: readonly TranscriptLine[] | null, paused: boolean) {
  const [state, setState] = useState({ index: 0, chars: 0, gap: 0 });
  const finished = lines !== null && state.index >= lines.length;

  useEffect(() => {
    setState({ index: 0, chars: 0, gap: 0 });
  }, [lines]);

  useEffect(() => {
    if (!lines || paused || finished) return;
    const timer = window.setInterval(() => {
      setState((s) => {
        const line = lines[s.index];
        if (!line) return s;
        if (s.chars < line.text.length) {
          const step = Math.max(1, Math.ceil(line.text.length / (line.ms / TICK_MS)));
          return { ...s, chars: Math.min(line.text.length, s.chars + step) };
        }
        if (s.gap < GAP_TICKS) return { ...s, gap: s.gap + 1 };
        return { index: s.index + 1, chars: 0, gap: 0 };
      });
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [lines, paused, finished]);

  const done = lines?.slice(0, state.index) ?? [];
  const current = lines?.[state.index];
  const partial = current && state.chars > 0 ? { ...current, text: current.text.slice(0, state.chars) } : null;
  return {
    lines: done,
    partial,
    heard: lines ? Math.min(lines.length, state.index + (state.chars > 0 ? 1 : 0)) : 0,
    total: lines?.length ?? 0,
    finished,
  };
}
