// The orchestrator and its four agents (triage, medical records, consultation scribe, care companion): what they
// produce, the activity log, and the static data that drives the simulated behaviour (src/data/{agents,triage,
// records,scribe,care}).
import { z } from 'zod';
import { dayOffsetSchema, idSchema, localizedSchema, type Channel, type Lang, type Localized } from './common';
import { keywordListSchema, type EscalationReason } from './triage';

export const AGENT_IDS = ['orchestrator', 'triage', 'records', 'scribe', 'care'] as const;
export const agentIdSchema = z.enum(AGENT_IDS);
export type AgentId = z.infer<typeof agentIdSchema>;

/** Tools the orchestrator can call. Each wraps an existing service; none adds business logic. */
export const AGENT_TOOLS = [
  'searchDoctors',
  'getSlots',
  'bookAppointment',
  'rescheduleAppointment',
  'cancelAppointment',
  'getQueueStatus',
  'getPatientProfile',
  'sendNotification',
] as const;
export type AgentTool = (typeof AGENT_TOOLS)[number];

/** Safety checks run before and after every patient-facing reply. */
export const SAFETY_CHECKS = ['redFlags', 'doseGuard', 'noDiagnosis', 'warningSigns'] as const;
export type SafetyCheck = (typeof SAFETY_CHECKS)[number];

// ------------------------------------------------------------------ agent text

/**
 * Words an agent says, as a namespaced i18n key ("triage:orchestrator.greeting") plus parameters, so the reply
 * follows the reader's language. Parameters may be bilingual values or nested texts.
 */
export interface AgentText {
  key: string;
  params?: Record<string, AgentTextParam>;
}
export type AgentTextParam = string | number | Localized | AgentText | AgentText[];

const agentTextSchema: z.ZodType<AgentText> = z.lazy(() =>
  z.object({
    key: z.string().min(1),
    params: z
      .record(z.union([z.string(), z.number(), localizedSchema, agentTextSchema, z.array(agentTextSchema)]))
      .optional(),
  }),
);

// ------------------------------------------------------------------ trail and activity log

export const TRAIL_KINDS = ['orchestrator', 'agent', 'tool', 'safety'] as const;
export type TrailKind = (typeof TRAIL_KINDS)[number];

export const trailStepSchema = z.object({
  kind: z.enum(TRAIL_KINDS),
  /** Agent id, tool name or safety check id. */
  name: z.string().min(1),
  result: agentTextSchema,
  ok: z.boolean(),
});
export type TrailStep = z.infer<typeof trailStepSchema>;

export const HUMAN_DECISIONS = ['pending', 'accepted', 'edited', 'dismissed', 'none'] as const;
export type HumanDecision = (typeof HUMAN_DECISIONS)[number];

export const ACTIVITY_ACTORS = ['patient', 'kiosk', 'doctor', 'desk', 'system'] as const;
export type ActivityActor = (typeof ACTIVITY_ACTORS)[number];

const activityBase = z.object({
  id: idSchema,
  agentId: agentIdSchema,
  actor: z.enum(ACTIVITY_ACTORS),
  userId: idSchema.optional(),
  patientId: idSchema.optional(),
  /** Orchestrator intent id, e.g. "symptoms", "queue_status", "record_uploaded". */
  intent: z.string().min(1),
  steps: z.array(trailStepSchema),
  summary: agentTextSchema,
  /** 0-100, when the agent reports one. */
  confidence: z.number().min(0).max(100).optional(),
  decision: z.enum(HUMAN_DECISIONS),
  ref: z.object({ kind: z.string(), id: idSchema }).optional(),
});
export const agentActivitySchema = activityBase.extend({ at: z.string().datetime() });
export type AgentActivity = z.infer<typeof agentActivitySchema>;
export const agentActivitySeedSchema = activityBase.extend({ day: dayOffsetSchema, time: z.string() });

export type AgentSettings = Record<AgentId, boolean>;

