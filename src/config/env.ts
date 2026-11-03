// Runtime configuration from VITE_* variables (see .env.example). Switch VITE_DATA_SOURCE to "api" to use a backend.

const toNumber = (value: string | undefined, fallback: number): number => {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const latencyMin = Math.max(0, toNumber(import.meta.env.VITE_MOCK_LATENCY_MIN, 150));

export const env = Object.freeze({
  dataSource: import.meta.env.VITE_DATA_SOURCE === 'api' ? ('api' as const) : ('mock' as const),
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL?.trim() || '/api',
  mockLatencyMin: latencyMin,
  mockLatencyMax: Math.max(latencyMin, toNumber(import.meta.env.VITE_MOCK_LATENCY_MAX, 600)),
  mockErrorRate: clamp(toNumber(import.meta.env.VITE_MOCK_ERROR_RATE, 0), 0, 1),
  fixedNow: import.meta.env.VITE_FIXED_NOW?.trim() || null,
  clockSpeed: Math.max(0, toNumber(import.meta.env.VITE_CLOCK_SPEED, 1)),
  isDev: import.meta.env.DEV,
  isTest: import.meta.env.MODE === 'test',
});

export type DataSource = typeof env.dataSource;
