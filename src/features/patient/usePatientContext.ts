import { todayIso } from '@/lib/clock';
import { useSession } from '@/features/auth/session';
import { useHousehold, usePatient } from '@/hooks/queries/directory';

/** The signed-in patient, their household and today's date. Only used under the patient route guards. */
export function usePatientContext() {
  const session = useSession();
  const patient = usePatient(session?.patientId);
  const household = useHousehold(patient.data?.householdId);
  return {
    session,
    userId: session?.userId ?? '',
    patient,
    household,
    householdIds: household.data?.map((p) => p.id) ?? (session?.patientId ? [session.patientId] : []),
    today: todayIso(),
  };
}