export const agentDefinitionSchema = z.object({
  id: agentIdSchema,
  /** Where it runs, e.g. ["patient", "kiosk"]. */
  surfaces: z.array(z.enum(['patient', 'kiosk', 'desk', 'doctor', 'admin'])),
  /** Workflow diagram steps, left to right. */
  workflow: z.array(z.string().min(1)),
  /** Today's numbers before the activity log starts (earlier shifts). */
  baseline: z.record(z.number().int().min(0)),
  /** Which activity intents count towards each metric. */
  metrics: z.record(z.array(z.string())),
});
export type AgentDefinition = z.infer<typeof agentDefinitionSchema>;

export interface AgentMetric {
  id: string;
  value: number;
}

export interface AgentOverview {
  definition: AgentDefinition;
  active: boolean;
  metrics: AgentMetric[];
  /** Share of reviewed outputs the human edited or dismissed, 0-100; null with nothing reviewed yet. */
  overrideRate: number | null;
  averageConfidence: number | null;
  /** Counts in 10-point buckets from 40 to 100. */
  confidenceBuckets: number[];
  lastActivityAt: string | null;
}

// ------------------------------------------------------------------ orchestrator conversation

export const INTENTS = [
  'symptoms',
  'queue_status',
  'book',
  'reschedule',
  'cancel',
  'my_appointments',
  'human',
  'greeting',
  'thanks',
  'medicine_question',
] as const;
export type Intent = (typeof INTENTS)[number];

export const URGENCIES = ['routine', 'soon', 'emergency'] as const;
export type Urgency = (typeof URGENCIES)[number];

export interface TriageResult {
  departmentId: string;
  urgency: Urgency;
  confidence: number;
  reasons: AgentText[];
  triageId?: string;
  /** Activity log entry, so the patient's choice can be recorded as the human decision. */
  activityId?: string;
}

export interface DoctorOption {
  doctorId: string;
  name: string;
  nameTa?: string;
  departmentId: string;
  date: string;
  start: string;
  fee: number;
  languages: Lang[];
  room: string;
}

/** Something the patient can tap; it is sent back to the orchestrator as a command. */
export type ChatCommand =
  /** Send the action's label as the patient's own words (quick replies). */
  | { type: 'reply' }
  /** Open a page in the app (handled by the screen, not the orchestrator). */
  | { type: 'open'; to: string }
  | { type: 'book' }
  | { type: 'pick_doctor'; doctorId: string }
  | { type: 'pick_slot'; date: string; start: string }
  | { type: 'other_times' }
  | { type: 'confirm' }
  | { type: 'decline' }
  | { type: 'escalate' }
  | { type: 'start_over' };

export interface ChatAction {
  id: string;
  label: AgentText;
  command: ChatCommand;
  tone?: 'primary' | 'outline';
}

export type ChatCard =
  | { kind: 'triage_result'; result: TriageResult }
  | { kind: 'doctor_options'; options: DoctorOption[] }
  | { kind: 'slots'; doctor: DoctorOption; date: string; starts: string[] }
  | { kind: 'confirm_booking'; doctor: DoctorOption }
  | {
      kind: 'booked';
      appointmentId: string;
      token: string;
      doctor: DoctorOption;
      bookingRef: string;
    }
  | {
      kind: 'queue_status';
      appointmentId: string;
      token: string;
      doctorName: string;
      doctorNameTa?: string;
      patientsAhead: number;
      expectedStart: string;
      leaveBy: string | null;
      checkedIn: boolean;
    }
  | {
      kind: 'appointments';
      items: { id: string; token: string; date: string; start: string; doctorName: string; doctorNameTa?: string }[];
    }
  | { kind: 'confirm_cancel'; appointmentId: string; token: string; date: string; start: string }
  | { kind: 'emergency'; redFlagId: string }
  | { kind: 'escalated'; reason: EscalationReason }
  | { kind: 'department_picker' };

export interface ChatMessage {
  id: string;
  from: 'patient' | 'assistant';
  /** The patient's own words. */
  text?: string;
  /** What the assistant says, in the reader's language. */
  say?: AgentText[];
  voice?: boolean;
  card?: ChatCard;
  actions?: ChatAction[];
  /** Orchestrator -> agents -> tools, with each step's short result. */
  trail?: TrailStep[];
}

