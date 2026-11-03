// The service contract. UI code depends only on these interfaces; mock and API implementations both satisfy them.
import type {
  AgentActivity,
  AgentId,
  AgentOverview,
  AgentSettings,
  AppNotification,
  AppointmentFilters,
  AppointmentView,
  BookingInput,
  CancelReason,
  CareMessage,
  CarePlan,
  ChatMessage,
  ConversationInput,
  ConversationReply,
  ConversationStart,
  ConsultationNote,
  DoseSlot,
  DoctorQuery,
  DashboardData,
  DateRange,
  Department,
  DepartmentFormValues,
  Doctor,
  DoctorDay,
  DoctorFilters,
  DoctorFormValues,
  DoctorQueue,
  DoctorStatus,
  Escalation,
  Extraction,
  EscalationReason,
  Hospital,
  HumanDecision,
  Leave,
  LeaveRequestValues,
  MedicalRecord,
  NewTriageSession,
  Patient,
  PatientFormValues,
  PreVisitSummary,
  QueueEstimate,
  RecordSampleView,
  RecordUpload,
  RedFlag,
  Schedule,
  Session,
  SymptomRule,
  TranscriptLine,
  TriageSession,
  User,
  WeeklyHours,
} from '@/types';
import type { Slot } from '@/features/appointments/availability';
import type { TriageRules } from '@/features/triage/engine';

export interface DoctorListItem extends Doctor {
  nextAvailable: { date: string; start: string } | null;
}

export interface AuthService {
  listDemoAccounts(): Promise<User[]>;
  signInAs(userId: string): Promise<Session>;
  requestOtp(phone: string): Promise<{ sentTo: string }>;
  verifyOtp(phone: string, code: string): Promise<Session>;
  getUser(userId: string): Promise<User>;
}

export interface HospitalService {
  get(): Promise<Hospital>;
  update(hospital: Hospital): Promise<Hospital>;
}

export interface DepartmentService {
  list(options?: { includeInactive?: boolean }): Promise<Department[]>;
  get(id: string): Promise<Department>;
  create(values: DepartmentFormValues): Promise<Department>;
  update(id: string, values: DepartmentFormValues): Promise<Department>;
}

export interface DoctorService {
  list(filters?: DoctorFilters): Promise<DoctorListItem[]>;
  get(id: string): Promise<DoctorListItem>;
  create(values: DoctorFormValues): Promise<Doctor>;
  update(id: string, values: DoctorFormValues): Promise<Doctor>;
  setActive(id: string, active: boolean): Promise<Doctor>;
}

export interface ScheduleService {
  get(doctorId: string): Promise<Schedule>;
  updateWeekly(doctorId: string, weekly: WeeklyHours): Promise<Schedule>;
  listLeaves(filter?: { doctorId?: string; status?: Leave['status'] }): Promise<Leave[]>;
  requestLeave(doctorId: string, values: LeaveRequestValues): Promise<Leave>;
  decideLeave(id: string, status: 'approved' | 'rejected', userId: string): Promise<Leave>;
}

export interface WalkInInput {
  patientId: string;
  departmentId: string;
  doctorId?: string;
  source: 'kiosk' | 'desk';
  triageId?: string;
  reason?: string;
}

export interface AppointmentService {
  list(filters?: AppointmentFilters): Promise<AppointmentView[]>;
  get(id: string): Promise<AppointmentView>;
  getByRef(bookingRef: string): Promise<AppointmentView>;
  slots(doctorId: string, date: string): Promise<Slot[]>;
  book(input: BookingInput): Promise<AppointmentView>;
  reschedule(id: string, change: { date: string; start: string }, by: 'patient' | 'staff'): Promise<AppointmentView>;
  cancel(id: string, reason: CancelReason): Promise<AppointmentView>;
  checkIn(id: string): Promise<AppointmentView>;
  markNoShow(id: string): Promise<AppointmentView>;
  reassign(id: string, doctorId: string): Promise<AppointmentView>;
  issueWalkIn(input: WalkInInput): Promise<AppointmentView>;
  callNext(doctorId: string): Promise<AppointmentView | null>;
  complete(id: string, note?: string): Promise<AppointmentView>;
  addNote(id: string, note: string): Promise<AppointmentView>;
  scheduleFollowUp(id: string, slot: { date: string; start: string }): Promise<AppointmentView>;
}

