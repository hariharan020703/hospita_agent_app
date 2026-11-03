// Agent 2, medical records. A report upload reaches the orchestrator, which hands it to this agent: it "reads" the
// document (a sample scan from src/data/records matched by id or file name, or a plausible generic extraction for
// anything else, with lower confidence), the patient checks and corrects it, and the doctor gets a pre-visit
// summary that joins the triage conversation with the checked documents.
import { newId } from '@/lib/id';
import { rangeFlag, LOW_FIELD_CONFIDENCE } from '@/features/records/ranges';
import type {
  Extraction,
  ExtractedText,
  MedicalRecord,
  PreVisitSummary,
  RecordUpload,
  SummaryItem,
  SummarySource,
} from '@/types';
import { ServiceError } from '../../errors';
import type { RecordsApi } from '../../types';
import { isoNow, mustFind, replaceById, request } from '../core';
import { getDb, type DbStore } from '../db';
import type { DbState } from '../state';
import { agentData, type AgentData } from './data';
import { isAgentActive, logActivity, orchestratorStep, say, setDecision, step, think } from './shared';

const tokens = (fileName: string) =>
  fileName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** Generic extractions vary a little per file, like real reads of different scans. */
function jitter(extraction: Extraction, seed: number): Extraction {
  let n = seed;
  const nudge = (f: ExtractedText): ExtractedText => {
    n = (n * 31 + 7) % 97;
    return { ...f, confidence: Math.max(30, Math.min(95, f.confidence + (n % 11) - 6)) };
  };
  return {
    ...extraction,
    date: nudge(extraction.date),
    doctor: nudge(extraction.doctor),
    hospital: nudge(extraction.hospital),
    medicines: extraction.medicines.map((m) => ({
      name: nudge(m.name),
      dose: nudge(m.dose),
      frequency: nudge(m.frequency),
    })),
    tests: extraction.tests.map((t) => ({ ...t, value: nudge(t.value), range: nudge(t.range) })),
  };
}

function extractionFor(upload: RecordUpload, data: AgentData): { extraction: Extraction; sampleId?: string } {
  const sample = upload.sampleId
    ? data.samples.find((s) => s.id === upload.sampleId)
    : data.samples.find((s) => tokens(upload.fileName).some((t) => s.match.some((m) => t.startsWith(m))));
  if (sample) return { extraction: sample.extraction, sampleId: sample.id };
  const words = tokens(upload.fileName);
  const labLike = upload.fileType === 'pdf' || words.some((w) => /^(lab|report|test|blood|scan|cbc|sugar)/.test(w));
  const generic = data.genericExtractions[labLike ? 1 : 0] ?? data.genericExtractions[0];
  if (!generic) throw new ServiceError('UNKNOWN', 'No generic extraction');
  const seed = [...upload.fileName].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  return { extraction: jitter(generic, seed) };
}

const sampleImageOf = (data: AgentData, sampleId: string | undefined): string =>
  data.sampleImages[data.samples.find((s) => s.id === sampleId)?.file ?? ''] ?? '';

function fieldsOf(e: Extraction): ExtractedText[] {
  return [
    e.date,
    e.doctor,
    e.hospital,
    ...e.medicines.flatMap((m) => [m.name, m.dose, m.frequency]),
    ...e.tests.flatMap((t) => [t.name, t.value, t.unit, t.range]),
    ...e.diagnoses,
  ];
}

/** A value the patient changed (or added) counts as checked: full confidence. */
function confirmed(next: ExtractedText, before: ExtractedText | undefined): ExtractedText {
  return before && before.value === next.value ? next : { value: next.value, confidence: 100 };
}

function applyCorrections(before: Extraction, next: Extraction): { values: Extraction; edited: boolean } {
  const values: Extraction = {
    kind: next.kind.value === before.kind.value ? next.kind : { value: next.kind.value, confidence: 100 },
    date: confirmed(next.date, before.date),
    doctor: confirmed(next.doctor, before.doctor),
    hospital: confirmed(next.hospital, before.hospital),
    medicines: next.medicines.map((m, i) => ({
      name: confirmed(m.name, before.medicines[i]?.name),
      dose: confirmed(m.dose, before.medicines[i]?.dose),
      frequency: confirmed(m.frequency, before.medicines[i]?.frequency),
    })),
    tests: next.tests.map((t, i) => ({
      name: confirmed(t.name, before.tests[i]?.name),
      value: confirmed(t.value, before.tests[i]?.value),
      unit: confirmed(t.unit, before.tests[i]?.unit),
      range: confirmed(t.range, before.tests[i]?.range),
    })),
    diagnoses: next.diagnoses.map((d, i) => confirmed(d, before.diagnoses[i])),
  };
  const plain = (e: Extraction) => JSON.stringify([e.kind.value, ...fieldsOf(e).map((f) => f.value)]);
  return { values, edited: plain(values) !== plain(before) };
}