export interface ConversationStatus {
  outcome: 'ongoing' | 'recommended' | 'emergency' | 'escalated' | 'booked';
  departmentId: string | null;
  redFlagId: string | null;
  triageId: string | null;
  /** A warning sign was seen: booking stays blocked for the rest of the conversation. */
  blocked: boolean;
  /** Age the patient gave, if any (the kiosk prefills its form with it). */
  age: number | null;
  /** The patient's first description, kept as the visit reason. */
  reason: string | null;
}

export interface ConversationStart {
  channel: Extract<Channel, 'app' | 'kiosk'>;
  lang: Lang;
  patientId?: string;
  userId?: string;
}

export interface ConversationInput {
  text?: string;
  voice?: boolean;
  command?: ChatCommand;
  lang: Lang;
}

export interface ConversationReply {
  messages: ChatMessage[];
  status: ConversationStatus;
}

// ------------------------------------------------------------------ medical records

export const RECORD_KINDS = ['prescription', 'lab_report', 'discharge_summary', 'other'] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

const extracted = <T extends z.ZodTypeAny>(value: T) =>
  z.object({ value, confidence: z.number().int().min(0).max(100) });
export const extractedTextSchema = extracted(z.string());
export type ExtractedText = z.infer<typeof extractedTextSchema>;

export const recordMedicineSchema = z.object({
  name: extractedTextSchema,
  dose: extractedTextSchema,
  frequency: extractedTextSchema,
});
export type RecordMedicine = z.infer<typeof recordMedicineSchema>;

export const recordTestSchema = z.object({
  name: extractedTextSchema,
  value: extractedTextSchema,
  unit: extractedTextSchema,
  range: extractedTextSchema,
});
export type RecordTest = z.infer<typeof recordTestSchema>;

export const extractionSchema = z.object({
  kind: extracted(z.enum(RECORD_KINDS)),
  date: extractedTextSchema,
  doctor: extractedTextSchema,
  hospital: extractedTextSchema,
  medicines: z.array(recordMedicineSchema),
  tests: z.array(recordTestSchema),
  diagnoses: z.array(extractedTextSchema),
});
export type Extraction = z.infer<typeof extractionSchema>;

export interface MedicalRecord extends Extraction {
  id: string;
  patientId: string;
  uploadedBy: string;
  fileName: string;
  fileType: 'image' | 'pdf';
  /** Sample document URL, or a small preview image kept with the record; absent for PDFs. */
  imageUrl?: string;
  sampleId?: string;
  status: 'review' | 'saved';
  /** The patient changed at least one extracted value before saving. */
  edited: boolean;
  createdAt: string;
  savedAt?: string;
  activityId?: string;
}

export interface RecordUpload {
  patientId: string;
  userId: string;
  fileName: string;
  fileType: 'image' | 'pdf';
  imageUrl?: string;
  sampleId?: string;
}

export const recordSampleSchema = z.object({
  id: idSchema,
  title: localizedSchema,
  file: z.string().min(1),
  /** Words in an uploaded file name that pick this sample's extraction. */
  match: z.array(z.string().min(1)),
  extraction: extractionSchema,
});
export type RecordSample = z.infer<typeof recordSampleSchema>;
export interface RecordSampleView {
  id: string;
  title: Localized;
  imageUrl: string;
}

/** Doctor-facing summary of what the patient reported and uploaded. Every item names its source. */
export type SummarySource =
  | { kind: 'conversation'; triageId: string; line?: number }
  | { kind: 'record'; recordId: string }
  | { kind: 'profile' };

export interface SummaryItem<T = string> {
  value: T;
  source: SummarySource;
}

