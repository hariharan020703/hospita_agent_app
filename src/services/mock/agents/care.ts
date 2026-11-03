// Agent 4, care companion. When the doctor signs, the orchestrator hands the note here and a care plan is made
// (medicine times, advice, tests, follow-up; Tamil from the approved phrase list in src/data/care). The companion
// answers only from that plan and says which part it used; anything else, and any dose change, goes to the doctor.
// Check-ins ask how the patient is; warning signs raise an urgent alert to the doctor and advise coming in or 108.
import { mentions, mentionsAny } from '@/features/triage/engine';
import { newId } from '@/lib/id';
import { addDaysIso } from '@/lib/time';
import {
  DOSE_SLOTS,
  type AgentText,
  type CareLine,
  type CareMessage,
  type CarePlan,
  type CareSource,
  type ConsultationNote,
  type DoctorQuery,
  type DoseSlot,
  type Localized,
  type TrailStep,
} from '@/types';
import { ServiceError } from '../../errors';
import type { CareApi, Services } from '../../types';
import { isoNow, mustFind, replaceById, request, today } from '../core';
import { getDb, type DbStore } from '../db';
import { agentData, type AgentData } from './data';
import { asksDoseChange, checkReply, isMedicineQuestion, redFlagIn } from './safety';
import { isAgentActive, logActivity, orchestratorStep, phrases, say, setDecision, step, think } from './shared';
import { createTools, type AgentTools } from './tools';
import { withStaticRules } from './triageAgent';

const normal = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const linesOf = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/** A line of the doctor's words, with the approved Tamil version when the phrase list has one. */
export function careLine(text: string, data: AgentData): CareLine {
  const phrase = data.phrases.find((p) => normal(p.en) === normal(text));
  return phrase ? { en: text.trim(), ta: phrase.ta } : { en: text.trim() };
}

/** Lines without an approved translation are shown as the doctor wrote them. */
const localized = (line: CareLine): Localized => ({ en: line.en, ta: line.ta ?? line.en });

/** Words that name a kind of medicine rather than a specific one. */
const GENERIC_MEDICINE_WORDS = new Set([
  'tablet',
  'pill',
  'medicine',
  'syrup',
  'capsule',
  'injection',
  'மாத்திரை',
  'மருந்து',
  'ஊசி',
  'maathirai',
  'mathirai',
  'marundhu',
  'marunthu',
]);

export function planFromNote(note: ConsultationNote, departmentId: string, data: AgentData): CarePlan {
  const start = today();
  return {
    id: newId('care'),
    patientId: note.patientId,
    doctorId: note.doctorId,
    departmentId,
    appointmentId: note.appointmentId,
    noteId: note.id,
    complaint: careLine(note.fields.chiefComplaint.value, data),
    medicines: note.prescription.map((p) => ({
      id: newId('med'),
      name: p.medicine,
      dose: p.dose,
      slots: p.slots,
      food: p.food,
      days: p.days,
      startDate: start,
      endDate: addDaysIso(start, Math.max(p.days, 1) - 1),
    })),
    advice: linesOf(note.fields.advice.value).map((l) => careLine(l, data)),
    tests: linesOf(note.fields.investigations.value).map((l) => careLine(l, data)),
    followUpDate: note.followUpDate.value || null,
    checkIns: [],
    doses: [],
    createdAt: isoNow(),
  };
}

const message = (planId: string, parts: Omit<CareMessage, 'id' | 'planId' | 'at'>): CareMessage => ({
  id: newId('cmsg'),
  planId,
  at: isoNow(),
  ...parts,
});

/** Prescription signed -> care plan, a welcome message and an in-app notification. Null while the agent is paused. */
export async function startCarePlan(
  db: DbStore,
  tools: AgentTools,
  note: ConsultationNote,
  data: AgentData,
): Promise<CarePlan | null> {
  if (!isAgentActive(db, 'care')) return null;
  const state = db.getState();
  const appointment = mustFind(state.appointments, note.appointmentId);
  const doctor = state.doctors.find((d) => d.id === note.doctorId);
  const plan = planFromNote(note, appointment.departmentId, data);
  const welcome = message(plan.id, {
    from: 'assistant',
    kind: 'answer',
    say: [say('triage:care.welcome', { doctor: doctor?.name ?? '', count: plan.medicines.length })],
  });
  db.setState((s) => ({ carePlans: [...s.carePlans, plan], careMessages: [...s.careMessages, welcome] }));
  const sent = await tools.sendNotification(
    plan.patientId,
    'care_plan_ready',
    { doctor: doctor?.name ?? '', planId: plan.id },
    appointment.id,
  );
  logActivity(db, {
    agentId: 'care',
    actor: 'system',
    patientId: plan.patientId,
    intent: 'care_plan_ready',
    steps: [
      orchestratorStep('care_plan_ready'),
      step('agent', 'care', say('triage:trail.care.planCreated', { count: plan.medicines.length })),
      sent.step,
    ],
    summary: say('admin:agents.summary.care_plan_ready', { count: plan.medicines.length }),
    decision: 'none',
    ref: { kind: 'plan', id: plan.id },
  });
  return plan;
}

