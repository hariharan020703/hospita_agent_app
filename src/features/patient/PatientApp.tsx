// Patient app (/app/*): mobile-first, Tamil or English per the saved preference.
import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { FullPageSpinner } from '@/app/providers';
import { NotFoundPage } from '@/app/pages/StatusPages';
import { RequireRole } from '@/features/auth/RequireRole';
import { useSession } from '@/features/auth/session';
import { useAppLanguage, useTheme } from '@/hooks/useAppearance';
import { usePrefs } from '@/hooks/usePrefs';
import { PatientLayout } from './PatientLayout';

const WelcomePage = lazy(() => import('./pages/WelcomePage'));
const PatientLoginPage = lazy(() => import('./pages/PatientLoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const AssistantPage = lazy(() => import('./pages/AssistantPage'));
const EmergencyPage = lazy(() => import('./pages/EmergencyPage'));
const DoctorsPage = lazy(() => import('./pages/DoctorsPage'));
const DoctorProfilePage = lazy(() => import('./pages/DoctorProfilePage'));
const BookConfirmPage = lazy(() => import('./pages/BookConfirmPage'));
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage'));
const AppointmentDetailPage = lazy(() => import('./pages/AppointmentDetailPage'));
const QueuePage = lazy(() => import('./pages/QueuePage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const RecordsPage = lazy(() => import('./pages/RecordsPage'));
const CarePage = lazy(() => import('./pages/CarePage'));

/** First launch: choose a language before anything else. */
function NeedsLanguage() {
  const patientLang = usePrefs((s) => s.patientLang);
  const location = useLocation();
  if (!patientLang)
    return <Navigate to={`/app/welcome?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <Outlet />;
}

/** Signed in but no patient record yet: complete registration and consent first. */
function NeedsRegistration() {
  const session = useSession();
  if (!session?.patientId) return <Navigate to="/app/register" replace />;
  return <Outlet />;
}

export default function PatientApp() {
  const patientLang = usePrefs((s) => s.patientLang);
  useAppLanguage(patientLang ?? 'ta');
  useTheme();
  return (
    <ErrorBoundary name="patient">
      <Suspense fallback={<FullPageSpinner />}>
        <Routes>
          <Route path="welcome" element={<WelcomePage />} />
          <Route element={<NeedsLanguage />}>
            <Route path="login" element={<PatientLoginPage />} />
            <Route element={<RequireRole roles={['patient']} loginPath="/app/login" />}>
              <Route path="register" element={<RegisterPage />} />
              <Route element={<NeedsRegistration />}>
                <Route element={<PatientLayout />}>
                  <Route index element={<HomePage />} />
                  <Route path="assistant" element={<AssistantPage />} />
                  <Route path="emergency" element={<EmergencyPage />} />
                  <Route path="doctors" element={<DoctorsPage />} />
                  <Route path="doctors/:doctorId" element={<DoctorProfilePage />} />
                  <Route path="book/:doctorId" element={<BookConfirmPage />} />
                  <Route path="appointments" element={<AppointmentsPage />} />
                  <Route path="appointments/:id" element={<AppointmentDetailPage />} />
                  <Route path="queue/:id" element={<QueuePage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="records" element={<RecordsPage />} />
                  <Route path="care" element={<CarePage />} />
                  <Route path="care/:planId" element={<CarePage />} />
                </Route>
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