export interface PreVisitSummary {
  appointmentId: string;
  patientId: string;
  triageId: string | null;
  lang: Lang;
  /** The patient's first message: why they came, in their own words. */
  chiefComplaint: SummaryItem | null;
  duration: SummaryItem | null;
  severity: SummaryItem<number> | null;
  /** Complaint-specific follow-up questions and the patient's answers. */
  associated: SummaryItem<{ question: Localized; answer: string }>[];
  conditions: SummaryItem[];
  medicines: SummaryItem<{ name: string; dose: string; frequency: string }>[];
  results: SummaryItem<{ name: string; value: string; unit: string; range: string; flag: RangeFlag }>[];
  diagnosesMentioned: SummaryItem[];
  safetyScreen: 'passed' | 'failed' | 'not_asked' | null;
  redFlagId: string | null;
  urgency: Urgency | null;
  confidence: number | null;
  recordCount: number;
  /** False while the medical records agent is paused: documents are left out. */
  recordsIncluded: boolean;
}

export type RangeFlag = 'high' | 'low' | 'normal' | 'unknown';

// ------------------------------------------------------------------ consultation scribe

export const transcriptLineSchema = z.object({
  speaker: z.enum(['doctor', 'patient']),
  text: z.string().min(1),
  /** Milliseconds this line takes to stream. */
  ms: z.number().int().min(200).max(10_000),
});
export type TranscriptLine = z.infer<typeof transcriptLineSchema>;

export const NOTE_FIELDS = [
  'chiefComplaint',
  'history',
  'examination',
  'assessment',
  'investigations',
  'advice',
] as const;
export type NoteFieldKey = (typeof NOTE_FIELDS)[number];

export const DOSE_SLOTS = ['morning', 'afternoon', 'night'] as const;
export type DoseSlot = (typeof DOSE_SLOTS)[number];
export const FOOD_TIMINGS = ['before', 'after', 'any'] as const;
export type FoodTiming = (typeof FOOD_TIMINGS)[number];

const scriptedField = z.object({ value: z.string(), line: z.number().int().min(0) });
const scriptedMedicine = z.object({
  medicine: z.string().min(1),
  dose: z.string().min(1),
  slots: z.array(z.enum(DOSE_SLOTS)).min(1),
  food: z.enum(FOOD_TIMINGS),
  days: z.number().int().min(1).max(365),
  line: z.number().int().min(0),
});

export const scribeScriptSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  match: z.object({ patientIds: z.array(idSchema).optional(), departmentIds: z.array(idSchema).optional() }),
  lines: z.array(transcriptLineSchema).min(4),
  draft: z.object({
    fields: z.object(
      Object.fromEntries(NOTE_FIELDS.map((k) => [k, scriptedField])) as Record<NoteFieldKey, typeof scriptedField>,
    ),
    followUpDays: z.object({ value: z.number().int().min(1).max(180), line: z.number().int().min(0) }),
    prescription: z.array(scriptedMedicine),
  }),
});
export type ScribeScript = z.infer<typeof scribeScriptSchema>;

/** One note field. `ai` = drafted by the scribe; `reviewed` = the doctor edited or confirmed it. */
export interface NoteField {
  value: string;
  ai: boolean;
  reviewed: boolean;
}

export interface PrescriptionItem {
  id: string;
  medicine: string;
  dose: string;
  slots: DoseSlot[];
  food: FoodTiming;
  days: number;
  ai: boolean;
  reviewed: boolean;
}

export interface ConsultationNote {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  scriptId: string;
  status: 'draft' | 'signed';
  transcript: TranscriptLine[];
  fields: Record<NoteFieldKey, NoteField>;
  followUpDate: NoteField;
  prescription: PrescriptionItem[];
  /** AI-drafted values the doctor changed before signing. */
  editedCount: number;
  createdAt: string;
  updatedAt: string;
  signedAt?: string;
  signedBy?: string;
  activityId?: string;
}

// ------------------------------------------------------------------ care companion

export interface CareMedicine {
  id: string;
  name: string;
  dose: string;
  slots: DoseSlot[];
  food: FoodTiming;
  days: number;
  startDate: string;
  endDate: string;
}

/** A line of the doctor's advice; `ta` is set when the line has an approved Tamil version. */
export interface CareLine {
  en: string;
  ta?: string;
}

