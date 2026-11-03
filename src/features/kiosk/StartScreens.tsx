// The kiosk's first three screens: attract (tap anywhere), language choice, and the three main actions.
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut, Mic, Pointer, ScanQrCode, Siren, type LucideIcon } from 'lucide-react';
import { Button, LogoMark } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { Hospital, Lang } from '@/types';
import { ScreenTitle } from './ui';

/** Full-screen welcome in Tamil and English. A tap anywhere starts. */
export function AttractScreen({ hospital, onStart }: { hospital: Hospital | undefined; onStart: () => void }) {
  const { t } = useTranslation(['kiosk', 'common']);
  const navigate = useNavigate();
  const both = (key: 'attract.welcome' | 'attract.subtitle' | 'attract.tap' | 'header.logout') => ({
    ta: t(key, { lng: 'ta' }),
    en: t(key, { lng: 'en' }),
  });
  const welcome = both('attract.welcome');
  const subtitle = both('attract.subtitle');
  const tap = both('attract.tap');
  const logout = both('header.logout');
  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-primary px-6 py-8 text-primary-fg">
      {/* The whole screen is one button; the text sits on top and lets taps through. */}
      <button
        type="button"
        onClick={onStart}
        aria-label={`${tap.ta} / ${tap.en}`}
        className="absolute inset-0 z-0 cursor-pointer focus-visible:outline-[6px] focus-visible:outline-white focus-visible:[outline-offset:-12px]"
      />
      {/* Sits above the full-screen start button so it can be tapped on its own. */}
      <Button
        variant="outline"
        size="lg"
        icon={LogOut}
        onClick={() => navigate('/login')}
        className="absolute right-6 top-6 z-20"
      >
        <span lang="ta">{logout.ta}</span>
        <span aria-hidden className="opacity-60">
          ·
        </span>
        <span lang="en">{logout.en}</span>
      </Button>
      <div className="pointer-events-none relative z-10 flex max-w-4xl flex-col items-center gap-5 text-center">
        <span className="rounded-3xl bg-white p-3 shadow-lg">
          <LogoMark className="h-14 w-14" />
        </span>
        <h1 className="space-y-2">
          <span lang="ta" className="block text-balance text-3xl font-extrabold leading-tight">
            {hospital?.name.ta ?? t('common:appName')}
          </span>
          <span lang="en" className="block text-balance text-xl font-semibold opacity-90">
            {hospital?.name.en}
          </span>
        </h1>
        <div className="space-y-3">
          <p lang="ta" className="text-2xl font-bold">
            {welcome.ta}
          </p>
          <p lang="en" className="text-xl font-semibold opacity-90">
            {welcome.en}
          </p>
        </div>
        <div className="space-y-1 text-lg opacity-90">
          <p lang="ta">{subtitle.ta}</p>
          <p lang="en">{subtitle.en}</p>
        </div>
        <div aria-hidden className="mt-4 flex flex-col items-center gap-5">
          <span className="relative grid h-20 w-20 place-items-center">
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-white/40" />
            <span className="relative grid h-16 w-16 place-items-center rounded-full bg-white text-primary-ink shadow-md">
              <Pointer className="h-9 w-9" />
            </span>
          </span>
          <span className="rounded-full bg-white px-6 py-4 text-xl font-bold text-primary-ink shadow-md">
            <span lang="ta">{tap.ta}</span>
            <span className="mx-3 opacity-60">·</span>
            <span lang="en">{tap.en}</span>
          </span>
        </div>
      </div>
    </main>
  );
}

const LANGUAGE_CHOICES: { lang: Lang; label: string; other: { lang: Lang; label: string } }[] = [
  { lang: 'ta', label: 'தமிழ்', other: { lang: 'en', label: 'Tamil' } },
  { lang: 'en', label: 'English', other: { lang: 'ta', label: 'ஆங்கிலம்' } },
];

export function LanguageScreen({ onChoose }: { onChoose: (lang: Lang) => void }) {
  const { t } = useTranslation('kiosk');
  return (
    <section aria-labelledby="kiosk-language-title" className="mx-auto flex max-w-5xl flex-col items-center gap-6 py-6">
      <ScreenTitle id="kiosk-language-title" className="space-y-2 text-center">
        <span lang="ta" className="block">
          {t('language.title', { lng: 'ta' })}
        </span>
        <span lang="en" className="block text-xl font-semibold text-fg-muted">
          {t('language.title', { lng: 'en' })}
        </span>
      </ScreenTitle>
      <div className="grid w-full gap-5 md:grid-cols-2">
        {LANGUAGE_CHOICES.map(({ lang, label, other }) => (
          <button
            key={lang}
            type="button"
            lang={lang}
            onClick={() => onChoose(lang)}
            className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-3xl border-4 border-primary/40 bg-surface px-6 py-6 text-fg shadow-md transition-colors hover:border-primary hover:bg-primary-soft active:bg-primary-soft"
          >
            <span className="text-4xl font-extrabold">{label}</span>
            <span lang={other.lang} className="text-lg text-fg-muted">
              {other.label}
            </span>
          </button>
        ))}
      </div>
      <p className="text-center text-base text-fg-muted">{t('language.hint')}</p>
    </section>
  );
}

function ActionTile({
  icon: Icon,
  title,
  hint,
  onClick,
  className,
  iconClassName,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  onClick: () => void;
  className: string;
  iconClassName: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-80 flex-col items-center justify-center gap-5 rounded-3xl px-6 py-6 text-center shadow-md transition-transform active:scale-[0.99]',
        className,
      )}
    >
      <span className={cn('grid h-20 w-20 shrink-0 place-items-center rounded-full', iconClassName)}>
        <Icon aria-hidden className="h-10 w-10" />
      </span>
      <span className="text-balance text-2xl font-bold leading-tight">{title}</span>
      <span className="text-balance text-base leading-snug">{hint}</span>
    </button>
  );
}

export function HomeScreen({
  onWalkIn,
  onCheckIn,
  onEmergency,
}: {
  onWalkIn: () => void;
  onCheckIn: () => void;
  onEmergency: () => void;
}) {
  const { t } = useTranslation('kiosk');
  return (
    <section aria-labelledby="kiosk-home-title" className="space-y-5 py-4">
      <ScreenTitle id="kiosk-home-title" className="text-center text-3xl">
        {t('home.title')}
      </ScreenTitle>
      <div className="grid gap-4 md:grid-cols-3">
        <ActionTile
          icon={Mic}
          title={t('home.walkIn')}
          hint={t('home.walkInHint')}
          onClick={onWalkIn}
          className="bg-primary text-primary-fg hover:bg-primary-hover"
          iconClassName="bg-white text-primary-ink"
        />
        <ActionTile
          icon={ScanQrCode}
          title={t('home.checkIn')}
          hint={t('home.checkInHint')}
          onClick={onCheckIn}
          className="border-4 border-primary bg-surface text-fg hover:bg-primary-soft"
          iconClassName="bg-primary-soft text-primary-ink"
        />
        <ActionTile
          icon={Siren}
          title={t('home.emergency')}
          hint={t('home.emergencyHint')}
          onClick={onEmergency}
          className="bg-danger text-white hover:bg-danger-hover"
          iconClassName="bg-white text-danger-ink"
        />
      </div>
    </section>
  );
}
