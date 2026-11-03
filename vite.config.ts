/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode !== 'test' &&
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
        manifest: {
          name: 'MediFlow',
          short_name: 'MediFlow',
          description: 'Describe your symptoms, book the right doctor and track your queue.',
          lang: 'en',
          start_url: '/app/',
          scope: '/app/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#F6F8FA',
          theme_color: '#0E7C86',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          navigateFallback: '/index.html',
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          maximumFileSizeToCacheInBytes: 3_000_000,
        },
      }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5174, strictPort: true },
  preview: { port: 4174, strictPort: true },
  // The largest chunk is the lazily loaded sample-data seed (~740 kB, ~70 kB gzipped); app code stays well below this.
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 800 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    env: {
      VITE_DATA_SOURCE: 'mock',
      VITE_MOCK_LATENCY_MIN: '0',
      VITE_MOCK_LATENCY_MAX: '0',
      VITE_MOCK_ERROR_RATE: '0',
      VITE_FIXED_NOW: '2026-10-29T09:30',
      VITE_CLOCK_SPEED: '0',
    },
  },
}));
