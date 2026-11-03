// Renders agent text to a plain string, for records that keep words rather than keys (the saved triage
// conversation the doctor reads). Screens render agent text themselves, in the reader's language.
import i18n from '@/i18n';
import type { AgentText, AgentTextParam, Lang } from '@/types';

function param(value: AgentTextParam, lang: Lang): string | number {
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (Array.isArray(value)) return value.map((v) => renderText(v, lang)).join(' + ');
  if ('key' in value) return renderText(value, lang);
  return value[lang];
}

export function renderText(text: AgentText, lang: Lang): string {
  const params = Object.fromEntries(Object.entries(text.params ?? {}).map(([k, v]) => [k, param(v, lang)]));
  const t = i18n.getFixedT(lang) as unknown as (key: string, options: object) => string;
  return t(text.key, params);
}