function lineOf(lines: { text: string; index: number }[], needle: string | undefined): number | undefined {
  if (!needle) return undefined;
  const lower = needle.toLowerCase();
  return lines.find((l) => l.text.toLowerCase().includes(lower))?.index;
}

function buildSummary(state: DbState, data: AgentData, appointmentId: string, recordsOn: boolean): PreVisitSummary {
  const appointment = mustFind(state.appointments, appointmentId);
  const patient = state.patients.find((p) => p.id === appointment.patientId);
  const triage = appointment.triageId ? state.triage.find((t) => t.id === appointment.triageId) : undefined;
  const records = recordsOn
    ? state.records
        .filter((r) => r.patientId === appointment.patientId && r.status === 'saved')
        .sort((a, b) => b.date.value.localeCompare(a.date.value))
    : [];

  const lines = (triage?.messages ?? []).map((m, index) => ({ ...m, index })).filter((m) => m.from === 'patient');
  const answers = triage?.answers ?? {};
  const said = (line?: number): SummarySource => ({
    kind: 'conversation',
    triageId: triage?.id ?? '',
    ...(line !== undefined ? { line } : {}),
  });

  const first = triage ? lines[0] : undefined;
  const chiefComplaint = first ? { value: first.text, source: said(first.index) } : null;
  const duration = answers.duration ? { value: answers.duration, source: said(lineOf(lines, answers.duration)) } : null;
  const severity = answers.severity !== undefined ? { value: answers.severity, source: said() } : null;

  const questions = new Map(data.followUps.flatMap((set) => set.questions.map((q) => [q.id, q.text] as const)));
  const associated = Object.entries(answers.extra ?? {}).flatMap(([id, answer]) => {
    const question = questions.get(id);
    return question ? [{ value: { question, answer }, source: said(lineOf(lines, answer)) }] : [];
  });

  const conditions: SummaryItem[] = [];
  if (answers.conditions && answers.conditions !== 'none') {
    conditions.push({ value: answers.conditions, source: said(lineOf(lines, answers.conditions)) });
  }
  for (const c of patient?.conditions ?? []) {
    if (!conditions.some((x) => x.value.toLowerCase() === c.toLowerCase()))
      conditions.push({ value: c, source: { kind: 'profile' } });
  }

  const seen = new Set<string>();
  const medicines = records.flatMap((r) =>
    r.medicines.flatMap((m) => {
      const key = m.name.value.toLowerCase();
      if (seen.has(key)) return [];
      seen.add(key);
      return [
        {
          value: { name: m.name.value, dose: m.dose.value, frequency: m.frequency.value },
          source: { kind: 'record', recordId: r.id } as const,
        },
      ];
    }),
  );
  const seenTests = new Set<string>();
  const results = records.flatMap((r) =>
    r.tests.flatMap((t) => {
      const key = t.name.value.toLowerCase();
      if (seenTests.has(key)) return [];
      seenTests.add(key);
      return [
        {
          value: {
            name: t.name.value,
            value: t.value.value,
            unit: t.unit.value,
            range: t.range.value,
            flag: rangeFlag(t.value.value, t.range.value),
          },
          source: { kind: 'record', recordId: r.id } as const,
        },
      ];
    }),
  );
  const diagnosesMentioned = records.flatMap((r) =>
    r.diagnoses.map((d) => ({ value: d.value, source: { kind: 'record', recordId: r.id } as const })),
  );

  return {
    appointmentId,
    patientId: appointment.patientId,
    triageId: triage?.id ?? null,
    lang: triage?.lang ?? patient?.preferredLang ?? 'en',
    chiefComplaint,
    duration,
    severity,
    associated,
    conditions,
    medicines,
    results,
    diagnosesMentioned,
    safetyScreen: triage?.safetyScreen ?? null,
    redFlagId: triage?.redFlagId ?? null,
    urgency: triage?.urgency ?? null,
    confidence: triage?.confidence ?? null,
    recordCount: records.length,
    recordsIncluded: recordsOn,
  };
}

