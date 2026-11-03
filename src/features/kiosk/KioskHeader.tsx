// Kiosk header: hospital name, the time, a Tamil/English switch, "Start over" and "Log out" (back to the MediFlow
// home page). Shown on every screen but attract.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut, RotateCcw } from 'lucide-react';
import { Button, LogoMark } from '@/components/ui';
import { useLocale } from '@/hooks/useLocale';
import { cn } from '@/lib/cn';
import { now } from '@/lib/clock';
import { formatDate, formatTime } from '@/lib/format';
import { timeOf, toIsoDate } from '@/lib/time';
import type { Hospital, Lang } from '@/types';

const LANGUAGE_LABEL: Record<Lang, string> = { ta: 'தமிழ்', en: 'English' };
/** Tamil first: it is the kiosk's default language. */
const ORDER: readonly Lang[] = ['ta', 'en'];

function useClock(intervalMs: number) {
  const [time, setTime] = useState(now);
  useEffect(() => {
    const id = window.setInterval(() => setTime(now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return time;
}

export function KioskLanguageToggle({ value, onChange }: { value: Lang; onChange: (lang: Lang) => void }) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={t('language.label')} className="flex rounded-2xl border-2 border-border-strong p-1">
      {ORDER.map((lang) => (
        <button
          key={lang}
          type="button"
          lang={lang}
          aria-pressed={value === lang}
          onClick={() => onChange(lang)}
          className={cn(
            'min-h-12 min-w-20 rounded-xl px-5 text-base font-semibold transition-colors',
            value === lang ? 'bg-primary text-primary-fg' : 'text-fg-muted hover:bg-surface-sunken hover:text-fg',
          )}
        >
          {LANGUAGE_LABEL[lang]}
        </button>
      ))}
    </div>
  );
}

export function KioskHeader({
  hospital,
  lang,
  onLangChange,
  onStartOver,
}: {
  hospital: Hospital | undefined;
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  onStartOver: () => void;
}) {
  const { t } = useTranslation(['kiosk', 'common']);
  const { lang: uiLang, l } = useLocale();
  const navigate = useNavigate();
  const clock = useClock(30_000);
  const hhmm = timeOf(clock);
  const iso = toIsoDate(clock);

  return (
    <header className="no-print border-b bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <LogoMark className="h-10 w-10" />
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-fg">{l(hospital?.name) || t('common:appName')}</p>
            <p className="text-lg text-fg-muted">{t('header.kiosk')}</p>
          </div>
        </div>
        <p className="text-right leading-tight">
          <span className="sr-only">{t('header.time')}: </span>
          <time dateTime={`${iso}T${hhmm}`} className="block text-xl font-bold text-fg tabular">
            {formatTime(hhmm, uiLang)}
          </time>
          <span className="block text-base text-fg-muted">{formatDate(iso, uiLang, 'weekday')}</span>
        </p>
        <KioskLanguageToggle value={lang} onChange={onLangChange} />
        <Button variant="outline" size="lg" icon={RotateCcw} onClick={onStartOver}>
          {t('header.startOver')}
        </Button>
        <Button variant="ghost" size="lg" icon={LogOut} onClick={() => navigate('/login')}>
          {t('header.logout')}
        </Button>
      </div>
    </header>
  );
}
