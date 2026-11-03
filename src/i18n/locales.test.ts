// Bilingual namespaces (patient app, kiosk and shared text): every Tamil file must have exactly the same keys as
// English, with no empty strings, and the same placeholders. Staff-app namespaces are English only.
import { describe, expect, it } from 'vitest';
import { BILINGUAL_NAMESPACES as NAMESPACES } from './index';

const files = import.meta.glob<Record<string, unknown>>('./locales/*/*.json', { eager: true, import: 'default' });

function flatten(value: unknown, prefix = ''): Record<string, string> {
  if (typeof value === 'string') return { [prefix]: value };
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce<Record<string, string>>(
      (acc, [key, child]) => ({ ...acc, ...flatten(child, prefix ? `${prefix}.${key}` : key) }),
      {},
    );
  }
  return {};
}

const placeholders = (text: string) => [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort();

describe.each(NAMESPACES)('%s namespace', (ns) => {
  const en = flatten(files[`./locales/en/${ns}.json`]);
  const ta = flatten(files[`./locales/ta/${ns}.json`]);

  it('has the same keys in Tamil and English', () => {
    expect(Object.keys(ta).sort()).toEqual(Object.keys(en).sort());
  });

  it('has no empty strings and keeps every placeholder', () => {
    for (const [key, text] of Object.entries(en)) {
      expect(text.trim(), `en ${key}`).not.toBe('');
      expect(ta[key]?.trim(), `ta ${key}`).not.toBe('');
      expect(placeholders(ta[key] ?? ''), `placeholders in ta ${key}`).toEqual(placeholders(text));
    }
  });
});
