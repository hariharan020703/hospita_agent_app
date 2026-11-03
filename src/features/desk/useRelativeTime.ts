import { useTranslation } from 'react-i18next';
import { useLocale } from '@/hooks/useLocale';
import { now, todayIso } from '@/lib/clock';
import { formatDateTime, formatRelativeMinutes, formatTime } from '@/lib/format';
import { addDaysIso, timeOf, toIsoDate } from '@/lib/time';

/** "Just now", "25 minutes ago", "Today, 9:12 am", "Yesterday, 4:40 pm" or a date, in hospital local time. */
export function useRelativeTime() {
  const { t } = useTranslation('desk');
  const { lang } = useLocale();
  return (isoDateTime: string): string => {
    const date = new Date(isoDateTime);
    const minutes = Math.floor((now().getTime() - date.getTime()) / 60_000);
    if (minutes < 1) return t('time.justNow');
    if (minutes < 60) return formatRelativeMinutes(-minutes, lang);
    const today = todayIso();
    const day = toIsoDate(date);
    const time = formatTime(timeOf(date), lang);
    if (day === today) return t('time.todayAt', { time });
    if (day === addDaysIso(today, -1)) return t('time.yesterdayAt', { time });
    return formatDateTime(isoDateTime, lang);
  };
}
