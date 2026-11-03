import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatTime } from '@/lib/format';
import type { AgentText, AgentTextParam, Lang } from '@/types';

type Translate = (key: string, options?: Record<string, unknown>) => string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK = /^\d{2}:\d{2}$/;

/**
 * Renders what an agent said in the reader's language. Bilingual values pick the current language, nested texts
 * render in place, lists join with " + ", and `date` / `time` parameters are formatted for the locale.
 */
export function useAgentText(): (text: AgentText) => string {
  const { t, i18n } = useTranslation('triage');
  const lang: Lang = i18n.language === 'ta' ? 'ta' : 'en';
  const translate = t as unknown as Translate;

  const render = useCallback(
    (text: AgentText): string => {
      const value = (key: string, v: AgentTextParam): string | number => {
        if (typeof v === 'number') return v;
        if (typeof v === 'string') {
          if (key === 'date' && ISO_DATE.test(v)) return formatDate(v, lang, 'weekday');
          if (key === 'time' && CLOCK.test(v)) return formatTime(v, lang);
          return v;
        }
        if (Array.isArray(v)) return v.map(render).join(' + ');
        if ('key' in v) return render(v);
        return v[lang];
      };
      const params = Object.fromEntries(Object.entries(text.params ?? {}).map(([k, v]) => [k, value(k, v)]));
      return translate(text.key, params);
    },
    [lang, translate],
  );
  return render;
}
