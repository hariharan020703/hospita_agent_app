// Entry point for all data access. The implementation is chosen once from VITE_DATA_SOURCE; UI code never knows which.
import { env } from '@/config/env';
import { ApiClient } from './api/client';
import { createApiServices } from './api';
import { createMockServices } from './mock';
import { createMockAgentService } from './mock/agents';
import type { AgentService, Services } from './types';

export const apiClient = new ApiClient(env.apiBaseUrl);

export const services: Services = env.dataSource === 'api' ? createApiServices(apiClient) : createMockServices();

export const {
  auth: authService,
  hospital: hospitalService,
  departments: departmentService,
  doctors: doctorService,
  schedules: scheduleService,
  appointments: appointmentService,
  queue: queueService,
  patients: patientService,
  triage: triageService,
  escalations: escalationService,
  notifications: notificationService,
  analytics: analyticsService,
  system: systemService,
} = services;

/** The orchestrator and its agents: simulated in the browser for both data sources (there is no agent API). */
export const agentService: AgentService = createMockAgentService(services);

export * from './errors';
export * from './queryKeys';
export type * from './types';
