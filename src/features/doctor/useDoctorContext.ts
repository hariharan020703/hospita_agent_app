import { useSession } from '@/features/auth/session';
import { todayIso } from '@/lib/clock';

/** The signed-in doctor's id and today's date. Only used under the doctor route guards. */
export function useDoctorContext() {
  const session = useSession();
  return { session, doctorId: session?.doctorId ?? '', today: todayIso() };
}
