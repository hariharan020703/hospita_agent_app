// The simulated agents. Everything runs in the browser from src/data; tools wrap the configured services.
import type { AgentService, Services } from '../../types';
import { createAgentAdmin } from './admin';
import { createOrchestrator } from './orchestrator';
import { createCareCompanion } from './care';
import { createRecordsAgent } from './records';
import { createScribe } from './scribe';

export function createMockAgentService(services: Services): AgentService {
  return {
    orchestrator: createOrchestrator(services),
    records: createRecordsAgent(),
    scribe: createScribe(services),
    care: createCareCompanion(services),
    admin: createAgentAdmin(),
  };
}
