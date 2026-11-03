// Agent settings, the activity log and the admin overview. Conversations run through useAssistant
// (features/assistant); records, notes and care plans have their own hooks below.
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { agentService, queryKeys } from '@/services';
import type { AgentId, ConsultationNote, DoseSlot, Extraction, HumanDecision, RecordUpload } from '@/types';

export const useAgentSettings = () =>
  useQuery({ queryKey: queryKeys.agents.settings, queryFn: () => agentService.admin.settings(), staleTime: 10_000 });

/** Whether an agent is switched on; `undefined` while loading. */
export function useAgentActive(id: AgentId): boolean | undefined {
  const settings = useAgentSettings();
  return settings.data ? settings.data[id] !== false : undefined;
}

export const useAgentOverview = () =>
  useQuery({
    queryKey: queryKeys.agents.overview,
    queryFn: () => agentService.admin.overview(),
    refetchInterval: 15_000,
  });

export const useAgentActivity = (filter: { agentId?: AgentId; limit?: number } = {}) =>
  useQuery({
    queryKey: queryKeys.agents.activity(filter),
    queryFn: () => agentService.admin.activity(filter),
    refetchInterval: 10_000,
  });

/** Pause or resume an agent. The caller shows the toast, since it knows the agent's name. */
export function useSetAgentActive() {
  return useMutation({
    mutationFn: ({ id, active }: { id: AgentId; active: boolean }) => agentService.admin.setActive(id, active),
    meta: { invalidates: [queryKeys.agents.all] },
  });
}

export function useDecideActivity() {
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: HumanDecision }) => agentService.admin.decide(id, decision),
    meta: { silentError: true, invalidates: [queryKeys.agents.all] },
  });
}

// ------------------------------------------------------------------ medical records agent

export const useRecordSamples = () =>
  useQuery({ queryKey: queryKeys.agents.samples, queryFn: () => agentService.records.samples(), staleTime: Infinity });

export const useRecords = (patientIds: string[]) =>
  useQuery({
    queryKey: queryKeys.agents.records(patientIds),
    queryFn: () => agentService.records.list(patientIds),
    enabled: patientIds.length > 0,
  });

export const useRecord = (id: string | undefined) =>
  useQuery({
    queryKey: queryKeys.agents.record(id ?? ''),
    queryFn: () => agentService.records.get(id ?? ''),
    enabled: Boolean(id),
  });

/** Reading a document; failures are shown inline on the upload screen. */
export function useExtractRecord() {
  return useMutation({
    mutationFn: (upload: RecordUpload) => agentService.records.extract(upload),
    meta: { silentError: true, invalidates: [queryKeys.agents.all] },
  });
}

export function useSaveRecord() {
  const { t } = useTranslation('patient');
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: Extraction }) => agentService.records.save(id, values),
    meta: { success: t('records.saved'), invalidates: [queryKeys.agents.all] },
  });
}

export function useDeleteRecord() {
  const { t } = useTranslation('patient');
  return useMutation({
    mutationFn: (id: string) => agentService.records.remove(id),
    meta: { success: t('records.deleted'), invalidates: [queryKeys.agents.all] },
  });
}

export const usePreVisitSummary = (appointmentId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.agents.summary(appointmentId ?? ''),
    queryFn: () => agentService.records.preVisitSummary(appointmentId ?? ''),
    enabled: Boolean(appointmentId),
  });

// ------------------------------------------------------------------ consultation scribe

export const useConsultationNote = (appointmentId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.agents.note(appointmentId ?? ''),
    queryFn: () => agentService.scribe.note(appointmentId ?? ''),
    enabled: Boolean(appointmentId),
  });

export function useScribeListen() {
  return useMutation({ mutationFn: (appointmentId: string) => agentService.scribe.listen(appointmentId) });
}

export function useDraftNote() {
  return useMutation({
    mutationFn: ({ appointmentId, heard }: { appointmentId: string; heard: number }) =>
      agentService.scribe.draft(appointmentId, heard),
    meta: { invalidates: [queryKeys.agents.all] },
  });
}

export function useSaveNoteDraft() {
  const { t } = useTranslation('doctor');
  return useMutation({
    mutationFn: (note: ConsultationNote) => agentService.scribe.saveDraft(note),
    meta: { success: t('scribe.draftSaved'), invalidates: [queryKeys.agents.all] },
  });
}

/** Signing toasts in the caller (it names the patient and whether a care plan went out). */
export function useSignNote() {
  return useMutation({
    mutationFn: ({ note, userId }: { note: ConsultationNote; userId: string }) =>
      agentService.scribe.sign(note, userId),
    meta: {
      invalidates: [queryKeys.agents.all, queryKeys.appointments.all, queryKeys.notifications.all, queryKeys.queue.all],
    },
  });
}

export function useDiscardNote() {
  const { t } = useTranslation('doctor');
  return useMutation({
    mutationFn: (noteId: string) => agentService.scribe.discard(noteId),
    meta: { success: t('scribe.discarded'), invalidates: [queryKeys.agents.all] },
  });
}

// ------------------------------------------------------------------ care companion

export const useCarePlans = (patientIds: string[], enabled = true) =>
  useQuery({
    queryKey: queryKeys.agents.plans(patientIds),
    queryFn: () => agentService.care.plans(patientIds),
    enabled: enabled && patientIds.length > 0,
  });

export const useCarePlan = (id: string | undefined) =>
  useQuery({
    queryKey: queryKeys.agents.plan(id ?? ''),
    queryFn: () => agentService.care.plan(id ?? ''),
    enabled: Boolean(id),
  });

export const useCareMessages = (planId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.agents.careMessages(planId ?? ''),
    queryFn: () => agentService.care.messages(planId ?? ''),
    enabled: Boolean(planId),
  });

/** A question or check-in reply; errors are shown inline in the chat. */
export function useAskCare() {
  return useMutation({
    mutationFn: ({ planId, text }: { planId: string; text: string }) => agentService.care.ask(planId, text),
    meta: { silentError: true, invalidates: [queryKeys.agents.all, queryKeys.notifications.all] },
  });
}

export function useMarkDose() {
  return useMutation({
    mutationFn: ({
      planId,
      dose,
      taken,
    }: {
      planId: string;
      dose: { medicineId: string; slot: DoseSlot; date: string };
      taken: boolean;
    }) => agentService.care.markDose(planId, dose, taken),
    meta: { invalidates: [queryKeys.agents.all] },
  });
}

export function useSimulateCheckIn() {
  const { t } = useTranslation('patient');
  return useMutation({
    mutationFn: ({ planId, day }: { planId: string; day: number }) => agentService.care.simulateCheckIn(planId, day),
    meta: { success: t('care.checkIn.sent'), invalidates: [queryKeys.agents.all, queryKeys.notifications.all] },
  });
}

export const useDoctorFollowUps = (doctorId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.agents.followUps(doctorId ?? ''),
    queryFn: () => agentService.care.followUps(doctorId ?? ''),
    enabled: Boolean(doctorId),
    refetchInterval: 15_000,
  });

export function useReplyQuery() {
  const { t } = useTranslation('doctor');
  return useMutation({
    mutationFn: ({ id, text, userId }: { id: string; text: string; userId: string }) =>
      agentService.care.reply(id, text, userId),
    meta: { success: t('followUps.replied'), invalidates: [queryKeys.agents.all] },
  });
}

export function useAcknowledgeQuery() {
  const { t } = useTranslation('doctor');
  return useMutation({
    mutationFn: (id: string) => agentService.care.acknowledge(id),
    meta: { success: t('followUps.acknowledged'), invalidates: [queryKeys.agents.all] },
  });
}
