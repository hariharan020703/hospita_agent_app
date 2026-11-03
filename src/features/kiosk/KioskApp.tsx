// Walk-in kiosk (/kiosk): public, touch-only, landscape tablet. Attract -> language -> home, then walk-in token,
// QR check-in or emergency. A small state machine (not routes) so "Start over" and the idle reset can clear
// everything at once: each visit is keyed, so remounting drops the chat, forms and the camera.
import { Suspense, useCallback, useState, type ReactNode } from 'react';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { FullPageSpinner } from '@/app/providers';
import { useHospital } from '@/hooks/queries/directory';
import { useAppLanguage, useTheme } from '@/hooks/useAppearance';
import { useLocale } from '@/hooks/useLocale';
import { EmergencyScreen } from '@/features/triage/EmergencyScreen';
import type { Lang } from '@/types';
import { CheckInFlow } from './CheckInFlow';
import { EmergencyDoneButton } from './EmergencyDoneButton';
import { IdleDialog } from './IdleDialog';
import { KioskHeader } from './KioskHeader';
import { AttractScreen, HomeScreen, LanguageScreen } from './StartScreens';
import { useIdleReset } from './useIdleReset';
import { WalkInFlow } from './WalkInFlow';

type Screen = 'attract' | 'language' | 'home' | 'walkIn' | 'checkIn' | 'emergency';

const DEFAULT_LANG: Lang = 'ta';
const DEFAULT_IDLE_SECONDS = 60;
const COUNTDOWN_SECONDS = 10;

function KioskShell({ lang, onLangChange }: { lang: Lang; onLangChange: (lang: Lang) => void }) {
  const { lang: uiLang } = useLocale();
  const hospital = useHospital();
  const [screen, setScreen] = useState<Screen>('attract');
  /** Bumped on every reset so the flows remount with fresh state. */
  const [visit, setVisit] = useState(0);

  const reset = useCallback(() => {
    setScreen('attract');
    setVisit((v) => v + 1);
    onLangChange(DEFAULT_LANG);
    window.scrollTo({ top: 0 });
  }, [onLangChange]);

  const idle = useIdleReset({
    enabled: screen !== 'attract',
    idleSeconds: hospital.data?.kiosk.idleSeconds ?? DEFAULT_IDLE_SECONDS,
    countdownSeconds: COUNTDOWN_SECONDS,
    onReset: reset,
  });

  const goHome = () => setScreen('home');

  if (screen === 'attract') {
    return <AttractScreen hospital={hospital.data} onStart={() => setScreen('language')} />;
  }

  let content: ReactNode;
  switch (screen) {
    case 'language':
      content = (
        <LanguageScreen
          onChoose={(choice) => {
            onLangChange(choice);
            setScreen('home');
          }}
        />
      );
      break;
    case 'home':
      content = (
        <HomeScreen
          onWalkIn={() => setScreen('walkIn')}
          onCheckIn={() => setScreen('checkIn')}
          onEmergency={() => setScreen('emergency')}
        />
      );
      break;
    case 'walkIn':
      content = <WalkInFlow key={visit} hospital={hospital.data} onHome={goHome} onReset={reset} />;
      break;
    case 'checkIn':
      content = <CheckInFlow key={visit} onHome={goHome} onReset={reset} />;
      break;
    case 'emergency':
      content = (
        <EmergencyScreen
          hospital={hospital.data}
          lang={uiLang}
          size="lg"
          footer={<EmergencyDoneButton onClick={reset} />}
        />
      );
      break;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas print:min-h-0 print:bg-white">
      <KioskHeader hospital={hospital.data} lang={lang} onLangChange={onLangChange} onStartOver={reset} />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-6 py-6 print:max-w-none print:p-0">
        {content}
      </main>
      {idle.warning && (
        <IdleDialog secondsLeft={idle.secondsLeft} totalSeconds={COUNTDOWN_SECONDS} onStay={idle.stillHere} />
      )}
    </div>
  );
}

export default function KioskApp() {
  // Tamil by default for every visitor; the kiosk is always in the light theme.
  const [lang, setLang] = useState<Lang>(DEFAULT_LANG);
  useAppLanguage(lang);
  useTheme('light');
  return (
    <ErrorBoundary name="kiosk">
      <Suspense fallback={<FullPageSpinner />}>
        <KioskShell lang={lang} onLangChange={setLang} />
      </Suspense>
    </ErrorBoundary>
  );
}
