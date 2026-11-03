import { useTranslation } from 'react-i18next';
import { Monitor, Moon, Sun } from 'lucide-react';
import { SegmentedControl } from '@/components/ui';
import type { ThemePref } from '@/hooks/usePrefs';
import type { Lang } from '@/types';

export function LanguageSwitch({
  value,
  onChange,
  size = 'md',
}: {
  value: Lang;
  onChange: (lang: Lang) => void;
  size?: 'sm' | 'md' | 'lg';
}) {
  const { t } = useTranslation();
  return (
    <SegmentedControl
      label={t('language.label')}
      value={value}
      onChange={onChange}
      size={size}
      options={[
        { value: 'ta', label: <span lang="ta">{t('language.ta')}</span> },
        { value: 'en', label: <span lang="en">{t('language.en')}</span> },
      ]}
    />
  );
}

export function ThemeSwitch({ value, onChange }: { value: ThemePref; onChange: (theme: ThemePref) => void }) {
  const { t } = useTranslation();
  return (
    <SegmentedControl
      label={t('theme.label')}
      value={value}
      onChange={onChange}
      options={[
        { value: 'light', label: t('theme.light'), icon: Sun },
        { value: 'dark', label: t('theme.dark'), icon: Moon },
        { value: 'system', label: t('theme.system'), icon: Monitor },
      ]}
    />
  );
}
