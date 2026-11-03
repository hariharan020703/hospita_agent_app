import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '@/types';
import { useSession } from './session';

/** Route guard: no session -> sign-in page (remembering where to return); wrong role -> /unauthorized. */
export function RequireRole({ roles, loginPath }: { roles: readonly Role[]; loginPath: string }) {
  const session = useSession();
  const location = useLocation();
  if (!session) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`${loginPath}?next=${next}`} replace />;
  }
  if (!roles.includes(session.role)) return <Navigate to="/unauthorized" replace />;
  return <Outlet />;
}