export interface CheckIn {
  id: string;
  day: number;
  question: Localized;
  sentAt: string;
  reply?: string;
  repliedAt?: string;
  outcome?: 'better' | 'same' | 'warning' | 'emergency';
}

export interface DoseTick {
  date: string;
  medicineId: string;
  slot: DoseSlot;
  at: string;
}

export interface CarePlan {
  id: string;
  patientId: string;
  doctorId: string;
  departmentId: string;
  appointmentId: string;
  noteId: string;
  complaint: CareLine;
  medicines: CareMedicine[];
  advice: CareLine[];
  tests: CareLine[];
  followUpDate: string | null;
  checkIns: CheckIn[];
  doses: DoseTick[];
  createdAt: string;
}

export type CareSource =
  | { kind: 'medicine'; medicineId: string }
  | { kind: 'advice'; index: number }
  | { kind: 'test'; index: number }
  | { kind: 'followUp' };

export interface CareMessage {
  id: string;
  planId: string;
  from: 'patient' | 'assistant' | 'doctor';
  text?: string;
  say?: AgentText[];
  sources?: CareSource[];
  kind: 'answer' | 'asked_doctor' | 'refused' | 'check_in' | 'urgent' | 'emergency' | 'doctor_reply' | 'question';
  checkInId?: string;
  redFlagId?: string;
  queryId?: string;
  trail?: TrailStep[];
  at: string;
}

export interface DoctorQuery {
  id: string;
  planId: string;
  patientId: string;
  doctorId: string;
  kind: 'question' | 'alert';
  urgent: boolean;
  text: string;
  /** Why the companion did not answer, or which warning sign it saw. */
  reason: AgentText;
  status: 'open' | 'answered' | 'acknowledged';
  reply?: string;
  createdAt: string;
  answeredAt?: string;
  activityId?: string;
}

// ------------------------------------------------------------------ static data that drives the simulation

const phraseListSchema = z.object({
  en: z.array(z.string().min(1)),
  ta: z.array(z.string().min(1)),
  tanglish: z.array(z.string().min(1)),
});
export type PhraseList = z.infer<typeof phraseListSchema>;

export const intentRulesSchema = z.object({
  intents: z.array(z.object({ id: z.enum(INTENTS), phrases: phraseListSchema })),
});

export const safetyRulesSchema = z.object({
  /** Regular expressions; a reply that matches one is never shown to a patient. */
  diagnosisPatterns: z.array(z.string().min(1)),
  doseWords: phraseListSchema,
  medicineWords: phraseListSchema,
  questionWords: phraseListSchema,
});
export type SafetyRules = z.infer<typeof safetyRulesSchema>;

export const synonymSchema = z.object({ means: z.string().min(1), terms: z.array(z.string().min(1)).min(1) });
export type Synonym = z.infer<typeof synonymSchema>;

export const followUpQuestionSchema = z.object({
  id: z.string().regex(/^[a-z_]+$/),
  text: localizedSchema,
  quick: z.array(localizedSchema),
  /** Words in the answer that make the visit more urgent, with the reason to show. */
  soonIf: keywordListSchema.optional(),
  soonReason: localizedSchema.optional(),
});
export type FollowUpQuestion = z.infer<typeof followUpQuestionSchema>;

export const followUpSetSchema = z.object({
  ruleIds: z.array(idSchema).min(1),
  questions: z.array(followUpQuestionSchema),
  soon: z.object({
    minSeverity: z.number().int().min(1).max(10),
    /** With one of the risk conditions, this age or older makes the visit "soon". */
    minAge: z.number().int().min(0).max(120).optional(),
    maxAge: z.number().int().min(0).max(120).optional(),
  }),
});
export type FollowUpSet = z.infer<typeof followUpSetSchema>;

export const riskConditionSchema = z.object({ terms: keywordListSchema, label: localizedSchema });
export type RiskCondition = z.infer<typeof riskConditionSchema>;

export const careIntentSchema = z.object({
  id: z.enum(['missed_dose', 'food', 'timing', 'duration', 'follow_up', 'tests', 'diet', 'activity', 'side_effect']),
  terms: phraseListSchema,
});
export type CareIntent = z.infer<typeof careIntentSchema>;

