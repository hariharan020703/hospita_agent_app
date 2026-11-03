// Doctor app (/doctor/*): today's queue and consultations, patient follow-ups from the care companion, weekly
// schedule and leave, patients seen, settings.
import { lazy, Suspense } from 'react';
import { Outlet, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, HeartPulse, Settings, Stethoscope, UserX, Users } from 'lucide-react';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { StaffLayout } from '@/app/layouts/StaffLayout';
import { NotFoundPage } from '@/app/pages/StatusPages';
import { FullPageSpinner } from '@/app/providers';
import { EmptyState, type NavItem } from '@/components/ui';
import { RequireRole } from '@/features/auth/RequireRole';
import { useAgentActive, useDoctorFollowUps } from '@/hooks/queries/agents';
import { useAppLanguage, useTheme } from '@/hooks/useAppearance';
import { useDoctorContext } from './useDoctorContext';

const TodayPage = lazy(() => import('./pages/TodayPage'));
const SchedulePage = lazy(() => import('./pages/SchedulePage'));
const PatientsPage = lazy(() => import('./pages/PatientsPage'));
const PatientDetailPage = lazy(() => import('./pages/PatientDetailPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const FollowUpsPage = lazy(() => import('./pages/FollowUpsPage'));

/** Staff shell with the doctor's navigation. Kept separate so the app entry never waits for the doctor texts. */
function DoctorShell() {
  const { t } = useTranslation('doctor');
  const { doctorId } = useDoctorContext();
  // The follow-ups list belongs to the care companion: hidden while that agent is paused.
  const careOn = useAgentActive('care');
  const followUps = useDoctorFollowUps(careOn ? doctorId : undefined);
  const open = followUps.data?.filter((q) => q.status === 'open').length;
  const nav: NavItem[] = [
    { to: '/doctor', label: t('nav.today'), icon: Stethoscope, end: true },
    ...(careOn ? [{ to: '/doctor/follow-ups', label: t('nav.followUps'), icon: HeartPulse, badge: open }] : []),
    { to: '/doctor/schedule', label: t('nav.schedule'), icon: CalendarDays },
    { to: '/doctor/patients', label: t('nav.patients'), icon: Users },
    { to: '/doctor/settings', label: t('nav.settings'), icon: Settings },
  ];
  return <StaffLayout appName={t('appName')} nav={nav} />;
}

/** A doctor account must be linked to a doctor profile before any page can load data. */
function NeedsDoctorProfile() {
  const { t } = useTranslation('doctor');
  const { doctorId } = useDoctorContext();
  if (!doctorId) return <EmptyState icon={UserX} title={t('noProfile.title')} body={t('noProfile.body')} />;
  return <Outlet />;
}

export default function DoctorApp() {
  // Staff apps are English only (Tamil is offered in the patient app and kiosk).
  useAppLanguage('en');
  useTheme();
  return (
    <ErrorBoundary name="doctor">
      <Suspense fallback={<FullPageSpinner />}>
        <Routes>
          <Route element={<RequireRole roles={['doctor']} loginPath="/login" />}>
            <Route element={<DoctorShell />}>
              <Route element={<NeedsDoctorProfile />}>
                <Route index element={<TodayPage />} />
                <Route path="schedule" element={<SchedulePage />} />
                <Route path="patients" element={<PatientsPage />} />
                <Route path="patients/:patientId" element={<PatientDetailPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="follow-ups" element={<FollowUpsPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
