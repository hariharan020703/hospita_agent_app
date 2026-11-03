// Shell for the staff apps (front desk, doctor, admin; English only). There is no top bar: the sidebar holds
// everything. Top: logo, app name and hospital. Middle: navigation. Bottom: the signed-in user, theme toggle and
// Log out (back to the MediFlow home page). Below 1024px the same sidebar opens as a drawer from a floating button.
import { Suspense, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut, Menu, Moon, Sun } from 'lucide-react';
import { Avatar, Button, Drawer, IconButton, Logo, Sidebar, SkeletonList, type NavItem } from '@/components/ui';
import { useSession } from '@/features/auth/session';
import { useSignOut } from '@/hooks/queries/auth';
import { useHospital } from '@/hooks/queries/directory';
import { useLocale } from '@/hooks/useLocale';
import { usePrefs } from '@/hooks/usePrefs';

export function StaffLayout({ appName, nav }: { appName: string; nav: readonly NavItem[] }) {
  const { t } = useTranslation(['auth', 'common']);
  const { l } = useLocale();
  const session = useSession();
  const hospital = useHospital();
  const theme = usePrefs((s) => s.theme);
  const setTheme = usePrefs((s) => s.setTheme);
  const signOut = useSignOut('/login');
  const [menuOpen, setMenuOpen] = useState(false);
  const isDark = document.documentElement.dataset.theme === 'dark';

  const header = (
    <div className="space-y-2">
      <Logo subtitle={appName} />
      {hospital.data && <p className="text-xs leading-snug text-fg-subtle">{l(hospital.data.name)}</p>}
    </div>
  );

  const footer = (
    <div className="space-y-3 border-t pt-3">
      {session && (
        <div className="flex items-center gap-3 px-1">
          <Avatar name={session.name} size="sm" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold text-fg">
              {session.role === 'doctor' ? t('common:doctorName', { name: session.name }) : session.name}
            </p>
            <p className="truncate text-xs text-fg-subtle">{t(`roles.${session.role}`)}</p>
          </div>
          <IconButton
            icon={isDark ? Sun : Moon}
            label={t('common:theme.label')}
            size="sm"
            onClick={() => setTheme(isDark || theme === 'dark' ? 'light' : 'dark')}
          />
        </div>
      )}
      <Button variant="outline" size="sm" block icon={LogOut} onClick={signOut}>
        {t('common:actions.signOut')}
      </Button>
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2"
      >
        {t('common:actions.skipToContent')}
      </a>

      <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 border-r lg:block">
        <Sidebar items={nav} header={header} footer={footer} />
      </aside>

      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title={appName} width="md">
        <div className="-mx-5 -my-4 h-full">
          <Sidebar items={nav} onNavigate={() => setMenuOpen(false)} footer={footer} />
        </div>
      </Drawer>

      <IconButton
        icon={Menu}
        label={t('common:actions.openMenu')}
        variant="primary"
        size="lg"
        onClick={() => setMenuOpen(true)}
        className="no-print fixed bottom-4 right-4 z-30 rounded-full shadow-lg lg:hidden"
      />

      <main id="main" tabIndex={-1} className="min-w-0 flex-1 p-4 pb-24 focus:outline-none sm:p-6 lg:p-8">
        <Suspense fallback={<SkeletonList rows={5} />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
