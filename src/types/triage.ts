import { z } from 'zod';
import { channelSchema, dateTimeSchema, dayOffsetSchema, idSchema, langSchema, localizedSchema } from './common';

export const keywordListSchema = z.object({ en: z.array(z.string().min(1)), ta: z.array(z.string().min(1)) });
export type KeywordList = z.infer<typeof keywordListSchema>;

export const symptomRuleSchema = z.object({
  id: idSchema,
  departmentId: idSchema,
  label: localizedSchema,
  /** English keywords (including Tanglish spellings) and Tamil keywords. */
  keywords: keywordListSchema,
  weight: z.number().min(0.1).max(5),
});
export type SymptomRule = z.infer<typeof symptomRuleSchema>;

/** Every term in a group must appear for the group to match; any matching group raises the flag. */
const termGroups = z.array(z.array(z.string().min(1)).min(1));

export const redFlagSchema = z.object({
  id: idSchema,
  label: localizedSchema,
  groups: z.object({ en: termGroups, ta: termGroups }),
  /** Extra number to show on the emergency screen, e.g. a mental-health helpline. */
  helpline: z.object({ label: localizedSchema, number: z.string().min(3) }).optional(),
  active: z.boolean(),
});
export type RedFlag = z.infer<typeof redFlagSchema>;

export const TRIAGE_OUTCOMES = ['recommended', 'emergency', 'escalated'] as const;
export const ESCALATION_REASONS = ['unclear_routing', 'asked_for_human', 'safety_unclear'] as const;
export type EscalationReason = (typeof ESCALATION_REASONS)[number];

export const triageMessageSchema = z.object({
  from: z.enum(['patient', 'assistant']),
  text: z.string(),
  voice: z.boolean().optional(),
});
export type TriageMessage = z.infer<typeof triageMessageSchema>;

export const triageAnswersSchema = z.object({
  duration: z.string().optional(),
  severity: z.number().int().min(1).max(10).optional(),
  age: z.number().int().min(0).max(120).optional(),
  conditions: z.string().optional(),
  /** Answers to complaint-specific follow-up questions, by question id. */
  extra: z.record(z.string()).optional(),
});
export type TriageAnswers = z.infer<typeof triageAnswersSchema>;

const triageBase = z.object({
  id: idSchema,
  patientId: idSchema.optional(),
  lang: langSchema,
  channel: channelSchema,
  messages: z.array(triageMessageSchema),
  answers: triageAnswersSchema,
  departmentId: idSchema.optional(),
  matchedKeywords: z.array(z.string()),
  redFlagId: z.string().optional(),
  safetyScreen: z.enum(['passed', 'failed', 'not_asked']),
  outcome: z.enum(TRIAGE_OUTCOMES),
  escalationReason: z.enum(ESCALATION_REASONS).optional(),
  /** Triage agent assessment: how soon to be seen and how sure the routing is (0-100). */
  urgency: z.enum(['routine', 'soon', 'emergency']).optional(),
  confidence: z.number().min(0).max(100).optional(),
});

export const triageSessionSchema = triageBase.extend({ createdAt: dateTimeSchema });
export type TriageSession = z.infer<typeof triageSessionSchema>;
export type NewTriageSession = Omit<TriageSession, 'id' | 'createdAt'>;

export const triageSeedSchema = triageBase.extend({ day: dayOffsetSchema, at: z.string() });