/** The first time a summary is prepared for a visit, it is written to the activity log. */
function logSummary(db: DbStore, summary: PreVisitSummary, patientName: string): void {
  const state = db.getState();
  if (state.agentActivity.some((a) => a.intent === 'pre_visit_summary' && a.ref?.id === summary.appointmentId)) return;
  logActivity(db, {
    agentId: 'records',
    actor: 'doctor',
    patientId: summary.patientId,
    intent: 'pre_visit_summary',
    steps: [
      orchestratorStep('pre_visit_summary'),
      step('agent', 'records', say('triage:trail.summary', { records: summary.recordCount })),
    ],
    summary: say('admin:agents.summary.pre_visit_summary', { patient: patientName }),
    decision: 'none',
    ref: { kind: 'appointment', id: summary.appointmentId },
  });
}

export function createRecordsAgent(): RecordsApi {
  return {
    async samples() {
      const data = await agentData();
      return request(() =>
        data.samples.map((s) => ({ id: s.id, title: s.title, imageUrl: data.sampleImages[s.file] ?? '' })),
      );
    },

    list: (patientIds) =>
      request((db) =>
        db
          .getState()
          .records.filter((r) => patientIds.includes(r.patientId))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      ),

    get: (id) => request((db) => mustFind(db.getState().records, id)),

    async extract(upload) {
      const data = await agentData();
      const db = await getDb();
      if (!isAgentActive(db, 'records')) throw new ServiceError('FORBIDDEN', 'Medical records agent is paused');
      // Reading a scan takes a moment: reading, then medicines, then test values.
      await think(2400, 3400);
      const { extraction, sampleId } = extractionFor(upload, data);
      const fields = fieldsOf(extraction);
      const low = fields.filter((f) => f.confidence < LOW_FIELD_CONFIDENCE).length;
      const confidence = Math.round(fields.reduce((sum, f) => sum + f.confidence, 0) / Math.max(fields.length, 1));
      const id = newId('rec');
      const activity = logActivity(db, {
        agentId: 'records',
        actor: 'patient',
        userId: upload.userId,
        patientId: upload.patientId,
        intent: 'record_uploaded',
        steps: [
          orchestratorStep('record_uploaded'),
          step('agent', 'records', say('triage:trail.records.read', { file: upload.fileName })),
          step(
            'agent',
            'records',
            say('triage:trail.records.extracted', {
              medicines: extraction.medicines.length,
              tests: extraction.tests.length,
              low,
            }),
          ),
        ],
        summary: say('admin:agents.summary.record_uploaded', {
          kind: say(`triage:recordKinds.${extraction.kind.value}`),
          medicines: extraction.medicines.length,
          tests: extraction.tests.length,
        }),
        confidence,
        decision: 'pending',
        ref: { kind: 'record', id },
      });
      const record: MedicalRecord = {
        ...structuredClone(extraction),
        id,
        patientId: upload.patientId,
        uploadedBy: upload.userId,
        fileName: upload.fileName,
        fileType: upload.fileType,
        ...(sampleId ? { sampleId } : {}),
        // The patient's own image when there is one; a picked sample shows its scan.
        ...(upload.imageUrl || sampleId ? { imageUrl: upload.imageUrl ?? sampleImageOf(data, sampleId) } : {}),
        status: 'review',
        edited: false,
        createdAt: isoNow(),
        activityId: activity.id,
      };
      db.setState((state) => ({ records: [...state.records, record] }));
      return structuredClone(record);
    },

    save: (id, values) =>
      request((db) => {
        const state = db.getState();
        const current = mustFind(state.records, id);
        const { values: checked, edited } = applyCorrections(current, values);
        const next: MedicalRecord = { ...current, ...checked, status: 'saved', edited, savedAt: isoNow() };
        db.setState({ records: replaceById(state.records, next) });
        setDecision(db, current.activityId, edited ? 'edited' : 'accepted');
        return next;
      }),

    remove: (id) =>
      request((db) => {
        const state = db.getState();
        const current = mustFind(state.records, id);
        if (current.status === 'review') setDecision(db, current.activityId, 'dismissed');
        db.setState({ records: state.records.filter((r) => r.id !== id) });
      }),

    async preVisitSummary(appointmentId) {
      const data = await agentData();
      return request((db) => {
        const state = db.getState();
        const summary = buildSummary(state, data, appointmentId, isAgentActive(db, 'records'));
        logSummary(db, summary, state.patients.find((p) => p.id === summary.patientId)?.name ?? '');
        return summary;
      });
    },
  };
}
