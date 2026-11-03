// The orchestrator: single entry point for patient and kiosk conversations. Every message goes through the safety
// layer (warning signs -> emergency with booking blocked; medicine-dose questions -> refused), then intent
// detection (free Tamil, English or Tanglish), then one agent or a tool, then the output check (no diagnosis
// wording). Each outcome is written to the activity log with its trail.
import { assessTriage, LOW_CONFIDENCE } from '@/features/triage/assessment';
import {
  appendAssistantMessage,
  expandSynonyms,
  mentionsAny,
  SAFETY_SCREEN_FLAG,
  scoreDepartments,
  toTriageSession,
  triageStep,
  type TriageRules,
} from '@/features/triage/engine';
import { newId } from '@/lib/id';
import { now } from '@/lib/clock';
import { addDaysIso, ageFromBirthYear } from '@/lib/time';
import type {
  ActivityActor,
  AgentText,
  AppointmentView,
  ChatAction,
  ChatCommand,
  ChatMessage,
  ConversationInput,
  ConversationReply,
  ConversationStart,
  ConversationStatus,
  Department,
  DoctorOption,
  EscalationReason,
  Intent,
  TrailStep,
  TriageResult,
} from '@/types';
import { errorCodeOf, ServiceError } from '../../errors';
import type { OrchestratorApi, Services } from '../../types';
import { today } from '../core';
import { getDb, type DbStore } from '../db';
import { agentData, type AgentData } from './data';
import { renderText } from './render';
import { checkReply, isMedicineQuestion, redFlagIn } from './safety';
import { isAgentActive, logActivity, orchestratorStep, phrases, say, setDecision, step, think } from './shared';
import { createTools, toDoctorOption, type AgentTools } from './tools';
import { newTriage, questionText, quickReplies, withStaticRules, type PatientProfileFacts } from './triageAgent';

interface Conversation {
  id: string;
  channel: ConversationStart['channel'];
  lang: ConversationStart['lang'];
  patientId?: string;
  userId?: string;
  triage: ReturnType<typeof newTriage>;
  /** Everything the patient has typed or said, for the warning-sign check. */
  said: string[];
  result: TriageResult | null;
  outcome: ConversationStatus['outcome'];
  redFlagId: string | null;
  blocked: boolean;
  profile: PatientProfileFacts | null;
  /** Tool steps since the last outcome, shown in the next trail. */
  pendingSteps: TrailStep[];
  booking: { options: DoctorOption[]; doctor: DoctorOption | null } | null;
  reschedule: { appointment: AppointmentView; doctor: DoctorOption } | null;
  cancelTarget: AppointmentView | null;
  confirming: 'booking' | 'reschedule' | 'cancel' | null;
}

/** Requests that interrupt a symptom conversation; anything else is read as an answer to the question asked. */
const INTERRUPTING: ReadonlySet<Intent> = new Set(['human', 'queue_status', 'reschedule', 'cancel', 'my_appointments']);
const INTENT_ORDER: readonly Intent[] = [
  'human',
  'queue_status',
  'reschedule',
  'cancel',
  'my_appointments',
  'book',
  'thanks',
  'greeting',
];

const message = (parts: Omit<ChatMessage, 'id' | 'from'>): ChatMessage => ({
  id: newId('msg'),
  from: 'assistant',
  ...parts,
});
const action = (id: string, label: string, command: ChatCommand, tone?: ChatAction['tone']): ChatAction => ({
  id,
  label: say(label),
  command,
  ...(tone ? { tone } : {}),
});

