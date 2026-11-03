// i18next setup, one JSON file per namespace, loaded on demand so each app downloads only its text.
// Tamil + English: patient app, kiosk and the text they share. English only: front desk, doctor and admin apps
// (and the MediFlow home page), so those namespaces have no Tamil file.
import i18n, { type BackendModule } from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { Lang } from '@/types';

export const BILINGUAL_NAMESPACES = ['common', 'validation', 'auth', 'patient', 'triage', 'kiosk'] as const;
export const ENGLISH_ONLY_NAMESPACES = ['desk', 'doctor', 'admin'] as const;
export const NAMESPACES = [...BILINGUAL_NAMESPACES, ...ENGLISH_ONLY_NAMESPACES] as const;
export type Namespace = (typeof NAMESPACES)[number];

const loaders = import.meta.glob<{ default: Record<string, unknown> }>('./locales/*/*.json');

const lazyBackend: BackendModule = {
  type: 'backend',
  init: () => undefined,
  read(language, namespace, callback) {
    const load = loaders[`./locales/${language}/${namespace}.json`];
    if (!load) {
      callback(null, {});
      return;
    }
    load().then(
      (module) => callback(null, module.default),
      (error: unknown) => callback(error instanceof Error ? error : new Error(String(error)), false),
    );
  },
};

void i18n
  .use(lazyBackend)
  .use(initReactI18next)
  .init({
    lng: 'en',
    fallbackLng: 'en',
    supportedLngs: ['en', 'ta'],
    load: 'currentOnly',
    ns: ['common', 'validation'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    returnNull: false,
    react: { useSuspense: true },
  });

const applyDocumentLanguage = (lng: string) => {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lng;
  document.documentElement.dataset.lang = lng;
};
applyDocumentLanguage(i18n.language);
i18n.on('languageChanged', applyDocumentLanguage);

export function setLanguage(lang: Lang): void {
  if (i18n.language !== lang) void i18n.changeLanguage(lang);
}

export const currentLang = (): Lang => (i18n.language === 'ta' ? 'ta' : 'en');

export default i18n;
