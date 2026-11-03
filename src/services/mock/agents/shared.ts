// Helpers shared by the simulated agents: a realistic "thinking" pause, agent text, trail steps and the activity log.
import { env } from '@/config/env';
import { newId } from '@/lib/id';
import type {
  AgentActivity,
  AgentId,
  AgentText,
  AgentTextParam,
  HumanDecision,
  PhraseList,
  TrailKind,
  TrailStep,
} from '@/types';
import { isoNow } from '../core';
import type { DbStore } from '../db';

const MAX_ACTIVITY = 400;

/** An agent at work: a short pause so replies arrive like a real model's (none in tests). */
export function think(min = 450, max = 1100): Promise<void> {
  if (env.isTest || env.mockLatencyMax <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, min + Math.random() * (max - min)));
}

export const say = (key: string, params?: Record<string, AgentTextParam>): AgentText =>
  params ? { key, params } : { key };

export const step = (kind: TrailKind, name: string, result: AgentText, ok = true): TrailStep => ({
  kind,
  name,
  result,
  ok,
});

export const orchestratorStep = (intent: string): TrailStep =>
  step('orchestrator', 'orchestrator', say('triage:trail.intent', { intent: say(`triage:intents.${intent}`) }));

export const phrases = (list: PhraseList): string[] => [...list.en, ...list.ta, ...list.tanglish];

export const isAgentActive = (db: DbStore, id: AgentId): boolean => db.getState().agentSettings[id] !== false;

export function logActivity(db: DbStore, entry: Omit<AgentActivity, 'id' | 'at'>): AgentActivity {
  const activity: AgentActivity = { ...entry, id: newId('act'), at: isoNow() };
  db.setState((state) => ({ agentActivity: [...state.agentActivity, activity].slice(-MAX_ACTIVITY) }));
  return activity;
}

/** Records the human decision on an output; a decision already made is only replaced by a later one. */
export function setDecision(db: DbStore, activityId: string | undefined, decision: HumanDecision): void {
  if (!activityId) return;
  db.setState((state) => ({
    agentActivity: state.agentActivity.map((a) => (a.id === activityId ? { ...a, decision } : a)),
  }));
}
