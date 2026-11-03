import { Suspense } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, CalendarDays, Home, LogOut, MessageSquareText, Siren, UserRound } from 'lucide-react';
import { IconButton, LogoMark, SkeletonList } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useSignOut } from '@/hooks/queries/auth';
import { useHospital } from '@/hooks/queries/directory';
import { useNotifications } from '@/hooks/queries/clinical';
import { useLocale } from '@/hooks/useLocale';
import { usePrefs } from '@/hooks/usePrefs';
import { useNavigate } from 'react-router-dom';
import { usePatientContext } from './usePatientContext';

export function PatientLayout() {
  const { t } = useTranslation(['patient', 'common']);
  const { lang, l } = useLocale();
  const navigate = useNavigate();
  const setPatientLang = usePrefs((s) => s.setPatientLang);
  const { userId } = usePatientContext();
  const hospital = useHospital();
  const notifications = useNotifications(userId);
  const unread = notifications.data?.filter((n) => !n.read).length ?? 0;
  const signOut = useSignOut('/login');

  const tabs = [
    { to: '/app', label: t('nav.home'), icon: Home, end: true },
    { to: '/app/assistant', label: t('nav.assistant'), icon: MessageSquareText },
    { to: '/app/appointments', label: t('nav.appointments'), icon: CalendarDays },
    { to: '/app/profile', label: t('nav.profile'), icon: UserRound },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2"
      >
        {t('common:actions.skipToContent')}
      </a>
      <header className="no-print sticky top-0 z-30 border-b bg-surface/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-2 px-4 lg:gap-4 lg:px-8">
          <Link to="/app" className="flex min-w-0 flex-1 items-center gap-2 rounded-lg">
            <LogoMark />
            <span className="min-w-0">
              <span className="block text-base font-bold leading-tight text-fg">MediFlow</span>
              <span className="block truncate text-xs text-fg-subtle">{l(hospital.data?.name)}</span>
            </span>
          </Link>
          <nav aria-label={t('common:a11y.mainNav')} className="hidden md:block">
            <ul className="flex items-center gap-1">
              {tabs.map(({ to, label, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      cn(
                        'rounded-lg px-3 py-2 text-sm font-semibold',
                        isActive ? 'bg-primary-soft text-primary-ink' : 'text-fg-muted hover:text-fg',
                      )
                    }
                  >
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <button
            type="button"
            onClick={() => setPatientLang(lang === 'ta' ? 'en' : 'ta')}
            className="min-h-11 rounded-lg px-2 text-sm font-semibold text-primary-ink hover:bg-primary-soft"
            aria-label={t('common:language.label')}
            lang={lang === 'ta' ? 'en' : 'ta'}
          >
            {lang === 'ta' ? 'EN' : 'தமிழ்'}
          </button>
          <IconButton
            icon={Bell}
            label={t('nav.notifications')}
            badge={unread}
            onClick={() => navigate('/app/notifications')}
          />
          <Link
            to="/app/emergency"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-danger px-3 text-sm font-bold text-white hover:bg-danger-hover"
          >
            <Siren aria-hidden className="h-4 w-4" />
            <span className="hidden xs:inline">{t('nav.emergency')}</span>
            <span className="xs:hidden">108</span>
          </Link>
          <IconButton icon={LogOut} label={t('nav.logout')} onClick={signOut} />
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-5 lg:px-8 lg:pt-8 focus:outline-none md:pb-10"
      >
        <Suspense fallback={<SkeletonList rows={4} />}>
          <Outlet />
        </Suspense>
      </main>

      <nav
        aria-label={t('common:a11y.mainNav')}
        className="no-print fixed inset-x-0 bottom-0 z-30 border-t bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="mx-auto grid max-w-3xl grid-cols-4">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-center text-xs font-semibold leading-tight',
                    isActive ? 'text-primary-ink' : 'text-fg-muted',
                  )
                }
              >
                <Icon aria-hidden className="h-6 w-6" />
                <span className="line-clamp-2">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
