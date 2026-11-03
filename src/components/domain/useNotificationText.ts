import { useTranslation } from 'react-i18next';
import { formatDate, formatTime } from '@/lib/format';
import { useLocale } from '@/hooks/useLocale';
import type { AppNotification } from '@/types';

/** Renders a notification from its kind + params in the current language (dates and times localised). */
export function useNotificationText() {
  const { t } = useTranslation('patient');
  const { lang } = useLocale();
  return (n: AppNotification): string => {
    const params: Record<string, string | number> = { ...n.params };
    if (typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date))
      params.date = formatDate(params.date, lang, 'weekday');
    if (typeof params.time === 'string' && /^\d{2}:\d{2}$/.test(params.time))
      params.time = formatTime(params.time, lang);
    return t(`notifications.kinds.${n.kind}`, params);
  };
}
