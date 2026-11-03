// Front desk app (/desk/*): live OPD board, walk-in registration and AI escalations. Desktop-first, English by default.
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutGrid, MessageSquareWarning, UserPlus } from 'lucide-react';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { StaffLayout } from '@/app/layouts/StaffLayout';
import { NotFoundPage } from '@/app/pages/StatusPages';
import { FullPageSpinner } from '@/app/providers';
import type { NavItem } from '@/components/ui';
import { RequireRole } from '@/features/auth/RequireRole';
import { useEscalations } from '@/hooks/queries/clinical';
import { useAppLanguage, useTheme } from '@/hooks/useAppearance';

const BoardPage = lazy(() => import('./pages/BoardPage'));
const WalkInPage = lazy(() => import('./pages/WalkInPage'));
const EscalationsPage = lazy(() => import('./pages/EscalationsPage'));

/** Staff shell with the desk navigation; the escalations badge shows the open count. */
function DeskShell() {
  const { t } = useTranslation('desk');
  const openEscalations = useEscalations('open');
  const nav: NavItem[] = [
    { to: '/desk', label: t('nav.board'), icon: LayoutGrid, end: true },
    { to: '/desk/walk-in', label: t('nav.walkIn'), icon: UserPlus },
    {
      to: '/desk/escalations',
      label: t('nav.escalations'),
      icon: MessageSquareWarning,
      badge: openEscalations.data?.length ?? 0,
    },
  ];
  return <StaffLayout appName={t('appName')} nav={nav} />;
}

export default function DeskApp() {
  // Staff apps are English only (Tamil is offered in the patient app and kiosk).
  useAppLanguage('en');
  useTheme();
  return (
    <ErrorBoundary name="desk">
      <Suspense fallback={<FullPageSpinner />}>
        <Routes>
          <Route element={<RequireRole roles={['desk', 'admin']} loginPath="/login" />}>
            <Route element={<DeskShell />}>
              <Route index element={<BoardPage />} />
              <Route path="walk-in" element={<WalkInPage />} />
              <Route path="escalations" element={<EscalationsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