export function createOrchestrator(services: Services): OrchestratorApi {
  const conversations = new Map<string, Conversation>();
  const tools: AgentTools = createTools(services);

  const actorOf = (c: Conversation): ActivityActor => (c.channel === 'kiosk' ? 'kiosk' : 'patient');
  const who = (c: Conversation) => ({
    actor: actorOf(c),
    ...(c.userId ? { userId: c.userId } : {}),
    ...(c.patientId ? { patientId: c.patientId } : {}),
  });

  async function rulesFor(data: AgentData): Promise<TriageRules> {
    return withStaticRules(await services.triage.rules(), data);
  }

  async function departmentOf(id: string): Promise<Department | undefined> {
    return (await services.departments.list()).find((d) => d.id === id);
  }

  async function profileOf(c: Conversation) {
    if (!c.patientId) return null;
    const profile = await tools.getPatientProfile(c.patientId);
    c.profile = {
      name: profile.patient.name,
      age: ageFromBirthYear(profile.patient.birthYear, now()),
      conditions: profile.patient.conditions,
    };
    return profile;
  }

  function status(c: Conversation): ConversationStatus {
    return {
      outcome: c.outcome,
      departmentId: c.result?.departmentId ?? null,
      redFlagId: c.redFlagId,
      triageId: c.result?.triageId ?? null,
      blocked: c.blocked,
      age: c.triage.answers.age ?? null,
      reason: c.triage.symptomText[0]?.slice(0, 200) ?? null,
    };
  }

  function greeting(c: Conversation): ChatMessage {
    const firstName = c.profile?.name.split(' ')[0];
    return message({
      say: [firstName ? say('triage:orchestrator.greetingName', { name: firstName }) : say('triage:greeting')],
      ...(c.channel === 'app'
        ? {
            actions: [
              { id: 'q_wait', label: say('triage:orchestrator.suggest.wait'), command: { type: 'reply' } },
              { id: 'q_appts', label: say('triage:orchestrator.suggest.appointments'), command: { type: 'reply' } },
            ],
          }
        : {}),
    });
  }

  function fresh(c: Conversation): void {
    c.triage = newTriage(c.lang);
    c.said = [];
    c.result = null;
    c.outcome = 'ongoing';
    c.redFlagId = null;
    c.blocked = false;
    c.pendingSteps = [];
    c.booking = null;
    c.reschedule = null;
    c.cancelTarget = null;
    c.confirming = null;
  }

  // ------------------------------------------------------------------ outcomes

  async function saveTriage(c: Conversation, extra: { urgency?: TriageResult['urgency']; confidence?: number } = {}) {
    const record = toTriageSession(c.triage, {
      channel: c.channel,
      ...(c.patientId ? { patientId: c.patientId } : {}),
    });
    if (!record) return null;
    return services.triage.save({ ...record, ...extra });
  }

  /** The assistant's words, kept in the saved conversation in the patient's language. */
  function remember(c: Conversation, texts: AgentText[]): void {
    c.triage = appendAssistantMessage(c.triage, texts.map((t) => renderText(t, c.lang)).join(' '));
  }

  async function emergency(
    db: DbStore,
    c: Conversation,
    redFlagId: string,
    rules: TriageRules,
  ): Promise<ChatMessage[]> {
    c.blocked = true;
    c.outcome = 'emergency';
    c.redFlagId = redFlagId;
    const flag = rules.redFlags.find((f) => f.id === redFlagId);
    const label = flag ? flag.label : say('triage:emergency.safetyAnswer');
    const reply = [say('triage:reply.emergency')];
    if (c.triage.messages.some((m) => m.from === 'patient')) {
      c.triage = { ...c.triage, pending: null, outcome: 'emergency', redFlagId };
      remember(c, reply);
      await saveTriage(c, { urgency: 'emergency' });
    }
    const trail = [
      orchestratorStep('symptoms'),
      step('safety', 'redFlags', say('triage:trail.redFlag', { flag: label }), false),
      step('safety', 'booking', say('triage:trail.bookingBlocked'), false),
    ];
    logActivity(db, {
      agentId: 'triage',
      ...who(c),
      intent: 'emergency',
      steps: trail,
      summary: say('admin:agents.summary.emergency', { flag: label }),
      decision: 'none',
    });
    return [message({ say: reply, card: { kind: 'emergency', redFlagId }, trail })];
  }

  async function escalated(
    db: DbStore,
    c: Conversation,
    reason: EscalationReason,
    saved: boolean,
  ): Promise<ChatMessage[]> {
    c.outcome = 'escalated';
    const reply = [say('triage:reply.escalated')];
    if (!saved) {
      await services.escalations.create({
        reason,
        channel: c.channel,
        summary: c.said.join(' · ').slice(0, 500) || '—',
        ...(c.patientId ? { patientId: c.patientId } : {}),
        ...(c.result?.triageId ? { triageId: c.result.triageId } : {}),
      });
    }
    setDecision(db, c.result?.activityId, 'dismissed');
    const trail = [orchestratorStep('human'), step('agent', 'triage', say('triage:trail.escalated'))];
    logActivity(db, {
      agentId: 'triage',
      ...who(c),
      intent: 'human',
      steps: trail,
      summary: say('admin:agents.summary.human'),
      decision: 'none',
    });
    return [message({ say: reply, card: { kind: 'escalated', reason }, trail })];
  }

  async function recommend(
    db: DbStore,
    c: Conversation,
    rules: TriageRules,
    departmentId: string,
  ): Promise<ChatMessage[]> {
    const department = await departmentOf(departmentId);
    const assessment = assessTriage(c.triage, rules, { conditions: c.profile?.conditions ?? [] });
    const name = department?.name ?? { en: departmentId, ta: departmentId };
    const reply = [say('triage:reply.recommendation', { department: name })];
    remember(c, reply);
    const saved = await saveTriage(c, { urgency: assessment.urgency, confidence: assessment.confidence });
    const urgency = say(`triage:urgency.${assessment.urgency}`);
    const trail = [
      orchestratorStep('symptoms'),
      step('safety', 'redFlags', say('triage:trail.safetyClear')),
      ...c.pendingSteps,
      step(
        'agent',
        'triage',
        say('triage:trail.result', { department: name, urgency, confidence: assessment.confidence }),
      ),
    ];
    c.pendingSteps = [];
    const activity = logActivity(db, {
      agentId: 'triage',
      ...who(c),
      intent: 'symptoms',
      steps: trail,
      summary: say('admin:agents.summary.symptoms', { department: name, urgency }),
      confidence: assessment.confidence,
      decision: 'pending',
      ...(saved ? { ref: { kind: 'triage', id: saved.id } } : {}),
    });
    c.result = {
      departmentId,
      urgency: assessment.urgency,
      confidence: assessment.confidence,
      reasons: assessment.reasons,
      ...(saved ? { triageId: saved.id } : {}),
      activityId: activity.id,
    };
    c.outcome = 'recommended';
    const low = assessment.confidence < LOW_CONFIDENCE;
    const actions: ChatAction[] =
      c.channel === 'kiosk'
        ? [action('token', 'triage:orchestrator.actions.getToken', { type: 'book' }, 'primary')]
        : [
            action('book', 'triage:orchestrator.actions.book', { type: 'book' }, 'primary'),
            action('choose', 'triage:orchestrator.actions.chooseDoctor', {
              type: 'open',
              to: `/app/doctors?dept=${departmentId}${saved ? `&triage=${saved.id}` : ''}`,
            }),
          ];
    if (low) actions.push(action('desk', 'triage:orchestrator.actions.frontDesk', { type: 'escalate' }, 'primary'));
    return [
      message({
        say: [
          ...reply,
          say(
            low
              ? 'triage:orchestrator.lowConfidence'
              : c.channel === 'kiosk'
                ? 'triage:orchestrator.offerToken'
                : 'triage:orchestrator.offerBooking',
          ),
        ],
        card: { kind: 'triage_result', result: c.result },
        actions,
        trail,
      }),
    ];
  }

  async function runTriage(db: DbStore, c: Conversation, text: string, voice: boolean, rules: TriageRules) {
    if (!isAgentActive(db, 'triage')) {
      return [
        message({
          say: [say('triage:orchestrator.triagePaused')],
          card: { kind: 'department_picker' },
          trail: [orchestratorStep('symptoms'), step('agent', 'triage', say('triage:trail.departments'), false)],
        }),
      ];
    }
    if (c.triage.outcome !== 'ongoing') {
      // A new complaint after a finished one starts a fresh assessment.
      const said = c.said;
      fresh(c);
      c.said = said;
    }
    const turn = triageStep(c.triage, text, rules, voice);
    if (!turn) return [];
    c.triage = turn.state;
    const reply = turn.reply;
    switch (reply.kind) {
      case 'question': {
        if ((c.triage.pending === 'age' || c.triage.pending === 'conditions') && c.patientId && !c.profile) {
          const profile = await profileOf(c);
          if (profile) c.pendingSteps.push(profile.step);
        }
        const texts = questionText(reply, rules);
        remember(c, texts);
        return [message({ say: texts, actions: quickReplies(c.triage, rules, c.profile) })];
      }
      case 'recommendation':
        return recommend(db, c, rules, reply.departmentId);
      case 'emergency':
        return emergency(db, c, reply.redFlagId === SAFETY_SCREEN_FLAG ? SAFETY_SCREEN_FLAG : reply.redFlagId, rules);
      case 'escalated': {
        remember(c, [say('triage:reply.escalated')]);
        await saveTriage(c);
        return escalated(db, c, reply.reason, true);
      }
    }
  }

  // ------------------------------------------------------------------ tools-backed intents

  async function startBooking(c: Conversation): Promise<ChatMessage[]> {
    if (c.blocked && c.redFlagId) {
      return [
        message({
          say: [say('triage:orchestrator.bookingBlocked')],
          card: { kind: 'emergency', redFlagId: c.redFlagId },
        }),
      ];
    }
    if (!c.result) {
      return [
        message({
          say: [say('triage:orchestrator.bookNeedsSymptoms')],
          ...(c.channel === 'app'
            ? {
                actions: [
                  action('doctors', 'triage:orchestrator.actions.browseDoctors', { type: 'open', to: '/app/doctors' }),
                ],
              }
            : {}),
        }),
      ];
    }
    const department = await departmentOf(c.result.departmentId);
    const name = department?.name ?? { en: c.result.departmentId, ta: c.result.departmentId };
    const { options, step: found } = await tools.searchDoctors(c.result.departmentId, name, c.lang);
    c.booking = { options, doctor: null };
    const trail = [orchestratorStep('book'), found];
    if (options.length === 0) {
      return [
        message({
          say: [say('triage:orchestrator.noDoctors', { department: name })],
          actions: [action('desk', 'triage:orchestrator.actions.frontDesk', { type: 'escalate' })],
          trail,
        }),
      ];
    }
    return [
      message({
        say: [say('triage:orchestrator.pickDoctor', { department: name })],
        card: { kind: 'doctor_options', options },
        trail,
      }),
    ];
  }

  function confirmBooking(c: Conversation, doctor: DoctorOption): ChatMessage[] {
    c.confirming = 'booking';
    return [
      message({
        say: [say('triage:orchestrator.confirmBooking')],
        card: { kind: 'confirm_booking', doctor },
        actions: [
          action('confirm', 'triage:orchestrator.actions.confirmBooking', { type: 'confirm' }, 'primary'),
          action('times', 'triage:orchestrator.actions.otherTimes', { type: 'other_times' }),
        ],
      }),
    ];
  }

  async function otherTimes(c: Conversation): Promise<ChatMessage[]> {
    const doctor = c.reschedule?.doctor ?? c.booking?.doctor;
    if (!doctor) return startBooking(c);
    const except = c.reschedule ? c.reschedule.appointment.start : undefined;
    let date = doctor.date;
    let { starts, step: slots } = await tools.getSlots(doctor.doctorId, date, except);
    if (starts.length === 0) {
      date = addDaysIso(date, 1);
      ({ starts, step: slots } = await tools.getSlots(doctor.doctorId, date));
    }
    return [
      message({
        say: [say(starts.length ? 'triage:orchestrator.pickTime' : 'triage:orchestrator.noTimes')],
        card: { kind: 'slots', doctor, date, starts: starts.slice(0, 9) },
        trail: [orchestratorStep(c.reschedule ? 'reschedule' : 'book'), slots],
      }),
    ];
  }

  async function confirm(db: DbStore, c: Conversation): Promise<ChatMessage[]> {
    const what = c.confirming;
    c.confirming = null;
    if (what === 'booking' && c.booking?.doctor && c.patientId) {
      const doctor = c.booking.doctor;
      const reason = c.triage.symptomText[0]?.slice(0, 200);
      try {
        const { appointment, step: booked } = await tools.bookAppointment({
          patientId: c.patientId,
          doctorId: doctor.doctorId,
          date: doctor.date,
          start: doctor.start,
          source: 'app',
          ...(c.result?.triageId ? { triageId: c.result.triageId } : {}),
          ...(reason ? { reason } : {}),
        });
        c.outcome = 'booked';
        setDecision(db, c.result?.activityId, 'accepted');
        const trail = [orchestratorStep('book'), booked];
        logActivity(db, {
          agentId: 'orchestrator',
          ...who(c),
          intent: 'book',
          steps: trail,
          summary: say('admin:agents.summary.book', { token: appointment.token, doctor: `Dr. ${doctor.name}` }),
          decision: 'accepted',
          ref: { kind: 'appointment', id: appointment.id },
        });
        const actions = [
          action(
            'track',
            'triage:orchestrator.actions.trackQueue',
            { type: 'open', to: `/app/queue/${appointment.id}` },
            'primary',
          ),
        ];
        if (isAgentActive(db, 'records')) {
          actions.push(
            action('records', 'triage:orchestrator.actions.uploadRecords', { type: 'open', to: '/app/records' }),
          );
        }
        return [
          message({
            say: [say('triage:orchestrator.booked', { token: appointment.token })],
            card: {
              kind: 'booked',
              appointmentId: appointment.id,
              token: appointment.token,
              doctor,
              bookingRef: appointment.bookingRef,
            },
            actions,
            trail,
          }),
        ];
      } catch (error) {
        const code = errorCodeOf(error);
        if (code === 'NETWORK') throw error;
        if (code === 'PATIENT_BUSY') return [message({ say: [say('triage:orchestrator.patientBusy')] })];
        return [message({ say: [say('triage:orchestrator.slotGone')] }), ...(await otherTimes(c))];
      }
    }
    if (what === 'reschedule' && c.reschedule) {
      const { appointment, doctor } = c.reschedule;
      try {
        const { appointment: moved, step: done } = await tools.rescheduleAppointment(
          appointment.id,
          doctor.date,
          doctor.start,
        );
        c.reschedule = null;
        const trail = [orchestratorStep('reschedule'), done];
        logActivity(db, {
          agentId: 'orchestrator',
          ...who(c),
          intent: 'reschedule',
          steps: trail,
          summary: say('admin:agents.summary.reschedule', { token: moved.token, date: moved.date, time: moved.start }),
          decision: 'accepted',
          ref: { kind: 'appointment', id: moved.id },
        });
        return [
          message({
            say: [say('triage:orchestrator.rescheduled', { date: moved.date, time: moved.start, token: moved.token })],
            actions: [
              action('open', 'triage:orchestrator.actions.viewAppointment', {
                type: 'open',
                to: `/app/appointments/${moved.id}`,
              }),
            ],
            trail,
          }),
        ];
      } catch (error) {
        const code = errorCodeOf(error);
        if (code === 'NETWORK') throw error;
        return [
          message({
            say: [say(code === 'TOO_LATE' ? 'triage:orchestrator.tooLateToChange' : 'triage:orchestrator.slotGone')],
          }),
        ];
      }
    }
    if (what === 'cancel' && c.cancelTarget) {
      const target = c.cancelTarget;
      c.cancelTarget = null;
      const { appointment, step: done } = await tools.cancelAppointment(target.id);
      const trail = [orchestratorStep('cancel'), done];
      logActivity(db, {
        agentId: 'orchestrator',
        ...who(c),
        intent: 'cancel',
        steps: trail,
        summary: say('admin:agents.summary.cancel', { token: appointment.token }),
        decision: 'accepted',
        ref: { kind: 'appointment', id: appointment.id },
      });
      return [message({ say: [say('triage:orchestrator.cancelled', { token: appointment.token })], trail })];
    }
    return [message({ say: [say('triage:orchestrator.nothingToConfirm')] })];
  }

  async function queueStatus(db: DbStore, c: Conversation): Promise<ChatMessage[]> {
    if (c.channel === 'kiosk' || !c.patientId) return [message({ say: [say('triage:orchestrator.kioskQueue')] })];
    const profile = await profileOf(c);
    if (!profile) return [];
    const todays = profile.upcoming.filter((a) => a.date === today());
    const trail = [orchestratorStep('queue_status'), profile.step];
    const appointment = todays[0];
    if (!appointment) {
      const next = profile.upcoming[0];
      return [
        message({
          say: [
            say('triage:orchestrator.noAppointmentToday'),
            ...(next
              ? [
                  say('triage:orchestrator.nextAppointment', {
                    date: next.date,
                    time: next.start,
                    doctor: next.doctorName,
                  }),
                ]
              : []),
          ],
          trail,
        }),
      ];
    }
    const { estimate, step: queued } = await tools.getQueueStatus(appointment);
    trail.push(queued);
    logActivity(db, {
      agentId: 'orchestrator',
      ...who(c),
      intent: 'queue_status',
      steps: trail,
      summary: say('admin:agents.summary.queue_status', { token: appointment.token }),
      decision: 'none',
      ref: { kind: 'appointment', id: appointment.id },
    });
    return [
      message({
        say: [
          say('triage:orchestrator.queueStatus', {
            token: appointment.token,
            count: estimate.patientsAhead,
            time: estimate.expectedStart,
          }),
          ...(estimate.leaveBy ? [say('triage:orchestrator.leaveBy', { time: estimate.leaveBy })] : []),
        ],
        card: {
          kind: 'queue_status',
          appointmentId: appointment.id,
          token: appointment.token,
          doctorName: appointment.doctorName,
          ...(appointment.doctorNameTa ? { doctorNameTa: appointment.doctorNameTa } : {}),
          patientsAhead: estimate.patientsAhead,
          expectedStart: estimate.expectedStart,
          leaveBy: estimate.leaveBy,
          checkedIn: estimate.checkedIn,
        },
        actions: [
          action(
            'track',
            'triage:orchestrator.actions.trackQueue',
            { type: 'open', to: `/app/queue/${appointment.id}` },
            'primary',
          ),
        ],
        trail,
      }),
    ];
  }

  async function myAppointments(db: DbStore, c: Conversation): Promise<ChatMessage[]> {
    if (!c.patientId) return [message({ say: [say('triage:orchestrator.kioskAppointments')] })];
    const profile = await profileOf(c);
    if (!profile) return [];
    const trail = [orchestratorStep('my_appointments'), profile.step];
    logActivity(db, {
      agentId: 'orchestrator',
      ...who(c),
      intent: 'my_appointments',
      steps: trail,
      summary: say('admin:agents.summary.my_appointments', { count: profile.upcoming.length }),
      decision: 'none',
    });
    if (profile.upcoming.length === 0) {
      return [
        message({
          say: [say('triage:orchestrator.noUpcoming')],
          actions: [
            action('doctors', 'triage:orchestrator.actions.browseDoctors', { type: 'open', to: '/app/doctors' }),
          ],
          trail,
        }),
      ];
    }
    return [
      message({
        say: [say('triage:orchestrator.upcoming', { count: profile.upcoming.length })],
        card: {
          kind: 'appointments',
          items: profile.upcoming.slice(0, 3).map((a) => ({
            id: a.id,
            token: a.token,
            date: a.date,
            start: a.start,
            doctorName: a.doctorName,
            ...(a.doctorNameTa ? { doctorNameTa: a.doctorNameTa } : {}),
          })),
        },
        actions: [
          action('all', 'triage:orchestrator.actions.allAppointments', { type: 'open', to: '/app/appointments' }),
        ],
        trail,
      }),
    ];
  }

  async function startReschedule(c: Conversation): Promise<ChatMessage[]> {
    if (!c.patientId) return [message({ say: [say('triage:orchestrator.kioskAppointments')] })];
    const profile = await profileOf(c);
    const target = profile?.upcoming.find((a) => a.status === 'booked');
    if (!profile || !target) return [message({ say: [say('triage:orchestrator.noBooked')] })];
    const doctor = await services.doctors.get(target.doctorId);
    c.reschedule = { appointment: target, doctor: toDoctorOption(doctor, { date: target.date, start: target.start }) };
    c.booking = null;
    c.pendingSteps = [profile.step];
    const [slots] = await otherTimes(c);
    return [
      message({
        say: [
          say('triage:orchestrator.rescheduleWhich', { token: target.token, date: target.date, time: target.start }),
        ],
      }),
      ...(slots
        ? [{ ...slots, trail: [orchestratorStep('reschedule'), profile.step, ...(slots.trail?.slice(1) ?? [])] }]
        : []),
    ];
  }

  async function startCancel(c: Conversation): Promise<ChatMessage[]> {
    if (!c.patientId) return [message({ say: [say('triage:orchestrator.kioskAppointments')] })];
    const profile = await profileOf(c);
    const target = profile?.upcoming.find((a) => a.status === 'booked' || a.status === 'checked_in');
    if (!profile || !target) return [message({ say: [say('triage:orchestrator.noBooked')] })];
    c.cancelTarget = target;
    c.confirming = 'cancel';
    return [
      message({
        say: [say('triage:orchestrator.confirmCancel')],
        card: {
          kind: 'confirm_cancel',
          appointmentId: target.id,
          token: target.token,
          date: target.date,
          start: target.start,
        },
        actions: [
          action('confirm', 'triage:orchestrator.actions.confirmCancel', { type: 'confirm' }, 'primary'),
          action('keep', 'triage:orchestrator.actions.keep', { type: 'decline' }),
        ],
        trail: [orchestratorStep('cancel'), profile.step],
      }),
    ];
  }

  function medicineRefusal(db: DbStore, c: Conversation): ChatMessage[] {
    const trail = [
      orchestratorStep('medicine_question'),
      step('safety', 'doseGuard', say('triage:trail.doseRefused'), false),
    ];
    logActivity(db, {
      agentId: 'orchestrator',
      ...who(c),
      intent: 'medicine_question',
      steps: trail,
      summary: say('admin:agents.summary.medicine_question'),
      decision: 'none',
    });
    const actions =
      c.channel === 'app' && isAgentActive(db, 'care')
        ? [action('care', 'triage:orchestrator.actions.carePlan', { type: 'open', to: '/app/care' })]
        : [];
    return [message({ say: [say('triage:orchestrator.medicineRefused')], actions, trail })];
  }

  // ------------------------------------------------------------------ routing

  function detectIntent(text: string, data: AgentData): Intent | null {
    for (const id of INTENT_ORDER) {
      const rule = data.intents.find((i) => i.id === id);
      if (!rule || !mentionsAny(text, phrases(rule.phrases))) continue;
      if ((id === 'greeting' || id === 'thanks') && text.split(/\s+/).length > 4) continue;
      return id;
    }
    return null;
  }

  async function onText(db: DbStore, c: Conversation, text: string, voice: boolean, data: AgentData) {
    const rules = await rulesFor(data);
    c.said.push(text);

    // Safety layer, before anything else: warning signs anywhere in what the patient has said.
    const flag = redFlagIn(c.said.join('. '), rules);
    if (flag) {
      if (c.triage.outcome === 'ongoing') {
        c.triage = {
          ...c.triage,
          messages: [...c.triage.messages, { from: 'patient', text, ...(voice ? { voice } : {}) }],
        };
      }
      return emergency(db, c, flag.id, rules);
    }
    if (isMedicineQuestion(text, data.safety)) return medicineRefusal(db, c);

    const intent = detectIntent(text, data);
    const inTriage = c.triage.outcome === 'ongoing' && c.triage.pending !== null;
    const describesSymptoms = scoreDepartments(expandSynonyms(text, rules.synonyms), rules).length > 0;
    if (intent && (INTERRUPTING.has(intent) || (!inTriage && !describesSymptoms))) {
      switch (intent) {
        case 'human':
          return escalated(db, c, 'asked_for_human', false);
        case 'queue_status':
          return queueStatus(db, c);
        case 'reschedule':
          return startReschedule(c);
        case 'cancel':
          return startCancel(c);
        case 'my_appointments':
          return myAppointments(db, c);
        case 'book':
          return startBooking(c);
        case 'greeting':
          return [message({ say: [say('triage:orchestrator.greetingBack')] })];
        case 'thanks':
          return [message({ say: [say('triage:orchestrator.thanksBack')] })];
        default:
          break;
      }
    }
    return runTriage(db, c, text, voice, rules);
  }

  async function onCommand(db: DbStore, c: Conversation, command: ChatCommand): Promise<ChatMessage[]> {
    switch (command.type) {
      case 'book':
        return startBooking(c);
      case 'pick_doctor': {
        const doctor = c.booking?.options.find((o) => o.doctorId === command.doctorId);
        if (!c.booking || !doctor) return startBooking(c);
        c.booking.doctor = doctor;
        return confirmBooking(c, doctor);
      }
      case 'pick_slot': {
        if (c.reschedule) {
          c.reschedule.doctor = { ...c.reschedule.doctor, date: command.date, start: command.start };
          c.confirming = 'reschedule';
          return [
            message({
              say: [say('triage:orchestrator.confirmReschedule', { date: command.date, time: command.start })],
              actions: [
                action('confirm', 'triage:orchestrator.actions.confirmReschedule', { type: 'confirm' }, 'primary'),
                action('keep', 'triage:orchestrator.actions.keep', { type: 'decline' }),
              ],
            }),
          ];
        }
        if (!c.booking?.doctor) return startBooking(c);
        c.booking.doctor = { ...c.booking.doctor, date: command.date, start: command.start };
        return confirmBooking(c, c.booking.doctor);
      }
      case 'other_times':
        return otherTimes(c);
      case 'confirm':
        return confirm(db, c);
      case 'decline': {
        const was = c.confirming;
        c.confirming = null;
        c.cancelTarget = null;
        c.reschedule = null;
        return [
          message({
            say: [say(was === 'booking' ? 'triage:orchestrator.notBooked' : 'triage:orchestrator.keptAppointment')],
          }),
        ];
      }
      case 'escalate':
        return escalated(db, c, 'asked_for_human', false);
      case 'start_over': {
        if (c.result?.activityId && c.outcome === 'recommended') setDecision(db, c.result.activityId, 'dismissed');
        fresh(c);
        return [greeting(c)];
      }
      case 'reply':
      case 'open':
        return [];
    }
  }

  function finish(c: Conversation, data: AgentData, messages: ChatMessage[]): ConversationReply {
    const checked = messages.map((m) => {
      if (!m.say) return m;
      const result = checkReply(m.say, data.safety);
      return { ...m, say: result.say, ...(m.trail ? { trail: [...m.trail, result.step] } : {}) };
    });
    return { messages: checked, status: status(c) };
  }

  return {
    async start(input) {
      const db = await getDb();
      const data = await agentData();
      const c: Conversation = {
        id: newId('conv'),
        channel: input.channel,
        lang: input.lang,
        ...(input.patientId ? { patientId: input.patientId } : {}),
        ...(input.userId ? { userId: input.userId } : {}),
        triage: newTriage(input.lang),
        said: [],
        result: null,
        outcome: 'ongoing',
        redFlagId: null,
        blocked: false,
        profile: null,
        pendingSteps: [],
        booking: null,
        reschedule: null,
        cancelTarget: null,
        confirming: null,
      };
      conversations.set(c.id, c);
      if (c.patientId) {
        const patient = await services.patients.get(c.patientId);
        c.profile = {
          name: patient.name,
          age: ageFromBirthYear(patient.birthYear, now()),
          conditions: patient.conditions,
        };
      }
      if (!isAgentActive(db, 'orchestrator')) {
        return {
          conversationId: c.id,
          messages: [message({ say: [say('triage:orchestrator.paused')], card: { kind: 'department_picker' } })],
        };
      }
      return { conversationId: c.id, messages: finish(c, data, [greeting(c)]).messages };
    },

    async send(conversationId, input: ConversationInput) {
      const c = conversations.get(conversationId);
      if (!c) throw new ServiceError('NOT_FOUND', 'Conversation ended');
      c.lang = input.lang;
      const db = await getDb();
      const data = await agentData();
      const started = Date.now();
      const text = input.text?.trim();
      const messages = input.command
        ? await onCommand(db, c, input.command)
        : text
          ? await onText(db, c, text, Boolean(input.voice), data)
          : [];
      // Replies never arrive instantly, but an emergency is never held back.
      if (c.outcome !== 'emergency' && Date.now() - started < 400) await think();
      return finish(c, data, messages);
    },
  };
}
