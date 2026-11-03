import { useTranslation } from 'react-i18next';
import { formatDate } from '@/lib/format';
import { addDaysIso } from '@/lib/time';
import { useLocale } from './useLocale';

/** "Today", "Tomorrow" or a localised date. */
export function useRelativeDay(today: string) {
  const { t } = useTranslation();
  const { lang } = useLocale();
  return (date: string, style: 'weekday' | 'medium' = 'weekday') => {
    if (date === today) return t('dates.today');
    if (date === addDaysIso(today, 1)) return t('dates.tomorrow');
    return formatDate(date, lang, style);
  };
}
