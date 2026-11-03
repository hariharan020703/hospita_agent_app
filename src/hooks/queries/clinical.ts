// Triage rules and sessions, escalations, notifications and analytics.
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  analyticsService,
  escalationService,
  notificationService,
  queryKeys,
  triageService,
  type EscalationService,
} from '@/services';
import type { DateRange, Escalation, NewTriageSession, RedFlag, SymptomRule } from '@/types';

export const useTriageRules = () =>
  useQuery({ queryKey: queryKeys.triage.rules, queryFn: () => triageService.rules(), staleTime: 60_000 });

export const useTriageSession = (id: string | undefined) =>
  useQuery({
    queryKey: queryKeys.triage.detail(id ?? ''),
    queryFn: () => triageService.get(id ?? ''),
    enabled: Boolean(id),
  });

export function useSaveTriage() {
  return useMutation({
    mutationFn: (session: NewTriageSession) => triageService.save(session),
    meta: { silentError: true, invalidates: [queryKeys.escalations.all] },
  });
}

export const useSymptomRules = (departmentId?: string) =>
  useQuery({
    queryKey: queryKeys.triage.symptomRules(departmentId),
    queryFn: () => triageService.listSymptomRules(departmentId),
  });

export const useRedFlags = () =>
  useQuery({ queryKey: queryKeys.triage.redFlags, queryFn: () => triageService.listRedFlags() });

export function useRuleMutations() {
  const { t } = useTranslation();
  const meta = { success: t('toast.saved'), invalidates: [queryKeys.triage.all] };
  return {
    saveSymptomRule: useMutation({
      mutationFn: (rule: Omit<SymptomRule, 'id'> & { id?: string }) => triageService.saveSymptomRule(rule),
      meta,
    }),
    deleteSymptomRule: useMutation({ mutationFn: (id: string) => triageService.deleteSymptomRule(id), meta }),
    saveRedFlag: useMutation({
      mutationFn: (flag: Omit<RedFlag, 'id'> & { id?: string }) => triageService.saveRedFlag(flag),
      meta,
    }),
    deleteRedFlag: useMutation({ mutationFn: (id: string) => triageService.deleteRedFlag(id), meta }),
  };
}

export const useEscalations = (status?: Escalation['status']) =>
  useQuery({
    queryKey: queryKeys.escalations.list(status),
    queryFn: () => escalationService.list(status ? { status } : {}),
    refetchInterval: 30_000,
  });

export function useCreateEscalation() {
  return useMutation({
    mutationFn: (input: Parameters<EscalationService['create']>[0]) => escalationService.create(input),
    meta: { invalidates: [queryKeys.escalations.all] },
  });
}

export function useResolveEscalation() {
  const { t } = useTranslation('desk');
  return useMutation({
    mutationFn: ({ id, resolution, userId }: { id: string; resolution: string; userId: string }) =>
      escalationService.resolve(id, resolution, userId),
    meta: { success: t('escalations.resolvedToast'), invalidates: [queryKeys.escalations.all] },
  });
}

export const useNotifications = (userId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.notifications.list(userId ?? ''),
    queryFn: () => notificationService.list(userId ?? ''),
    enabled: Boolean(userId),
    refetchInterval: 30_000,
  });

export function useNotificationActions() {
  const meta = { silentError: true, invalidates: [queryKeys.notifications.all] };
  return {
    markRead: useMutation({ mutationFn: (id: string) => notificationService.markRead(id), meta }),
    markAllRead: useMutation({ mutationFn: (userId: string) => notificationService.markAllRead(userId), meta }),
  };
}

export const useDashboard = (range: DateRange) =>
  useQuery({
    queryKey: queryKeys.analytics.dashboard(range),
    queryFn: () => analyticsService.dashboard(range),
    placeholderData: keepPreviousData,
  });
