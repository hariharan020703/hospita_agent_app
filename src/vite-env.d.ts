/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: 'mock' | 'api';
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_MOCK_LATENCY_MIN?: string;
  readonly VITE_MOCK_LATENCY_MAX?: string;
  readonly VITE_MOCK_ERROR_RATE?: string;
  readonly VITE_FIXED_NOW?: string;
  readonly VITE_CLOCK_SPEED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
