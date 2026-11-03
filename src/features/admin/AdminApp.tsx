// Admin app (/admin/*): desktop console for doctors, departments, schedules, appointments, patients, reports, the
// AI agents and settings. Staff UI language (English by default). Each page is its own lazy chunk (recharts loads only on the
// dashboard).
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  Building2,
  CalendarClock,
  ClipboardList,
  FileSpreadsheet,
  LayoutDashboard,
  Settings,
  Stethoscope,
  Users,
} from 'lucide-react';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { StaffLayout } from '@/app/layouts/StaffLayout';
import { NotFoundPage } from '@/app/pages/StatusPages';
import { FullPageSpinner } from '@/app/providers';
import type { NavItem } from '@/components/ui';
import { RequireRole } from '@/features/auth/RequireRole';
import { useLeaves } from '@/hooks/queries/directory';
import { useAppLanguage, useTheme } from '@/hooks/useAppearance';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const DoctorsPage = lazy(() => import('./pages/DoctorsPage'));
const DepartmentsPage = lazy(() => import('./pages/DepartmentsPage'));
const SchedulesPage = lazy(() => import('./pages/SchedulesPage'));
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage'));
const PatientsPage = lazy(() => import('./pages/PatientsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AgentsPage = lazy(() => import('./pages/AgentsPage'));

/** Staff shell with the admin navigation; rendered only after the role check, so its queries run signed in. */
function AdminShell() {
  const { t } = useTranslation('admin');
  const pendingLeaves = useLeaves({ status: 'pending' });
  const nav: NavItem[] = [
    { to: '/admin', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
    { to: '/admin/doctors', label: t('nav.doctors'), icon: Stethoscope },
    { to: '/admin/departments', label: t('nav.departments'), icon: Building2 },
    { to: '/admin/schedules', label: t('nav.schedules'), icon: CalendarClock, badge: pendingLeaves.data?.length },
    { to: '/admin/appointments', label: t('nav.appointments'), icon: ClipboardList },
    { to: '/admin/patients', label: t('nav.patients'), icon: Users },
    { to: '/admin/reports', label: t('nav.reports'), icon: FileSpreadsheet },
    { to: '/admin/agents', label: t('nav.agents'), icon: Bot },
    { to: '/admin/settings', label: t('nav.settings'), icon: Settings },
  ];
  return <StaffLayout appName={t('appName')} nav={nav} />;
}

export default function AdminApp() {
  // Staff apps are English only (Tamil is offered in the patient app and kiosk).
  useAppLanguage('en');
  useTheme();
  return (
    <ErrorBoundary name="admin">
      <Suspense fallback={<FullPageSpinner />}>
        <Routes>
          <Route element={<RequireRole roles={['admin']} loginPath="/login" />}>
            <Route element={<AdminShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="doctors" element={<DoctorsPage />} />
              <Route path="departments" element={<DepartmentsPage />} />
              <Route path="schedules" element={<SchedulesPage />} />
              <Route path="appointments" element={<AppointmentsPage />} />
              <Route path="patients" element={<PatientsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="agents" element={<AgentsPage />} />
              <Route path="agents/:agentId" element={<AgentsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