export interface QueueService {
  getDoctorDay(doctorId: string): Promise<DoctorDay>;
  setDoctorStatus(
    doctorId: string,
    update: { status: DoctorStatus; delayMins?: number; breakMins?: number },
  ): Promise<DoctorDay>;
  board(): Promise<DoctorQueue[]>;
  doctorQueue(doctorId: string): Promise<DoctorQueue>;
  estimate(appointmentId: string, travelMins?: number): Promise<QueueEstimate>;
}

export interface NewPatientInput {
  values: PatientFormValues;
  consent?: { notifications: boolean };
}

export interface PatientService {
  get(id: string): Promise<Patient>;
  list(filter?: { q?: string }): Promise<Patient[]>;
  household(householdId: string): Promise<Patient[]>;
  search(q: string): Promise<Patient[]>;
  findByPhone(phone: string): Promise<Patient[]>;
  /** Patient app sign-up: creates the account holder's record and links it to the user. */
  registerAccountHolder(userId: string, input: NewPatientInput): Promise<Patient>;
  addFamilyMember(householdId: string, values: PatientFormValues): Promise<Patient>;
  /** Kiosk and front desk: create a patient record for a walk-in (or reuse a matching one). */
  registerWalkIn(input: NewPatientInput): Promise<Patient>;
  update(id: string, values: PatientFormValues): Promise<Patient>;
  acceptConsent(id: string, notifications: boolean): Promise<Patient>;
}

export interface TriageService {
  rules(): Promise<TriageRules>;
  save(session: NewTriageSession): Promise<TriageSession>;
  get(id: string): Promise<TriageSession>;
  listSymptomRules(departmentId?: string): Promise<SymptomRule[]>;
  saveSymptomRule(rule: Omit<SymptomRule, 'id'> & { id?: string }): Promise<SymptomRule>;
  deleteSymptomRule(id: string): Promise<void>;
  listRedFlags(): Promise<RedFlag[]>;
  saveRedFlag(flag: Omit<RedFlag, 'id'> & { id?: string }): Promise<RedFlag>;
  deleteRedFlag(id: string): Promise<void>;
}

export interface EscalationService {
  list(filter?: { status?: Escalation['status'] }): Promise<Escalation[]>;
  create(input: {
    reason: EscalationReason;
    summary: string;
    channel: Escalation['channel'];
    patientId?: string;
    phone?: string;
    triageId?: string;
  }): Promise<Escalation>;
  resolve(id: string, resolution: string, userId: string): Promise<Escalation>;
}

