// Integration tests for the mock data source: real seed data, real business rules, zero latency, clock pinned at
// 2026-10-29 09:30 (see vite.config.ts test.env).
import { beforeEach, describe, expect, it } from 'vitest';
import { now } from '@/lib/clock';
import { addDaysIso, toIsoDate } from '@/lib/time';
import type { DoctorFormValues, PatientFormValues } from '@/types';
import { ServiceError } from '../errors';
import { createMockServices } from './index';
import { getDb, resetDbForTests } from './db';
import { createSeedState } from './seed';
import { advanceQueues } from './simulator';

const services = createMockServices();
const today = toIsoDate(now());
const tomorrow = addDaysIso(today, 1);

const expectCode = async (promise: Promise<unknown>, code: ServiceError['code']) => {
  await expect(promise).rejects.toBeInstanceOf(ServiceError);
  await expect(promise).rejects.toMatchObject({ code });
};

beforeEach(() => {
  resetDbForTests();
});

describe('seed data', () => {
  it('validates every JSON file and resolves dates around today', () => {
    const state = createSeedState(now());
    expect(state.seededFor).toBe(today);
    expect(state.doctors.length).toBeGreaterThanOrEqual(15);
    expect(state.appointments.some((a) => a.date === today)).toBe(true);
    const kamala = state.appointments.find((a) => a.id === 'apt_kamala_today');
    expect(kamala).toMatchObject({ date: today, start: '11:00', status: 'booked', doctorId: 'doc_01' });
  });
});

describe('booking', () => {
  it('books a free slot, then refuses the same slot and a second booking with the same doctor', async () => {
    const slots = await services.appointments.slots('doc_03', tomorrow);
    const free = slots.find((s) => s.status === 'available');
    expect(free).toBeDefined();
    const booked = await services.appointments.book({
      patientId: 'pat_002',
      doctorId: 'doc_03',
      date: tomorrow,
      start: free!.start,
      source: 'app',
    });
    expect(booked).toMatchObject({
      status: 'booked',
      patientName: 'Ramasamy Palanisamy',
      token: expect.stringMatching(/^GEN-\d{3}$/),
    });

    await expectCode(
      services.appointments.book({
        patientId: 'pat_004',
        doctorId: 'doc_03',
        date: tomorrow,
        start: free!.start,
        source: 'app',
      }),
      'SLOT_TAKEN',
    );
    const another = (await services.appointments.slots('doc_03', tomorrow)).find((s) => s.status === 'available')!;
    await expectCode(
      services.appointments.book({
        patientId: 'pat_002',
        doctorId: 'doc_03',
        date: tomorrow,
        start: another.start,
        source: 'app',
      }),
      'PATIENT_BUSY',
    );

    const after = await services.appointments.slots('doc_03', tomorrow);
    expect(after.find((s) => s.start === free!.start)?.status).toBe('booked');
  });

  it('notifies the household account when a family member is booked', async () => {
    const free = (await services.appointments.slots('doc_15', tomorrow)).find((s) => s.status === 'available')!;
    await services.appointments.book({
      patientId: 'pat_003',
      doctorId: 'doc_15',
      date: tomorrow,
      start: free.start,
      source: 'app',
    });
    const notes = await services.notifications.list('usr_pat01');
    expect(notes[0]).toMatchObject({ kind: 'booking_confirmed', params: { patient: 'Chinnammal Palanisamy' } });
  });

  it('cancels and frees the slot; reschedules to another time', async () => {
    const [first, second] = (await services.appointments.slots('doc_12', tomorrow)).filter(
      (s) => s.status === 'available',
    );
    const booked = await services.appointments.book({
      patientId: 'pat_004',
      doctorId: 'doc_12',
      date: tomorrow,
      start: first!.start,
      source: 'app',
    });
    const moved = await services.appointments.reschedule(
      booked.id,
      { date: tomorrow, start: second!.start },
      'patient',
    );
    expect(moved.start).toBe(second!.start);
    const cancelled = await services.appointments.cancel(booked.id, { code: 'schedule_conflict', by: 'patient' });
    expect(cancelled.status).toBe('cancelled');
    const slots = await services.appointments.slots('doc_12', tomorrow);
    expect(slots.find((s) => s.start === second!.start)?.status).toBe('available');
  });

  it('refuses patient changes inside the cut-off', async () => {
    const soon = (await services.appointments.list({ date: today, statuses: ['booked'] })).find(
      (a) => a.start <= '10:00',
    );
    expect(soon).toBeDefined();
    await expectCode(
      services.appointments.reschedule(soon!.id, { date: tomorrow, start: '09:00' }, 'patient'),
      'TOO_LATE',
    );
  });
});

