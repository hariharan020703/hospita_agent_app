import type {
  AgentActivity,
  AgentSettings,
  AppNotification,
  CareMessage,
  CarePlan,
  ConsultationNote,
  DoctorQuery,
  MedicalRecord,
  Appointment,
  Department,
  Doctor,
  DoctorDay,
  Escalation,
  Hospital,
  Leave,
  Patient,
  RedFlag,
  Schedule,
  SymptomRule,
  TriageSession,
  User,
} from '@/types';

/**
 * Everything the mock data source stores. Persisted to localStorage and shared across tabs.
 * Bump DB_VERSION (seed.ts) whenever this shape changes, so browsers holding an older copy reseed.
 */
export interface DbState {
  version: number;
  /** The date the sample data was generated for; a new day starts from fresh sample data. */
  seededFor: string;
  hospital: Hospital;
  users: User[];
  patients: Patient[];
  departments: Department[];
  doctors: Doctor[];
  schedules: Schedule[];
  leaves: Leave[];
  appointments: Appointment[];
  doctorDays: DoctorDay[];
  triage: TriageSession[];
  escalations: Escalation[];
  symptomRules: SymptomRule[];
  redFlags: RedFlag[];
  notifications: AppNotification[];
  /** Doctors whose queue a signed-in doctor is running today; the background simulation leaves them alone. */
  manualDoctorIds: string[];
  /** Which agents are switched on (admin -> Agents). A paused agent's UI is hidden and the normal flow is used. */
  agentSettings: AgentSettings;
  /** What the orchestrator and agents did, newest last, with the human decision on each output. */
  agentActivity: AgentActivity[];
  /** Documents patients uploaded, with what the records agent read from them. */
  records: MedicalRecord[];
  /** Scribe notes, draft or signed, one per consultation. */
  notes: ConsultationNote[];
  carePlans: CarePlan[];
  careMessages: CareMessage[];
  /** Patient questions and warning-sign alerts waiting for the doctor. */
  doctorQueries: DoctorQuery[];
}
