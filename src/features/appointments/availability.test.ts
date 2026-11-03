import { describe, expect, it } from 'vitest';
import type { Appointment, Leave, Schedule } from '@/types';
import { buildSlots, nextAvailableSlot, type AvailabilityContext } from './availability';

// 2026-10-29 is a Thursday.
const NOW = new Date(2026, 9, 29, 9, 30);
const doctor = { id: 'doc_x', consultMins: 15 };
const schedule: Schedule = {
  doctorId: 'doc_x',
  weekly: {
    mon: [{ start: '09:00', end: '10:00' }],
    tue: [],
    wed: [],
    thu: [{ start: '09:00', end: '10:00' }],
    fri: [{ start: '09:00', end: '10:00' }],
    sat: [],
    sun: [],
  },
};

const appointment = (start: string, status: Appointment['status'] = 'booked', date = '2026-10-30'): Appointment => ({
  id: `a_${start}_${status}`,
  bookingRef: 'MFAAAAAA',
  patientId: 'p',
  doctorId: 'doc_x',
  departmentId: 'general',
  date,
  start,
  end: `${start.slice(0, 3)}${String(Number(start.slice(3)) + 15).padStart(2, '0')}`,
  tokenNo: 1,
  status,
  source: 'app',
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
});

const ctx = (over: Partial<AvailabilityContext> = {}): AvailabilityContext => ({
  schedule,
  leaves: [],
  holidays: [],
  appointments: [],
  now: NOW,
  leadMins: 30,
  ...over,
});

describe('buildSlots', () => {
  it('splits the session into consultation-length slots', () => {
    expect(buildSlots(doctor, '2026-10-30', ctx()).map((s) => s.start)).toEqual(['09:00', '09:15', '09:30', '09:45']);
  });

  it('marks today’s slots before now + lead time as past', () => {
    const statuses = buildSlots(doctor, '2026-10-29', ctx()).map((s) => s.status);
    expect(statuses).toEqual(['past', 'past', 'past', 'past']);
    // 08:40 + 30 min lead time: 09:00 is too soon, 09:15 onwards can be booked.
    const later = buildSlots(doctor, '2026-10-29', ctx({ now: new Date(2026, 9, 29, 8, 40) })).map((s) => s.status);
    expect(later).toEqual(['past', 'available', 'available', 'available']);
  });

  it('marks active bookings as booked but frees cancelled ones', () => {
    const slots = buildSlots(
      doctor,
      '2026-10-30',
      ctx({ appointments: [appointment('09:15'), appointment('09:30', 'cancelled')] }),
    );
    expect(slots.find((s) => s.start === '09:15')?.status).toBe('booked');
    expect(slots.find((s) => s.start === '09:30')?.status).toBe('available');
  });

  it('respects approved leave and blocks, ignores pending ones, and closes on holidays', () => {
    const leaves: Leave[] = [
      {
        id: 'l1',
        doctorId: 'doc_x',
        kind: 'block',
        from: '2026-10-30',
        to: '2026-10-30',
        startTime: '09:30',
        endTime: '10:00',
        reason: 'Meeting',
        status: 'approved',
        requestedAt: NOW.toISOString(),
      },
      {
        id: 'l2',
        doctorId: 'doc_x',
        kind: 'leave',
        from: '2026-10-30',
        to: '2026-10-30',
        reason: 'Leave',
        status: 'pending',
        requestedAt: NOW.toISOString(),
      },
    ];
    expect(buildSlots(doctor, '2026-10-30', ctx({ leaves })).map((s) => s.status)).toEqual([
      'available',
      'available',
      'blocked',
      'blocked',
    ]);
    expect(
      buildSlots(
        doctor,
        '2026-10-30',
        ctx({ holidays: [{ date: '2026-10-30', name: { en: 'Holiday', ta: 'விடுமுறை' } }] }),
      ),
    ).toEqual([]);
  });

  it('finds the next available slot, skipping full and closed days', () => {
    const full = ['09:00', '09:15', '09:30', '09:45'].map((s) => appointment(s));
    expect(nextAvailableSlot(doctor, ctx({ appointments: full }), 7)).toEqual({ date: '2026-11-02', start: '09:00' });
  });
});