describe('visit lifecycle and queue', () => {
  it('checks in, calls and completes a patient', async () => {
    const queue = await services.queue.doctorQueue('doc_08');
    if (queue.current) await services.appointments.complete(queue.current.id);
    const booked = (await services.queue.doctorQueue('doc_08')).expected[0]!;
    await services.appointments.checkIn(booked.id);
    let next = await services.appointments.callNext('doc_08');
    while (next && next.id !== booked.id) {
      await services.appointments.complete(next.id, 'Seen');
      next = await services.appointments.callNext('doc_08');
    }
    expect(next?.status).toBe('in_consultation');
    const done = await services.appointments.complete(booked.id, 'Advised rest. Review in one week.');
    expect(done).toMatchObject({ status: 'completed', note: 'Advised rest. Review in one week.' });
  });

  it('reflects a running-late doctor in the patient’s estimate and notifies them', async () => {
    const before = await services.queue.estimate('apt_kamala_today');
    expect(before.patientsAhead).toBeGreaterThan(0);
    expect(before.leaveBy).not.toBeNull();
    await services.queue.setDoctorStatus('doc_01', { status: 'running_late', delayMins: 45 });
    const after = await services.queue.estimate('apt_kamala_today');
    expect(after.delayMins).toBe(45);
    expect(after.expectedStart >= '11:45').toBe(true);
    const notes = await services.notifications.list('usr_pat01');
    expect(notes[0]).toMatchObject({ kind: 'running_late', params: { delay: 45 } });
  });

  it('issues a walk-in token for the earliest doctor in the department', async () => {
    const patient = await services.patients.registerWalkIn({ values: walkIn });
    const visit = await services.appointments.issueWalkIn({
      patientId: patient.id,
      departmentId: 'orthopaedics',
      source: 'kiosk',
    });
    expect(visit).toMatchObject({ status: 'checked_in', departmentId: 'orthopaedics', source: 'kiosk' });
    expect(visit.token).toMatch(/^ORT-\d{3}$/);
  });

  it('simulates the morning moving on', async () => {
    const db = await getDb();
    const later = new Date(now().getTime() + 60 * 60_000);
    const patch = advanceQueues(db.getState(), later);
    expect(patch?.appointments).toBeDefined();
    const kamala = patch!.appointments!.find((a) => a.id === 'apt_kamala_today');
    expect(kamala?.status).toBe('booked');
  });
});

const walkIn: PatientFormValues = {
  name: 'Ramulu Krishnan',
  age: 67,
  gender: 'male',
  phone: '9443098765',
  address: { line1: '4, Kamarajar Street', area: 'Ukkadam', city: 'Coimbatore', pincode: '641001' },
  abhaNumber: undefined,
  preferredLang: 'ta',
  relation: 'self',
  conditions: '',
};

describe('admin changes reach patient booking', () => {
  it('a new doctor is listed with free slots and can be booked', async () => {
    const values: DoctorFormValues = {
      name: 'Harini Sekar',
      nameTa: 'ஹரிணி சேகர்',
      gender: 'female',
      qualifications: 'MBBS, MD (Dermatology)',
      registrationNo: 'TNMC 99001',
      departmentId: 'dermatology',
      languages: ['ta', 'en'],
      fee: 450,
      consultMins: 15,
      room: 'A-212',
      experienceYears: 6,
      bioEn: '',
      bioTa: '',
      active: true,
    };
    const doctor = await services.doctors.create(values);
    const listed = await services.doctors.list({ departmentId: 'dermatology', lang: 'ta' });
    const item = listed.find((d) => d.id === doctor.id);
    expect(item?.nextAvailable).not.toBeNull();
    const booked = await services.appointments.book({
      patientId: 'pat_001',
      doctorId: doctor.id,
      date: item!.nextAvailable!.date,
      start: item!.nextAvailable!.start,
      source: 'app',
    });
    expect(booked.doctorName).toBe('Harini Sekar');
    await expectCode(services.doctors.create(values), 'CONFLICT');
  });

  it('a deactivated doctor can no longer be booked', async () => {
    await services.doctors.setActive('doc_15', false);
    expect((await services.doctors.list()).some((d) => d.id === 'doc_15')).toBe(false);
    await expectCode(
      services.appointments.book({
        patientId: 'pat_002',
        doctorId: 'doc_15',
        date: tomorrow,
        start: '09:00',
        source: 'app',
      }),
      'INVALID_STATE',
    );
  });
});

describe('patient sign-up', () => {
  it('rejects a wrong OTP and creates an account for a new number', async () => {
    await expectCode(services.auth.verifyOtp('9000011111', '000000'), 'INVALID_OTP');
    const session = await services.auth.verifyOtp('9000011111', '123456');
    expect(session).toMatchObject({ role: 'patient', phone: '9000011111' });
    expect(session.patientId).toBeUndefined();
    const patient = await services.patients.registerAccountHolder(session.userId, {
      values: { ...walkIn, phone: '9000011111', name: 'Anbu Selvan' },
      consent: { notifications: true },
    });
    expect(patient.consent?.dataProcessing).toBe(true);
    const user = await services.auth.getUser(session.userId);
    expect(user.patientId).toBe(patient.id);
  });

  it('signs in an existing patient by phone', async () => {
    const session = await services.auth.verifyOtp('9876543210', '123456');
    expect(session).toMatchObject({ userId: 'usr_pat01', patientId: 'pat_001' });
  });
});

describe('analytics', () => {
  it('returns a 7-day dashboard with a comparison period', async () => {
    const data = await services.analytics.dashboard({ from: addDaysIso(today, -6), to: today });
    expect(data.waitTrend).toHaveLength(7);
    expect(data.kpis.opdVolume.value).toBeGreaterThan(0);
    expect(data.kpis.opdVolume.previous).not.toBeNull();
    expect(data.langSplit.map((l) => l.lang)).toEqual(['ta', 'en']);
  });
});