export interface NotificationService {
  list(userId: string): Promise<AppNotification[]>;
  markRead(id: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
}

export interface AnalyticsService {
  dashboard(range: DateRange): Promise<DashboardData>;
}

export interface SystemService {
  /** Mock data source only: restore the sample data and restart the pinned clock. */
  resetData(): Promise<void>;
  /** Subscribe to data changes made elsewhere (other tabs, background simulation). */
  subscribe(listener: () => void): () => void;
  /** Start background work (mock queue simulation). Returns a stop function. */
  start(): () => void;
}

/** The orchestrator: single entry point for patient and kiosk conversations. */
export interface OrchestratorApi {
  start(input: ConversationStart): Promise<{ conversationId: string; messages: ChatMessage[] }>;
  send(conversationId: string, input: ConversationInput): Promise<ConversationReply>;
}

export interface AgentAdminApi {
  settings(): Promise<AgentSettings>;
  overview(): Promise<AgentOverview[]>;
  setActive(id: AgentId, active: boolean): Promise<AgentSettings>;
  activity(filter?: { agentId?: AgentId; limit?: number }): Promise<AgentActivity[]>;
  /** Record what a person did with an agent's output. */
  decide(activityId: string, decision: HumanDecision): Promise<void>;
}

/** Agent 2, medical records: reads uploaded documents; the patient checks them; the doctor sees a summary. */
export interface RecordsApi {
  /** Sample documents a patient can try (demo scans with known extractions). */
  samples(): Promise<RecordSampleView[]>;
  list(patientIds: string[]): Promise<MedicalRecord[]>;
  get(id: string): Promise<MedicalRecord>;
  /** Reads the document (report uploaded -> orchestrator -> records agent). The result waits for the patient's check. */
  extract(upload: RecordUpload): Promise<MedicalRecord>;
  /** The patient confirms or corrects the extracted values. */
  save(id: string, values: Extraction): Promise<MedicalRecord>;
  remove(id: string): Promise<void>;
  /** Pre-visit summary for the doctor: the triage conversation plus the patient's checked documents. */
  preVisitSummary(appointmentId: string): Promise<PreVisitSummary>;
}

/** Agent 3, consultation scribe: listens, drafts the note and prescription; nothing is final until the doctor signs. */
export interface ScribeApi {
  /** Consultation started: what the scribe hears (the demo plays a scripted consultation). */
  listen(appointmentId: string): Promise<{ scriptId: string; lines: TranscriptLine[] }>;
  /** Consultation ended: a draft note from the lines heard so far. */
  draft(appointmentId: string, heard: number): Promise<ConsultationNote>;
  note(appointmentId: string): Promise<ConsultationNote | null>;
  saveDraft(note: ConsultationNote): Promise<ConsultationNote>;
  /** Prescription signed: the note becomes final and the orchestrator hands it to the care companion. */
  sign(note: ConsultationNote, userId: string): Promise<{ note: ConsultationNote; plan: CarePlan | null }>;
  discard(noteId: string): Promise<void>;
}

/** Agent 4, care companion: the patient's care plan, its checklist and chat, follow-up check-ins, doctor queries. */
export interface CareApi {
  plans(patientIds: string[]): Promise<CarePlan[]>;
  plan(id: string): Promise<CarePlan>;
  messages(planId: string): Promise<CareMessage[]>;
  /** A patient message: a question about the plan, or a reply to a check-in. */
  ask(planId: string, text: string): Promise<CareMessage[]>;
  markDose(
    planId: string,
    dose: { medicineId: string; slot: DoseSlot; date: string },
    taken: boolean,
  ): Promise<CarePlan>;
  /** Demo control: send the day-N check-in now. */
  simulateCheckIn(planId: string, day: number): Promise<CareMessage[]>;
  followUps(doctorId: string): Promise<DoctorQuery[]>;
  reply(queryId: string, text: string, userId: string): Promise<DoctorQuery>;
  acknowledge(queryId: string): Promise<DoctorQuery>;
}

/**
 * The orchestrator and its agents. Only a mock implementation exists: all "AI" behaviour is simulated in the
 * browser from src/data, and the tools it calls wrap the services below.
 */
export interface AgentService {
  orchestrator: OrchestratorApi;
  records: RecordsApi;
  scribe: ScribeApi;
  care: CareApi;
  admin: AgentAdminApi;
}

export interface Services {
  auth: AuthService;
  hospital: HospitalService;
  departments: DepartmentService;
  doctors: DoctorService;
  schedules: ScheduleService;
  appointments: AppointmentService;
  queue: QueueService;
  patients: PatientService;
  triage: TriageService;
  escalations: EscalationService;
  notifications: NotificationService;
  analytics: AnalyticsService;
  system: SystemService;
}