export const careTemplatesSchema = z.object({
  checkIns: z.array(z.object({ departmentId: z.string(), day: z.number().int().min(1), question: localizedSchema })),
  warningSigns: z.array(z.object({ departmentId: z.string(), terms: phraseListSchema, label: localizedSchema })),
  better: phraseListSchema,
  slotWords: z.record(z.enum(DOSE_SLOTS), phraseListSchema),
  /** Advice topics: words in a question and in an advice line that tie them together. */
  topics: z.record(z.array(z.string().min(1))),
});
export type CareTemplates = z.infer<typeof careTemplatesSchema>;

export const phraseSchema = z.object({ en: z.string().min(1), ta: z.string().min(1) });

// ------------------------------------------------------------------ sample data (src/data/records, src/data/care)

const careSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('medicine'), medicineId: idSchema }),
  z.object({ kind: z.literal('advice'), index: z.number().int().min(0) }),
  z.object({ kind: z.literal('test'), index: z.number().int().min(0) }),
  z.object({ kind: z.literal('followUp') }),
]);

/** A saved health record; `image` names its scan in src/data/records/samples. */
export const recordSeedSchema = extractionSchema.extend({
  id: idSchema,
  patientId: idSchema,
  uploadedBy: idSchema,
  fileName: z.string().min(1),
  image: z.string().min(1),
  edited: z.boolean(),
  day: dayOffsetSchema,
  at: z.string(),
});

export const carePlanSeedSchema = z.object({
  id: idSchema,
  patientId: idSchema,
  doctorId: idSchema,
  departmentId: idSchema,
  appointmentId: idSchema,
  noteId: idSchema,
  day: dayOffsetSchema,
  at: z.string(),
  complaint: z.string(),
  medicines: z.array(
    z.object({
      id: idSchema,
      name: z.string().min(1),
      dose: z.string().min(1),
      slots: z.array(z.enum(DOSE_SLOTS)).min(1),
      food: z.enum(FOOD_TIMINGS),
      days: z.number().int().min(1),
    }),
  ),
  advice: z.array(z.string().min(1)),
  tests: z.array(z.string().min(1)),
  followUpDay: dayOffsetSchema.nullable(),
  checkIns: z.array(
    z.object({
      id: idSchema,
      day: z.number().int().min(1),
      question: localizedSchema,
      sentDay: dayOffsetSchema,
      sentAt: z.string(),
      reply: z.string().optional(),
      repliedAt: z.string().optional(),
      outcome: z.enum(['better', 'same', 'warning', 'emergency']).optional(),
    }),
  ),
  doses: z.array(z.object({ medicineId: idSchema, slot: z.enum(DOSE_SLOTS), day: dayOffsetSchema, at: z.string() })),
});

export const careMessageSeedSchema = z.object({
  id: idSchema,
  planId: idSchema,
  from: z.enum(['patient', 'assistant', 'doctor']),
  text: z.string().optional(),
  say: z.array(agentTextSchema).optional(),
  sources: z.array(careSourceSchema).optional(),
  kind: z.enum(['answer', 'asked_doctor', 'refused', 'check_in', 'urgent', 'emergency', 'doctor_reply', 'question']),
  checkInId: idSchema.optional(),
  queryId: idSchema.optional(),
  trail: z.array(trailStepSchema).optional(),
  day: dayOffsetSchema,
  at: z.string(),
});

export const doctorQuerySeedSchema = z.object({
  id: idSchema,
  planId: idSchema,
  patientId: idSchema,
  doctorId: idSchema,
  kind: z.enum(['question', 'alert']),
  urgent: z.boolean(),
  text: z.string().min(1),
  reason: agentTextSchema,
  status: z.enum(['open', 'answered', 'acknowledged']),
  reply: z.string().optional(),
  day: dayOffsetSchema,
  at: z.string(),
  answeredDay: dayOffsetSchema.optional(),
  answeredAt: z.string().optional(),
});
