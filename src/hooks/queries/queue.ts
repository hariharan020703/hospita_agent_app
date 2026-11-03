// Live queue queries poll as a fallback; with mock data, changes from other tabs also refetch them instantly.
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryKeys, queueService } from '@/services';
import type { DoctorStatus } from '@/types';

const LIVE = 15_000;

export const useQueueEstimate = (appointmentId: string | undefined, travelMins?: number) =>
  useQuery({
    queryKey: queryKeys.queue.estimate(appointmentId ?? '', travelMins),
    queryFn: () => queueService.estimate(appointmentId ?? '', travelMins),
    enabled: Boolean(appointmentId),
    refetchInterval: LIVE,
  });

export const useDoctorQueue = (doctorId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.queue.doctor(doctorId ?? ''),
    queryFn: () => queueService.doctorQueue(doctorId ?? ''),
    enabled: Boolean(doctorId),
    refetchInterval: LIVE,
  });

export const useQueueBoard = () =>
  useQuery({ queryKey: queryKeys.queue.board, queryFn: () => queueService.board(), refetchInterval: LIVE });

export const useDoctorDay = (doctorId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.queue.day(doctorId ?? ''),
    queryFn: () => queueService.getDoctorDay(doctorId ?? ''),
    enabled: Boolean(doctorId),
  });

export function useSetDoctorStatus() {
  return useMutation({
    mutationFn: ({
      doctorId,
      status,
      delayMins,
      breakMins,
    }: {
      doctorId: string;
      status: DoctorStatus;
      delayMins?: number;
      breakMins?: number;
    }) =>
      queueService.setDoctorStatus(doctorId, {
        status,
        ...(delayMins !== undefined ? { delayMins } : {}),
        ...(breakMins !== undefined ? { breakMins } : {}),
      }),
    meta: { invalidates: [queryKeys.queue.all, queryKeys.notifications.all] },
  });
}