const medicineLine = (m: CarePlan['medicines'][number]): AgentText =>
  say('triage:care.medicineLine', {
    name: `${m.name} ${m.dose}`,
    slots: m.slots.map((s) => say(`triage:care.slot.${s}`)),
    food: say(`triage:care.food.${m.food}`),
  });

export function createCareCompanion(services: Services): CareApi {
  const tools = createTools(services);

  /** Medicines the patient is asking about: by name or by time of day ("night tablet"); all of them otherwise. */
  function medicinesIn(text: string, plan: CarePlan, data: AgentData) {
    const named = plan.medicines.filter((m) => mentions(text, m.name.split(' ')[0] ?? m.name));
    if (named.length) return named;
    const slots = DOSE_SLOTS.filter((s) => {
      const words = data.careTemplates.slotWords[s];
      return words ? mentionsAny(text, phrases(words)) : false;
    });
    const timed = plan.medicines.filter((m) => m.slots.some((s) => slots.includes(s)));
    return timed.length ? timed : plan.medicines;
  }

  function adviceAbout(topic: string, plan: CarePlan, data: AgentData): number[] {
    const words = data.careTemplates.topics[topic] ?? [];
    return plan.advice.flatMap((line, i) => (words.some((w) => mentions(line.en, w)) ? [i] : []));
  }

  function raise(
    db: DbStore,
    plan: CarePlan,
    query: Pick<DoctorQuery, 'kind' | 'urgent' | 'text' | 'reason'> & { activityId?: string },
  ): DoctorQuery {
    const created: DoctorQuery = {
      id: newId('dq'),
      planId: plan.id,
      patientId: plan.patientId,
      doctorId: plan.doctorId,
      status: 'open',
      createdAt: isoNow(),
      ...query,
    };
    db.setState((s) => ({ doctorQueries: [...s.doctorQueries, created] }));
    return created;
  }

  /** Answers a question from the plan, or hands it to the doctor. */
  function answer(text: string, plan: CarePlan, data: AgentData) {
    const intent = data.careIntents.find((i) => mentionsAny(text, phrases(i.terms)))?.id;
    const sources: CareSource[] = [];
    const lines: AgentText[] = [];
    const meds = medicinesIn(text, plan, data);
    switch (intent) {
      case 'missed_dose': {
        const advice = adviceAbout('missed_dose', plan, data);
        if (!advice.length) break;
        lines.push(say('triage:care.answers.missedDose'));
        advice.forEach((i) => {
          const line = plan.advice[i];
          if (line) lines.push(say('triage:care.quote', { text: localized(line) }));
          sources.push({ kind: 'advice', index: i });
        });
        lines.push(say('triage:care.answers.yourMedicine'), ...meds.map(medicineLine));
        meds.forEach((m) => sources.push({ kind: 'medicine', medicineId: m.id }));
        break;
      }
      case 'food':
      case 'timing':
        if (!plan.medicines.length) break;
        lines.push(say(intent === 'food' ? 'triage:care.answers.foodIntro' : 'triage:care.answers.timingIntro'));
        (intent === 'food' ? meds : plan.medicines).forEach((m) => {
          lines.push(medicineLine(m));
          sources.push({ kind: 'medicine', medicineId: m.id });
        });
        break;
      case 'duration':
        if (!plan.medicines.length) break;
        lines.push(say('triage:care.answers.durationIntro'));
        meds.forEach((m) => {
          lines.push(say('triage:care.durationLine', { name: m.name, days: m.days, date: m.endDate }));
          sources.push({ kind: 'medicine', medicineId: m.id });
        });
        break;
      case 'follow_up':
        if (!plan.followUpDate) break;
        lines.push(say('triage:care.answers.followUp', { date: plan.followUpDate }));
        sources.push({ kind: 'followUp' });
        break;
      case 'tests':
        if (!plan.tests.length) break;
        lines.push(say('triage:care.answers.testsIntro'));
        plan.tests.forEach((line, i) => {
          lines.push(say('triage:care.quote', { text: localized(line) }));
          sources.push({ kind: 'test', index: i });
        });
        break;
      case 'diet':
      case 'activity': {
        const advice = adviceAbout(intent, plan, data);
        if (!advice.length) break;
        lines.push(say('triage:care.answers.adviceIntro'));
        advice.forEach((i) => {
          const line = plan.advice[i];
          if (line) lines.push(say('triage:care.quote', { text: localized(line) }));
          sources.push({ kind: 'advice', index: i });
        });
        break;
      }
      default:
        break;
    }
    return { intent: intent ?? 'unknown', lines, sources };
  }

  return {
    plans: (patientIds) =>
      request((db) =>
        db
          .getState()
          .carePlans.filter((p) => patientIds.includes(p.patientId))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      ),

    plan: (id) => request((db) => mustFind(db.getState().carePlans, id)),

    messages: (planId) => request((db) => db.getState().careMessages.filter((m) => m.planId === planId)),

    async ask(planId, text) {
      const data = await agentData();
      const db = await getDb();
      if (!isAgentActive(db, 'care')) throw new ServiceError('FORBIDDEN', 'Care companion is paused');
      const rules = withStaticRules(await services.triage.rules(), data);
      await think(700, 1300);
      const state = db.getState();
      const plan = mustFind(state.carePlans, planId);
      const doctor = state.doctors.find((d) => d.id === plan.doctorId)?.name ?? '';
      const asked = message(planId, { from: 'patient', kind: 'question', text });
      const pending = plan.checkIns.find((c) => !c.reply);
      const trail: TrailStep[] = [orchestratorStep(pending ? 'check_in_reply' : 'care_question')];
      const replies: CareMessage[] = [];
      let nextPlan = plan;
      const who = { actor: 'patient' as const, patientId: plan.patientId };

      const flag = redFlagIn(text, rules);
      const warning = flag
        ? undefined
        : data.careTemplates.warningSigns.find(
            (w) =>
              (w.departmentId === plan.departmentId || w.departmentId === '*') && mentionsAny(text, phrases(w.terms)),
          );

      if (pending) {
        const outcome = flag
          ? 'emergency'
          : warning
            ? 'warning'
            : mentionsAny(text, phrases(data.careTemplates.better))
              ? 'better'
              : 'same';
        nextPlan = {
          ...plan,
          checkIns: plan.checkIns.map((c) =>
            c.id === pending.id ? { ...c, reply: text, repliedAt: isoNow(), outcome } : c,
          ),
        };
      }

      if (flag || warning) {
        // Safety layer: a warning sign is never answered from the plan. The doctor is alerted at once.
        const label = flag ? flag.label : (warning?.label ?? { en: '', ta: '' });
        trail.push(
          step('safety', flag ? 'redFlags' : 'warningSigns', say('triage:trail.redFlag', { flag: label }), false),
        );
        trail.push(step('agent', 'care', say('triage:trail.care.warning')));
        const activity = logActivity(db, {
          agentId: 'care',
          ...who,
          intent: flag ? 'care_emergency' : 'check_in_reply_warning',
          steps: trail,
          summary: say(flag ? 'admin:agents.summary.care_emergency' : 'admin:agents.summary.check_in_reply_warning'),
          decision: 'pending',
          ref: { kind: 'plan', id: plan.id },
        });
        const query = raise(db, plan, {
          kind: 'alert',
          urgent: true,
          text,
          reason: say(flag ? 'triage:care.reasons.redFlag' : 'triage:care.reasons.warning', { label }),
          activityId: activity.id,
        });
        replies.push(
          message(planId, {
            from: 'assistant',
            kind: flag ? 'emergency' : 'urgent',
            say: [say(flag ? 'triage:care.emergency' : 'triage:care.urgent', { doctor })],
            queryId: query.id,
            ...(flag ? { redFlagId: flag.id } : {}),
            trail,
          }),
        );
      } else if (pending) {
        const better = nextPlan.checkIns.find((c) => c.id === pending.id)?.outcome === 'better';
        trail.push(step('safety', 'warningSigns', say('triage:trail.safetyClear')));
        trail.push(step('agent', 'care', say(better ? 'triage:trail.care.better' : 'triage:trail.care.same')));
        if (!better) {
          raise(db, plan, {
            kind: 'alert',
            urgent: false,
            text,
            reason: say('triage:care.reasons.checkInSame', { day: pending.day }),
          });
        }
        logActivity(db, {
          agentId: 'care',
          ...who,
          intent: 'check_in_reply',
          steps: trail,
          summary: say('admin:agents.summary.check_in_reply', {
            outcome: say(better ? 'triage:care.outcome.better' : 'triage:care.outcome.same'),
          }),
          decision: 'none',
          ref: { kind: 'plan', id: plan.id },
        });
        replies.push(
          message(planId, {
            from: 'assistant',
            kind: 'answer',
            say: [say(better ? 'triage:care.checkInBetter' : 'triage:care.checkInSame', { doctor })],
            trail,
          }),
        );
      } else {
        trail.push(step('safety', 'redFlags', say('triage:trail.safetyClear')));
        const planNames = plan.medicines.map((m) => normal(m.name));
        const otherMedicine =
          isMedicineQuestion(text, data.safety) &&
          [...data.safety.medicineWords.en, ...data.safety.medicineWords.tanglish].some(
            (w) => !GENERIC_MEDICINE_WORDS.has(w) && mentions(text, w) && !planNames.some((n) => n.includes(w)),
          );
        const doseChange = asksDoseChange(text, data.safety);
        const result = doseChange || otherMedicine ? null : answer(text, plan, data);
        if (result && result.lines.length) {
          const checked = checkReply(result.lines, data.safety);
          const parts = [...new Set(result.sources.map((s) => s.kind))];
          trail.push(
            step(
              'agent',
              'care',
              say('triage:trail.care.used', { part: parts.map((p) => say(`triage:carePart.${p}`)) }),
            ),
            checked.step,
          );
          logActivity(db, {
            agentId: 'care',
            ...who,
            intent: 'care_question',
            steps: trail,
            summary: say('admin:agents.summary.care_question'),
            decision: 'none',
            ref: { kind: 'plan', id: plan.id },
          });
          replies.push(
            message(planId, { from: 'assistant', kind: 'answer', say: checked.say, sources: result.sources, trail }),
          );
        } else {
          // Not in the prescription or the advice (or a dose change): the doctor answers.
          const reason =
            doseChange || otherMedicine ? 'doseChange' : result?.intent === 'side_effect' ? 'sideEffect' : 'notInPlan';
          trail.push(
            step(
              doseChange || otherMedicine ? 'safety' : 'agent',
              doseChange || otherMedicine ? 'doseGuard' : 'care',
              say('triage:trail.care.askedDoctor'),
              !(doseChange || otherMedicine),
            ),
          );
          const activity = logActivity(db, {
            agentId: 'care',
            ...who,
            intent: 'care_question',
            steps: trail,
            summary: say(
              doseChange || otherMedicine
                ? 'admin:agents.summary.care_refused'
                : 'admin:agents.summary.care_asked_doctor',
            ),
            decision: 'pending',
            ref: { kind: 'plan', id: plan.id },
          });
          const query = raise(db, plan, {
            kind: 'question',
            urgent: false,
            text,
            reason: say(`triage:care.reasons.${reason}`),
            activityId: activity.id,
          });
          replies.push(
            message(planId, {
              from: 'assistant',
              kind: doseChange || otherMedicine ? 'refused' : 'asked_doctor',
              say: [
                say(
                  doseChange || otherMedicine
                    ? 'triage:care.refusedDose'
                    : reason === 'sideEffect'
                      ? 'triage:care.sideEffect'
                      : 'triage:care.askedDoctor',
                  { doctor },
                ),
              ],
              queryId: query.id,
              trail,
            }),
          );
        }
      }

      db.setState((s) => ({
        carePlans: replaceById(s.carePlans, nextPlan),
        careMessages: [...s.careMessages, asked, ...replies],
      }));
      return structuredClone([asked, ...replies]);
    },

    markDose: (planId, dose, taken) =>
      request((db) => {
        const state = db.getState();
        const plan = mustFind(state.carePlans, planId);
        const same = (d: { medicineId: string; slot: DoseSlot; date: string }) =>
          d.medicineId === dose.medicineId && d.slot === dose.slot && d.date === dose.date;
        const doses = plan.doses.filter((d) => !same(d));
        const next: CarePlan = { ...plan, doses: taken ? [...doses, { ...dose, at: isoNow() }] : doses };
        db.setState({ carePlans: replaceById(state.carePlans, next) });
        return next;
      }),

    async simulateCheckIn(planId, day) {
      const data = await agentData();
      const db = await getDb();
      if (!isAgentActive(db, 'care')) throw new ServiceError('FORBIDDEN', 'Care companion is paused');
      const state = db.getState();
      const plan = mustFind(state.carePlans, planId);
      const patient = state.patients.find((p) => p.id === plan.patientId);
      const template =
        data.careTemplates.checkIns.find((c) => c.departmentId === plan.departmentId && c.day === day) ??
        data.careTemplates.checkIns.find((c) => c.departmentId === '*');
      if (!template) throw new ServiceError('NOT_FOUND', 'No check-in template');
      const name = patient?.name.split(' ')[0] ?? '';
      const question = {
        en: template.question.en.replace('{{name}}', name),
        ta: template.question.ta.replace('{{name}}', name),
      };
      const checkIn = { id: newId('chk'), day, question, sentAt: isoNow() };
      const sent = await tools.sendNotification(plan.patientId, 'care_check_in', { day, planId: plan.id });
      const trail = [
        orchestratorStep('check_in'),
        step('agent', 'care', say('triage:trail.care.checkIn', { day })),
        sent.step,
      ];
      const asked = message(planId, {
        from: 'assistant',
        kind: 'check_in',
        checkInId: checkIn.id,
        say: [say('triage:orchestrator.literal', { text: question })],
        trail,
      });
      logActivity(db, {
        agentId: 'care',
        actor: 'system',
        patientId: plan.patientId,
        intent: 'check_in',
        steps: trail,
        summary: say('admin:agents.summary.check_in', { day }),
        decision: 'none',
        ref: { kind: 'plan', id: plan.id },
      });
      // A newer check-in replaces one the patient never answered.
      const next: CarePlan = { ...plan, checkIns: [...plan.checkIns.filter((c) => c.reply), checkIn] };
      db.setState((s) => ({ carePlans: replaceById(s.carePlans, next), careMessages: [...s.careMessages, asked] }));
      return structuredClone([asked]);
    },

    followUps: (doctorId) =>
      request((db) =>
        db
          .getState()
          .doctorQueries.filter((q) => q.doctorId === doctorId)
          .sort(
            (a, b) =>
              Number(b.status === 'open') - Number(a.status === 'open') ||
              Number(b.urgent) - Number(a.urgent) ||
              b.createdAt.localeCompare(a.createdAt),
          ),
      ),

    async reply(queryId, text, userId) {
      const db = await getDb();
      const state = db.getState();
      const query = mustFind(state.doctorQueries, queryId);
      const doctor = state.doctors.find((d) => d.id === query.doctorId)?.name ?? '';
      const answered: DoctorQuery = { ...query, status: 'answered', reply: text.trim(), answeredAt: isoNow() };
      const reply = message(query.planId, { from: 'doctor', kind: 'doctor_reply', text: text.trim(), queryId });
      db.setState((s) => ({
        doctorQueries: replaceById(s.doctorQueries, answered),
        careMessages: [...s.careMessages, reply],
      }));
      const sent = await tools.sendNotification(query.patientId, 'doctor_reply', { doctor, planId: query.planId });
      setDecision(db, query.activityId, 'accepted');
      logActivity(db, {
        agentId: 'care',
        actor: 'doctor',
        userId,
        patientId: query.patientId,
        intent: 'doctor_reply',
        steps: [
          orchestratorStep('doctor_reply'),
          step('agent', 'care', say('triage:trail.care.doctorReplied')),
          sent.step,
        ],
        summary: say('admin:agents.summary.doctor_reply'),
        decision: 'none',
        ref: { kind: 'plan', id: query.planId },
      });
      return structuredClone(answered);
    },

    acknowledge: (queryId) =>
      request((db) => {
        const state = db.getState();
        const query = mustFind(state.doctorQueries, queryId);
        const next: DoctorQuery = { ...query, status: 'acknowledged', answeredAt: isoNow() };
        db.setState({ doctorQueries: replaceById(state.doctorQueries, next) });
        setDecision(db, query.activityId, 'accepted');
        return next;
      }),
  };
}
