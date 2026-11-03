// Triage agent assessment: how soon the patient should be seen, how sure the routing is, and the plain-language
// reasons behind it ("chest discomfort + age 52 + BP history"). Pure; never a diagnosis.
import type { AgentText, Urgency } from '@/types';
import {
  expandSynonyms,
  followUpSetFor,
  mentions,
  mentionsAny,
  scoreDepartments,
  type TriageRules,
  type TriageState,
} from './engine';

export interface TriageAssessment {
  urgency: Urgency;
  /** 0-100. Below LOW_CONFIDENCE the patient is offered the front desk. */
  confidence: number;
  reasons: AgentText[];
}

export const LOW_CONFIDENCE = 70;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Long-term conditions from the conversation and the patient's record that match a risk condition. */
function riskLabels(state: TriageState, rules: TriageRules, recordConditions: readonly string[]) {
  const said = [state.answers.conditions, ...recordConditions].filter(Boolean).join('. ');
  if (!said) return [];
  return (rules.riskConditions ?? []).filter((c) => mentionsAny(said, [...c.terms.en, ...c.terms.ta]));
}

export function assessTriage(
  state: TriageState,
  rules: TriageRules,
  profile: { conditions?: readonly string[] } = {},
): TriageAssessment {
  if (state.outcome === 'emergency') return { urgency: 'emergency', confidence: 95, reasons: [] };

  // Confidence: how strongly the words point to one department, and how clearly ahead of the next one.
  const ranked = scoreDepartments(expandSynonyms(state.symptomText.join('. '), rules.synonyms), rules);
  const chosen = ranked.find((r) => r.departmentId === state.departmentId);
  const runnerUp = ranked.find((r) => r.departmentId !== state.departmentId);
  const top = chosen?.score ?? 0;
  const strength = Math.min(top, 3) / 3;
  const margin = top > 0 ? Math.max(0, top - (runnerUp?.score ?? 0)) / top : 0;
  const questions = state.asked.filter((q) => q !== 'more' && q !== 'safety');
  const answered = questions.length ? new Set(questions).size / Math.max(questions.length, 1) : 0;
  let confidence = 49 + 24 * strength + 12 * margin + 6 * answered;
  if (state.asked.includes('more')) confidence -= 14;
  if (chosen && ranked[0] && ranked[0].departmentId !== chosen.departmentId) confidence -= 6;
  confidence = Math.round(clamp(confidence, 30, 97));

  const set = followUpSetFor(state, rules);
  const rule = rules.symptomRules.find((r) => r.id === state.ruleIds[0]);
  const risks = riskLabels(state, rules, profile.conditions ?? []);
  const age = state.answers.age;
  const severity = state.answers.severity;
  const reasons: AgentText[] = [];
  let soon = false;

  if (rule) reasons.push({ key: 'triage:reasons.symptom', params: { label: rule.label } });
  if (age !== undefined && (age >= 40 || age < 14)) reasons.push({ key: 'triage:reasons.age', params: { age } });
  for (const risk of risks) reasons.push({ key: 'triage:reasons.condition', params: { label: risk.label } });

  for (const question of set?.questions ?? []) {
    const answer = state.answers.extra?.[question.id];
    if (!answer || !question.soonIf) continue;
    if ([...question.soonIf.en, ...question.soonIf.ta].some((w) => mentions(answer, w))) {
      soon = true;
      if (question.soonReason) reasons.push({ key: 'triage:reasons.followUp', params: { label: question.soonReason } });
    }
  }
  if (severity !== undefined && severity >= (set?.soon.minSeverity ?? 8)) {
    soon = true;
    reasons.push({ key: 'triage:reasons.severity', params: { value: severity } });
  }
  if (set?.soon.minAge !== undefined && age !== undefined && age >= set.soon.minAge && risks.length > 0) soon = true;
  if (set?.soon.maxAge !== undefined && age !== undefined && age <= set.soon.maxAge) soon = true;
  if (state.answers.duration && reasons.length < 3) {
    reasons.push({ key: 'triage:reasons.duration', params: { duration: state.answers.duration } });
  }

  return { urgency: soon ? 'soon' : 'routine', confidence, reasons: reasons.slice(0, 4) };
}
