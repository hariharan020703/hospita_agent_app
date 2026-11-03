// Queries and mutations for appointments, slots and the visit lifecycle.
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { appointmentService, queryKeys, type WalkInInput } from '@/services';
import type { AppointmentFilters, BookingInput, CancelReason } from '@/types';

const AFTER_VISIT_CHANGE = [
  queryKeys.appointments.all,
  queryKeys.queue.all,
  queryKeys.notifications.all,
  queryKeys.doctors.all,
];

export const useAppointments = (
  filters: AppointmentFilters,
  options: { enabled?: boolean; refetchInterval?: number } = {},
) =>
  useQuery({
    queryKey: queryKeys.appointments.list(filters),
    queryFn: () => appointmentService.list(filters),
    placeholderData: keepPreviousData,
    ...options,
  });

export const useAppointment = (id: string | undefined) =>
  useQuery({
    queryKey: queryKeys.appointments.detail(id ?? ''),
    queryFn: () => appointmentService.get(id ?? ''),
    enabled: Boolean(id),
  });

export const useAppointmentByRef = (ref: string | null) =>
  useQuery({
    queryKey: queryKeys.appointments.byRef(ref ?? ''),
    queryFn: () => appointmentService.getByRef(ref ?? ''),
    enabled: Boolean(ref),
    retry: false,
  });

export const useSlots = (doctorId: string | undefined, date: string | null) =>
  useQuery({
    queryKey: queryKeys.appointments.slots(doctorId ?? '', date ?? ''),
    queryFn: () => appointmentService.slots(doctorId ?? '', date ?? ''),
    enabled: Boolean(doctorId && date),
    staleTime: 10_000,
  });

export function useBookAppointment() {
  const { t } = useTranslation('patient');
  return useMutation({
    mutationFn: (input: BookingInput) => appointmentService.book(input),
    meta: { success: t('booking.booked'), invalidates: AFTER_VISIT_CHANGE },
  });
}

export function useRescheduleAppointment() {
  const { t } = useTranslation('patient');
  return useMutation({
    mutationFn: ({ id, date, start, by }: { id: string; date: string; start: string; by: 'patient' | 'staff' }) =>
      appointmentService.reschedule(id, { date, start }, by),
    meta: { success: t('appointment.rescheduled'), invalidates: AFTER_VISIT_CHANGE },
  });
}

export function useCancelAppointment() {
  const { t } = useTranslation('patient');
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: CancelReason }) => appointmentService.cancel(id, reason),
    meta: { success: t('appointment.cancelled'), invalidates: AFTER_VISIT_CHANGE },
  });
}

/**
 * Issues a same-day walk-in token (kiosk and front desk). Errors are not toasted: both screens explain them inline
 * (for example NO_SLOTS: "no doctor is free today").
 */
export function useIssueWalkIn() {
  return useMutation({
    mutationFn: (input: WalkInInput) => appointmentService.issueWalkIn(input),
    meta: { silentError: true, invalidates: AFTER_VISIT_CHANGE },
  });
}

/** Check-in, no-show, call next, complete, note, reassign and follow-ups share one invalidation set. */
export function useVisitActions() {
  const meta = { invalidates: AFTER_VISIT_CHANGE };
  return {
    checkIn: useMutation({ mutationFn: (id: string) => appointmentService.checkIn(id), meta }),
    markNoShow: useMutation({ mutationFn: (id: string) => appointmentService.markNoShow(id), meta }),
    callNext: useMutation({ mutationFn: (doctorId: string) => appointmentService.callNext(doctorId), meta }),
    complete: useMutation({
      mutationFn: ({ id, note }: { id: string; note?: string }) => appointmentService.complete(id, note),
      meta,
    }),
    addNote: useMutation({
      mutationFn: ({ id, note }: { id: string; note: string }) => appointmentService.addNote(id, note),
      meta,
    }),
    reassign: useMutation({
      mutationFn: ({ id, doctorId }: { id: string; doctorId: string }) => appointmentService.reassign(id, doctorId),
      meta,
    }),
    scheduleFollowUp: useMutation({
      mutationFn: ({ id, date, start }: { id: string; date: string; start: string }) =>
        appointmentService.scheduleFollowUp(id, { date, start }),
      meta,
    }),
  };
}
