// Admin -> Agents: switch agents on and off, today's numbers (earlier shifts from src/data/agents/agents.json plus
// the activity log), confidence spread and how often people changed what an agent produced.
import { toIsoDate } from '@/lib/time';
import type { AgentActivity, AgentDefinition, AgentOverview } from '@/types';
import type { AgentAdminApi } from '../../types';
import { request, today } from '../core';
import { agentData } from './data';
import { logActivity, say, setDecision, step } from './shared';

const REVIEWED = new Set(['accepted', 'edited', 'dismissed']);
const BUCKET_FLOORS = [40, 50, 60, 70, 80, 90];

function overviewOf(definition: AgentDefinition, active: boolean, todays: AgentActivity[]): AgentOverview {
  const own = todays.filter((a) => a.agentId === definition.id);
  // The orchestrator handles every conversation, so its numbers count all of them.
  const pool = definition.id === 'orchestrator' ? todays : own;
  const reviewed = own.filter((a) => REVIEWED.has(a.decision));
  const confidences = own.map((a) => a.confidence).filter((c): c is number => c !== undefined);
  return {
    definition,
    active,
    metrics: Object.entries(definition.metrics).map(([id, intents]) => ({
      id,
      value: (definition.baseline[id] ?? 0) + pool.filter((a) => intents.includes(a.intent)).length,
    })),
    overrideRate: reviewed.length
      ? Math.round((100 * reviewed.filter((a) => a.decision !== 'accepted').length) / reviewed.length)
      : null,
    averageConfidence: confidences.length
      ? Math.round(confidences.reduce((sum, c) => sum + c, 0) / confidences.length)
      : null,
    confidenceBuckets: BUCKET_FLOORS.map(
      (floor, i) => confidences.filter((c) => c >= floor && (i === BUCKET_FLOORS.length - 1 || c < floor + 10)).length,
    ),
    lastActivityAt: own.at(-1)?.at ?? null,
  };
}

export function createAgentAdmin(): AgentAdminApi {
  return {
    settings: () => request((db) => db.getState().agentSettings),

    async overview() {
      const { definitions } = await agentData();
      return request((db) => {
        const state = db.getState();
        const day = today();
        const todays = state.agentActivity.filter((a) => toIsoDate(new Date(a.at)) === day);
        return definitions.map((d) => overviewOf(d, state.agentSettings[d.id] !== false, todays));
      });
    },

    setActive: (id, active) =>
      request((db) => {
        const state = db.getState();
        db.setState({ agentSettings: { ...state.agentSettings, [id]: active } });
        logActivity(db, {
          agentId: id,
          actor: 'system',
          intent: active ? 'agent_resumed' : 'agent_paused',
          steps: [step('orchestrator', 'orchestrator', say(active ? 'triage:trail.resumed' : 'triage:trail.paused'))],
          summary: say(active ? 'admin:agents.summary.agent_resumed' : 'admin:agents.summary.agent_paused'),
          decision: 'none',
        });
        return db.getState().agentSettings;
      }),

    activity: (filter = {}) =>
      request((db) =>
        db
          .getState()
          .agentActivity.filter((a) => !filter.agentId || a.agentId === filter.agentId)
          .slice(-(filter.limit ?? 50))
          .reverse(),
      ),

    decide: (activityId, decision) => request((db) => setDecision(db, activityId, decision)),
  };
}
