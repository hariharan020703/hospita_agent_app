// The in-browser database behind the mock data source: a zustand store seeded lazily from src/data, persisted to
// localStorage, and kept in step across tabs through the `storage` event.
import { createStore, type StoreApi } from 'zustand/vanilla';
import { now, resetClock } from '@/lib/clock';
import { readJson, removeKey, writeJson } from '@/lib/storage';
import { toIsoDate } from '@/lib/time';
import type { DbState } from './state';

export type DbStore = StoreApi<DbState>;

const STORAGE_KEY = 'mediflow.db';
const listeners = new Set<() => void>();
let dbPromise: Promise<DbStore> | null = null;

/** Called whenever data changes: local writes, background simulation or another tab. */
export function onDbChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDb(): Promise<DbStore> {
  dbPromise ??= open();
  return dbPromise;
}

async function open(): Promise<DbStore> {
  const { createSeedState, DB_VERSION } = await import('./seed');
  const today = toIsoDate(now());
  const stored = readJson<DbState>(STORAGE_KEY);
  const initial = stored?.version === DB_VERSION && stored.seededFor === today ? stored : createSeedState(now());
  const store = createStore<DbState>(() => initial);

  let applyingRemote = false;
  writeJson(STORAGE_KEY, initial);
  store.subscribe((state) => {
    if (!applyingRemote) writeJson(STORAGE_KEY, state);
    listeners.forEach((l) => l());
  });

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        applyingRemote = true;
        store.setState(JSON.parse(event.newValue) as DbState, true);
      } catch {
        // Ignore a malformed write from another tab.
      } finally {
        applyingRemote = false;
      }
    });
  }
  return store;
}

/** Restore the sample data and restart a pinned clock (mock data source only). */
export async function resetDb(): Promise<void> {
  resetClock();
  const store = await getDb();
  const { createSeedState } = await import('./seed');
  store.setState(createSeedState(now()), true);
}

/** Tests only: forget the open database so the next call reseeds. */
export function resetDbForTests(): void {
  dbPromise = null;
  listeners.clear();
  removeKey(STORAGE_KEY);
}
