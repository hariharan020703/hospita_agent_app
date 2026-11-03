import { useEffect } from 'react';
import { setLanguage } from '@/i18n';
import type { Lang } from '@/types';
import { usePrefs } from './usePrefs';

/** Applies the theme to <html data-theme>; `forced` overrides it (the kiosk is always light). */
export function useTheme(forced?: 'light' | 'dark') {
  const theme = usePrefs((s) => s.theme);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved = forced ?? (theme === 'system' ? (media.matches ? 'dark' : 'light') : theme);
      document.documentElement.dataset.theme = resolved;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme, forced]);
}

/** Switches the interface language for the app that is mounted (each app keeps its own preference). */
export function useAppLanguage(lang: Lang) {
  useEffect(() => {
    setLanguage(lang);
  }, [lang]);
}
