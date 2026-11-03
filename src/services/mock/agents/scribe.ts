// Agent 3, consultation scribe. "Listening" plays a scripted consultation from src/data/scribe (Lakshmi's
// cardiology visit for her, otherwise one for the department), streamed line by line on the doctor's screen. When
// the doctor stops, the scribe drafts the note and prescription from the lines heard so far; every drafted field is
// marked until the doctor edits or confirms it, and nothing is final until "Sign & save". Signing hands the note to
// the care companion.
import { newId } from '@/lib/id';
import { addDaysIso } from '@/lib/time';
import {
  NOTE_FIELDS,
  type ConsultationNote,
  type DoseSlot,
  type NoteField,
  type NoteFieldKey,
  type PrescriptionItem,
} from '@/types';
import { ServiceError } from '../../errors';
import type { ScribeApi, Services } from '../../types';
import { isoNow, mustFind, replaceById, request, today } from '../core';
import { getDb } from '../db';
import type { DbState } from '../state';
import { startCarePlan } from './care';
import { agentData, type AgentData } from './data';
import { isAgentActive, logActivity, orchestratorStep, say, setDecision, step, think } from './shared';
import { createTools } from './tools';

function scriptFor(data: AgentData, state: DbState, appointmentId: string) {
  const appointment = mustFind(state.appointments, appointmentId);
  const script =
    data.scripts.find((s) => s.match.patientIds?.includes(appointment.patientId)) ??
    data.scripts.find((s) => s.match.departmentIds?.includes(appointment.departmentId)) ??
    data.scripts.find((s) => s.match.departmentIds?.includes('general')) ??
    data.scripts[0];
  if (!script) throw new ServiceError('NOT_FOUND', 'No consultation script');
  return { appointment, script };
}

const frequency = (slots: readonly DoseSlot[]) =>
  (['morning', 'afternoon', 'night'] as const).map((s) => (slots.includes(s) ? '1' : '0')).join('-');

/** The signed note as plain text on the visit, so visit history keeps it too. */
function visitNote(note: ConsultationNote): string {
  const f = note.fields;
  return [
    f.chiefComplaint.value && `Complaint: ${f.chiefComplaint.value}`,
    f.assessment.value && `Assessment: ${f.assessment.value}`,
    note.prescription.length > 0 &&
      `Rx: ${note.prescription
        .map(
          (p) =>
            `${p.medicine} ${p.dose} ${frequency(p.slots)} ${p.food === 'any' ? '' : `${p.food} food `}x ${p.days} days`,
        )
        .join('; ')}`,
    f.investigations.value && `Investigations: ${f.investigations.value.split('\n').join(', ')}`,
    f.advice.value && `Advice: ${f.advice.value.split('\n').join(' ')}`,
    note.followUpDate.value && `Review on ${note.followUpDate.value}`,
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 1000);
}

const reviewed = (field: NoteField): NoteField => ({ ...field, reviewed: true });

