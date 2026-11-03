import { describe, expect, it } from 'vitest';
import type { Appointment, DoctorDay } from '@/types';
import { estimateQueue, type EstimateInput } from './estimate';

const DATE = '2026-10-29';
const at = (hhmm: string) => new Date(`${DATE}T${hhmm}:00`);

const appt = (
  id: string,
  start: string,
  status: Appointment['status'],
  extra: Partial<Appointment> = {},
): Appointment => ({
  id,
  bookingRef: 'MFAAAAAA',
  patientId: id,
  doctorId: 'd',
  departmentId: 'cardiology',
  date: DATE,
  start,
  end: start,
  tokenNo: Number(id.slice(1)),
  status,
  source: 'app',
  createdAt: at('08:00').toISOString(),
  updatedAt: at('08:00').toISOString(),
  ...extra,
});

const day = (over: Partial<DoctorDay> = {}): DoctorDay => ({
  doctorId: 'd',
  date: DATE,
  status: 'available',
  delayMins: 0,
  updatedAt: '',
  ...over,
});

function run(me: Appointment, others: Appointment[], over: Partial<EstimateInput> = {}) {
  return estimateQueue({
    appointment: me,
    sameDay: [me, ...others],
    consultMins: 15,
    day: day(),
    now: at('09:30'),
    travelMins: 30,
    bufferMins: 10,
    tokenOf: (a) => `CAR-${String(a.tokenNo).padStart(3, '0')}`,
    ...over,
  });
}

describe('estimateQueue', () => {
  const queue = [
    appt('a1', '09:00', 'completed'),
    appt('a2', '09:15', 'in_consultation', { calledAt: at('09:25').toISOString() }),
    appt('a3', '09:30', 'checked_in'),
    appt('a4', '09:45', 'booked'),
    appt('a5', '10:00', 'cancelled'),
  ];

  it('counts active patients ahead and works out when to leave home', () => {
    const result = run(appt('a6', '10:15', 'booked'), queue);
    expect(result.patientsAhead).toBe(2);
    expect(result.nowServing).toBe('CAR-002');
    // Queue: 09:30 + 10 min left + 2 x 15 = 10:10, but not before the 10:15 slot.
    expect(result.expectedStart).toBe('10:15');
    expect(result.leaveBy).toBe('09:35');
    expect(result.phase).toBe('get_ready');
  });

  it('adds the doctor’s delay', () => {
    const result = run(appt('a6', '10:15', 'booked'), queue, { day: day({ status: 'running_late', delayMins: 20 }) });
    expect(result.delayMins).toBe(20);
    expect(result.expectedStart).toBe('10:35');
    expect(result.leaveBy).toBe('09:55');
    expect(result.phase).toBe('relax');
  });

  it('pushes the estimate back while the doctor is on a break', () => {
    const result = run(appt('a6', '09:45', 'booked'), [appt('a3', '09:30', 'checked_in')], {
      day: day({ status: 'on_break', breakUntil: '10:00' }),
    });
    expect(result.expectedStart).toBe('10:15');
  });

  it('says leave now when the leave time has passed', () => {
    expect(run(appt('a6', '09:45', 'booked'), queue).phase).toBe('leave_now');
  });

  it('tracks checked-in patients: waiting, then next', () => {
    expect(run(appt('a4', '09:45', 'checked_in'), queue).phase).toBe('waiting');
    expect(run(appt('a3', '09:30', 'checked_in'), queue).phase).toBe('next');
    expect(run(appt('a3', '09:30', 'checked_in'), queue).leaveBy).toBeNull();
  });

  it('reports finished visits', () => {
    expect(run(appt('a2', '09:15', 'in_consultation'), []).phase).toBe('your_turn');
    expect(run(appt('a1', '09:00', 'completed'), []).phase).toBe('done');
    expect(run(appt('a5', '10:00', 'cancelled'), []).phase).toBe('closed');
  });
});
