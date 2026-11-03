// The mock data source: every service backed by the in-browser database, plus the background queue simulation.
import { now } from '@/lib/clock';
import type { Services, SystemService } from '../types';
import { mockAppointmentService, mockQueueService } from './appointments';
import { mockAnalyticsService, mockEscalationService, mockNotificationService, mockTriageService } from './clinical';
import { getDb, onDbChange, resetDb } from './db';
import {
  mockAuthService,
  mockDepartmentService,
  mockDoctorService,
  mockHospitalService,
  mockPatientService,
  mockScheduleService,
} from './directory';
import { advanceQueues } from './simulator';

const SIMULATION_INTERVAL_MS = 5000;

async function tick() {
  const db = await getDb();
  const patch = advanceQueues(db.getState(), now());
  if (patch) db.setState(patch);
}

/** Runs the queue simulation in exactly one tab (Web Locks); other tabs receive its changes via storage events. */
function startSimulation(): () => void {
  let timer: number | undefined;
  let release: (() => void) | undefined;
  const run = () => {
    void tick();
    timer = window.setInterval(() => void tick(), SIMULATION_INTERVAL_MS);
  };
  if (typeof navigator !== 'undefined' && 'locks' in navigator) {
    const controller = new AbortController();
    navigator.locks
      .request('mediflow-simulation', { signal: controller.signal }, () => {
        run();
        return new Promise<void>((resolve) => (release = resolve));
      })
      .catch(() => undefined);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      release?.();
    };
  }
  run();
  return () => window.clearInterval(timer);
}

const mockSystemService: SystemService = {
  resetData: () => resetDb(),
  subscribe: (listener) => onDbChange(listener),
  start: () => startSimulation(),
};

export function createMockServices(): Services {
  return {
    auth: mockAuthService,
    hospital: mockHospitalService,
    departments: mockDepartmentService,
    doctors: mockDoctorService,
    schedules: mockScheduleService,
    appointments: mockAppointmentService,
    queue: mockQueueService,
    patients: mockPatientService,
    triage: mockTriageService,
    escalations: mockEscalationService,
    notifications: mockNotificationService,
    analytics: mockAnalyticsService,
    system: mockSystemService,
  };
}