export function createScribe(services: Services): ScribeApi {
  const tools = createTools(services);

  return {
    async listen(appointmentId) {
      const data = await agentData();
      return request((db) => {
        if (!isAgentActive(db, 'scribe')) throw new ServiceError('FORBIDDEN', 'Scribe is paused');
        const { appointment, script } = scriptFor(data, db.getState(), appointmentId);
        logActivity(db, {
          agentId: 'scribe',
          actor: 'doctor',
          patientId: appointment.patientId,
          intent: 'consultation_started',
          steps: [orchestratorStep('consultation_started')],
          summary: say('admin:agents.summary.consultation_started'),
          decision: 'none',
          ref: { kind: 'appointment', id: appointment.id },
        });
        return { scriptId: script.id, lines: script.lines };
      });
    },

    async draft(appointmentId, heard) {
      const data = await agentData();
      const db = await getDb();
      await think(1600, 2400);
      const state = db.getState();
      const { appointment, script } = scriptFor(data, state, appointmentId);
      const n = Math.max(0, Math.min(heard, script.lines.length));
      const drafted = (f: { value: string; line: number }): NoteField => {
        const value = f.line < n ? f.value : '';
        return { value, ai: Boolean(value), reviewed: false };
      };
      const fields = Object.fromEntries(NOTE_FIELDS.map((k) => [k, drafted(script.draft.fields[k])])) as Record<
        NoteFieldKey,
        NoteField
      >;
      const followUp = script.draft.followUpDays;
      const prescription: PrescriptionItem[] = script.draft.prescription
        .filter((p) => p.line < n)
        .map((p) => ({
          id: newId('rx'),
          medicine: p.medicine,
          dose: p.dose,
          slots: p.slots,
          food: p.food,
          days: p.days,
          ai: true,
          reviewed: false,
        }));
      const filled = NOTE_FIELDS.filter((k) => fields[k].value).length + (followUp.line < n ? 1 : 0);
      const id = newId('note');
      const activity = logActivity(db, {
        agentId: 'scribe',
        actor: 'doctor',
        patientId: appointment.patientId,
        intent: 'consultation_ended',
        steps: [
          orchestratorStep('consultation_ended'),
          step('agent', 'scribe', say('triage:trail.scribe.listening', { lines: n })),
          step(
            'agent',
            'scribe',
            say('triage:trail.scribe.drafted', { fields: filled, medicines: prescription.length }),
          ),
        ],
        summary: say('admin:agents.summary.consultation_ended', { fields: filled, medicines: prescription.length }),
        confidence: Math.round(78 + (16 * n) / script.lines.length),
        decision: 'pending',
        ref: { kind: 'note', id },
      });
      const stamp = isoNow();
      const note: ConsultationNote = {
        id,
        appointmentId,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        scriptId: script.id,
        status: 'draft',
        transcript: script.lines.slice(0, n),
        fields,
        followUpDate: {
          value: followUp.line < n ? addDaysIso(today(), followUp.value) : '',
          ai: followUp.line < n,
          reviewed: false,
        },
        prescription,
        editedCount: 0,
        createdAt: stamp,
        updatedAt: stamp,
        activityId: activity.id,
      };
      // A new draft replaces an earlier unsigned one for the same visit.
      const earlier = state.notes.filter((x) => x.appointmentId === appointmentId && x.status === 'draft');
      earlier.forEach((x) => setDecision(db, x.activityId, 'dismissed'));
      db.setState((s) => ({
        notes: [...s.notes.filter((x) => !(x.appointmentId === appointmentId && x.status === 'draft')), note],
      }));
      return structuredClone(note);
    },

    note: (appointmentId) =>
      request(
        (db) =>
          db
            .getState()
            .notes.filter((n) => n.appointmentId === appointmentId)
            .at(-1) ?? null,
      ),

    saveDraft: (note) =>
      request((db) => {
        const state = db.getState();
        const current = mustFind(state.notes, note.id);
        if (current.status !== 'draft') throw new ServiceError('INVALID_STATE');
        const next: ConsultationNote = { ...note, status: 'draft', updatedAt: isoNow() };
        db.setState({ notes: replaceById(state.notes, next) });
        return next;
      }),

    async sign(note, userId) {
      const data = await agentData();
      const db = await getDb();
      const state = db.getState();
      const current = mustFind(state.notes, note.id);
      if (current.status !== 'draft') throw new ServiceError('INVALID_STATE');
      const stamp = isoNow();
      // Signing confirms every remaining drafted value: the doctor owns the note from here.
      const signed: ConsultationNote = {
        ...note,
        status: 'signed',
        signedAt: stamp,
        signedBy: userId,
        updatedAt: stamp,
        fields: Object.fromEntries(NOTE_FIELDS.map((k) => [k, reviewed(note.fields[k])])) as Record<
          NoteFieldKey,
          NoteField
        >,
        followUpDate: reviewed(note.followUpDate),
        prescription: note.prescription.map((p) => ({ ...p, reviewed: true })),
      };
      const appointment = mustFind(state.appointments, note.appointmentId);
      db.setState((s) => ({
        notes: replaceById(s.notes, signed),
        appointments: replaceById(s.appointments, { ...appointment, note: visitNote(signed), updatedAt: stamp }),
      }));
      setDecision(db, current.activityId, signed.editedCount > 0 ? 'edited' : 'accepted');
      logActivity(db, {
        agentId: 'scribe',
        actor: 'doctor',
        userId,
        patientId: signed.patientId,
        intent: 'prescription_signed',
        steps: [
          orchestratorStep('prescription_signed'),
          step('agent', 'scribe', say('triage:trail.scribe.signed', { edits: signed.editedCount })),
        ],
        summary: say('admin:agents.summary.prescription_signed', { edits: signed.editedCount }),
        decision: 'none',
        ref: { kind: 'note', id: signed.id },
      });
      const plan = await startCarePlan(db, tools, signed, data);
      return structuredClone({ note: signed, plan });
    },

    discard: (noteId) =>
      request((db) => {
        const state = db.getState();
        const current = mustFind(state.notes, noteId);
        if (current.status !== 'draft') throw new ServiceError('INVALID_STATE');
        setDecision(db, current.activityId, 'dismissed');
        db.setState({ notes: state.notes.filter((n) => n.id !== noteId) });
      }),
  };
}
