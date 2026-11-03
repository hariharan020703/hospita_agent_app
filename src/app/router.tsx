// Route map. Each app is a lazy chunk with its own layout, guards, error boundary and translations.
import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { HOME_BY_ROLE, useSession } from '@/features/auth/session';
import { NotFoundPage, UnauthorizedPage } from './pages/StatusPages';

const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const PatientApp = lazy(() => import('@/features/patient/PatientApp'));
const KioskApp = lazy(() => import('@/features/kiosk/KioskApp'));
const DeskApp = lazy(() => import('@/features/desk/DeskApp'));
const DoctorApp = lazy(() => import('@/features/doctor/DoctorApp'));
const AdminApp = lazy(() => import('@/features/admin/AdminApp'));

function RootRedirect() {
  const session = useSession();
  return <Navigate to={session ? HOME_BY_ROLE[session.role] : '/login'} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/app/*" element={<PatientApp />} />
      <Route path="/kiosk/*" element={<KioskApp />} />
      <Route path="/desk/*" element={<DeskApp />} />
      <Route path="/doctor/*" element={<DoctorApp />} />
      <Route path="/admin/*" element={<AdminApp />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
