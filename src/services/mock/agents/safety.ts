// The safety layer around every patient-facing reply. Before: warning signs (emergency, booking blocked) and
// medicine-dose questions (never answered by an agent). After: no diagnosis wording ever reaches a patient.
import { detectRedFlag, expandSynonyms, mentionsAny, type TriageRules } from '@/features/triage/engine';
import type { AgentText, AgentTextParam, RedFlag, SafetyRules, TrailStep } from '@/types';
import { phrases, say, step } from './shared';

export function redFlagIn(text: string, rules: TriageRules): RedFlag | null {
  return detectRedFlag(expandSynonyms(text, rules.synonyms), rules.redFlags);
}

const isQuestion = (text: string, safety: SafetyRules) =>
  text.includes('?') || mentionsAny(text, phrases(safety.questionWords));

/** A question about taking a medicine or its dose ("can I take dolo?", "ethana tablet podalam?"). */
export function isMedicineQuestion(text: string, safety: SafetyRules): boolean {
  if (!isQuestion(text, safety)) return false;
  return mentionsAny(text, phrases(safety.medicineWords)) || mentionsAny(text, phrases(safety.doseWords));
}

/** Asks to change a dose: more, less, double, extra. Only the doctor answers these. */
export const asksDoseChange = (text: string, safety: SafetyRules): boolean =>
  mentionsAny(text, phrases(safety.doseWords));

const patternCache = new Map<string, RegExp>();
const patternOf = (source: string) => {
  let pattern = patternCache.get(source);
  if (!pattern) {
    pattern = new RegExp(source, 'iu');
    patternCache.set(source, pattern);
  }
  return pattern;
};

export const hasDiagnosisWording = (text: string, safety: SafetyRules): boolean =>
  safety.diagnosisPatterns.some((p) => patternOf(p).test(text));

function literals(value: AgentTextParam | undefined, into: string[]): string[] {
  if (value === undefined) return into;
  if (typeof value === 'string') into.push(value);
  else if (typeof value === 'number') return into;
  else if (Array.isArray(value)) value.forEach((v) => literals(v, into));
  else if ('key' in value) Object.values(value.params ?? {}).forEach((v) => literals(v, into));
  else into.push(value.en, value.ta);
  return into;
}

/**
 * Post-check: every piece of free text inside a reply (names, quoted advice, doctor's words) is scanned for
 * diagnosis wording. Template text is reviewed in the locale files; anything else that fails is replaced.
 */
export function checkReply(reply: AgentText[], safety: SafetyRules): { say: AgentText[]; step: TrailStep } {
  const texts = reply.flatMap((t) => literals(t, []));
  if (texts.some((t) => hasDiagnosisWording(t, safety))) {
    return {
      say: [say('triage:orchestrator.rephrased')],
      step: step('safety', 'noDiagnosis', say('triage:trail.rephrased'), false),
    };
  }
  return { say: reply, step: step('safety', 'noDiagnosis', say('triage:trail.noDiagnosis')) };
}
