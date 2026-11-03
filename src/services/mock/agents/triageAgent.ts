// Agent 1, triage: the engine (src/features/triage) decides; this turns its replies into agent text and quick
// replies, with complaint-specific follow-ups from src/data/triage and the patient's profile where it helps.
import {
  createTriageState,
  safetyQuestionFor,
  type TriageReply,
  type TriageRules,
  type TriageState,
} from '@/features/triage/engine';
import type { AgentText, ChatAction, FollowUpQuestion, Lang } from '@/types';
import type { AgentData } from './data';
import { say } from './shared';

export interface PatientProfileFacts {
  name: string;
  age: number | null;
  conditions: string[];
}

/** Rules for this conversation: admin-editable rules from the database plus the static triage data. */
export const withStaticRules = (rules: TriageRules, data: AgentData): TriageRules => ({
  ...rules,
  synonyms: data.synonyms,
  followUps: data.followUps,
  riskConditions: data.riskConditions,
});

export const newTriage = (lang: Lang): TriageState => createTriageState(lang);

function followUp(id: string, rules: TriageRules): FollowUpQuestion | undefined {
  for (const set of rules.followUps ?? []) {
    const question = set.questions.find((q) => q.id === id);
    if (question) return question;
  }
  return undefined;
}

export function questionText(reply: Extract<TriageReply, { kind: 'question' }>, rules: TriageRules): AgentText[] {
  const q = reply.question;
  if (q === 'safety') {
    const question = say(`triage:questions.safety.${safetyQuestionFor(reply.departmentId)}`);
    return reply.repeat ? [say('triage:repeat.safety'), question] : [question];
  }
  if (q.startsWith('fu:')) {
    const question = followUp(q.slice(3), rules);
    return question ? [say('triage:orchestrator.literal', { text: question.text })] : [say('triage:questions.more')];
  }
  if (reply.repeat && (q === 'severity' || q === 'age')) return [say(`triage:repeat.${q}`)];
  return [say(`triage:questions.${q}`)];
}

const quick = (id: string, label: AgentText): ChatAction => ({ id, label, command: { type: 'reply' } });

export function quickReplies(
  state: TriageState,
  rules: TriageRules,
  profile: PatientProfileFacts | null,
): ChatAction[] {
  const pending = state.pending;
  switch (pending) {
    case null:
    case 'more':
      return [];
    case 'safety':
      return [quick('no', say('triage:quick.no')), quick('yes', say('triage:quick.yes'))];
    case 'duration':
      return (['durationToday', 'durationDays', 'durationWeek', 'durationLonger'] as const).map((k) =>
        quick(k, say(`triage:quick.${k}`)),
      );
    case 'severity':
      return (['severityMild', 'severityModerate', 'severitySevere'] as const).map((k) =>
        quick(k, say(`triage:quick.${k}`)),
      );
    case 'age':
      return profile?.age !== null && profile?.age !== undefined
        ? [quick('age', say('triage:orchestrator.ageFromProfile', { age: profile.age }))]
        : [];
    case 'conditions':
      return [
        ...(profile?.conditions ?? []).map((c, i) =>
          quick(`condition${i}`, say('triage:orchestrator.literal', { text: c })),
        ),
        quick('none', say('triage:quick.conditionsNone')),
      ];
    default: {
      const question = followUp(pending.slice(3), rules);
      return (question?.quick ?? []).map((label, i) =>
        quick(`fu${i}`, say('triage:orchestrator.literal', { text: label })),
      );
    }
  }
}
