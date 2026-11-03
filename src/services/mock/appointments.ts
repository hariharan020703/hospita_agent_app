// Mock appointment and queue services: booking rules, the visit lifecycle (check-in, call, complete) and live queues.
import { now } from '@/lib/clock';
import { addDaysIso, atTime, fromMinutes, minutesOfDay } from '@/lib/time';
import { buildSlots, type AvailabilityContext } from '@/features/appointments/availability';
import { estimateQueue, queueOrder } from '@/features/queue/estimate';
import { isActiveStatus, type Appointment, type Doctor, type DoctorDay, type DoctorQueue } from '@/types';
import { ServiceError } from '../errors';
import type { AppointmentService, QueueService } from '../types';
import {
  appUserPatientIds,
  isoNow,
  mustFind,
  newAppointment,
  notificationsFor,
  replaceById,
  request,
  today,
  tokenOf,
  toView,
} from './core';
import type { DbStore } from './db';
import type { DbState } from './state';

export function availabilityContext(
  state: DbState,
  doctorId: string,
  leadMins: number,
  excludeId?: string,
): AvailabilityContext {
  return {
    schedule: state.schedules.find((s) => s.doctorId === doctorId),
    leaves: state.leaves,
    holidays: state.hospital.holidays,
    appointments: state.appointments.filter((a) => a.doctorId === doctorId && a.id !== excludeId),
    now: now(),
    leadMins,
  };
}

function bookableDoctor(state: DbState, doctorId: string): Doctor {
  const doctor = mustFind(state.doctors, doctorId);
  const department = state.departments.find((d) => d.id === doctor.departmentId);
  if (!doctor.active || !department?.active || !department.bookable)
    throw new ServiceError('INVALID_STATE', 'Doctor is not bookable');
  return doctor;
}

function assertPatientFree(
  state: DbState,
  patientId: string,
  doctorId: string,
  date: string,
  start: string,
  end: string,
  excludeId?: string,
) {
  const clash = state.appointments.some(
    (a) =>
      a.id !== excludeId &&
      a.patientId === patientId &&
      a.date === date &&
      isActiveStatus(a.status) &&
      (a.doctorId === doctorId || (a.start < end && start < a.end)),
  );
  if (clash) throw new ServiceError('PATIENT_BUSY');
}

function freeSlot(state: DbState, doctor: Doctor, date: string, start: string, leadMins: number, excludeId?: string) {
  const slot = buildSlots(doctor, date, availabilityContext(state, doctor.id, leadMins, excludeId)).find(
    (s) => s.start === start,
  );
  if (!slot || slot.status !== 'available') throw new ServiceError('SLOT_TAKEN');
  return slot;
}

function save(db: DbStore, next: Appointment, extra: Partial<DbState> = {}) {
  const state = db.getState();
  db.setState({ appointments: replaceById(state.appointments, { ...next, updatedAt: isoNow() }), ...extra });
  return toView(db.getState(), mustFind(db.getState().appointments, next.id));
}

const markManual = (state: DbState, doctorId: string): Partial<DbState> =>
  state.manualDoctorIds.includes(doctorId) ? {} : { manualDoctorIds: [...state.manualDoctorIds, doctorId] };

export function doctorDayOf(state: DbState, doctorId: string, date: string): DoctorDay {
  return (
    state.doctorDays.find((d) => d.doctorId === doctorId && d.date === date) ?? {
      doctorId,
      date,
      status: 'available',
      delayMins: 0,
      updatedAt: isoNow(),
    }
  );
}

export function buildDoctorQueue(state: DbState, doctor: Doctor, date: string): DoctorQueue {
  const list = state.appointments
    .filter((a) => a.doctorId === doctor.id && a.date === date && a.status !== 'cancelled')
    .sort(queueOrder)
    .map((a) => toView(state, a));
  return {
    doctorId: doctor.id,
    doctorName: doctor.name,
    ...(doctor.nameTa ? { doctorNameTa: doctor.nameTa } : {}),
    departmentId: doctor.departmentId,
    room: doctor.room,
    day: doctorDayOf(state, doctor.id, date),
    current: list.find((a) => a.status === 'in_consultation') ?? null,
    waiting: list.filter((a) => a.status === 'checked_in'),
    expected: list.filter((a) => a.status === 'booked'),
    done: list.filter((a) => a.status === 'completed' || a.status === 'no_show'),
  };
}

export const mockAppointmentService: AppointmentService = {
  list: (filters = {}) =>
    request((db) => {
      const state = db.getState();
      const q = filters.q?.trim().toLowerCase();
      return state.appointments
        .filter((a) => {
          if (filters.patientIds && !filters.patientIds.includes(a.patientId)) return false;
          if (filters.doctorId && a.doctorId !== filters.doctorId) return false;
          if (filters.departmentId && a.departmentId !== filters.departmentId) return false;
          if (filters.date && a.date !== filters.date) return false;
          if (filters.from && a.date < filters.from) return false;
          if (filters.to && a.date > filters.to) return false;
          if (filters.statuses && !filters.statuses.includes(a.status)) return false;
          return true;
        })
        .map((a) => toView(state, a))
        .filter(
          (v) =>
            !q ||
            [v.patientName, v.patientPhone, v.token, v.bookingRef, v.doctorName].some((f) =>
              f.toLowerCase().includes(q),
            ),
        )
        .sort((a, b) => a.date.localeCompare(b.date) || queueOrder(a, b));
    }),

  get: (id) => request((db) => toView(db.getState(), mustFind(db.getState().appointments, id))),

  getByRef: (bookingRef) =>
    request((db) => {
      const state = db.getState();
      const ref = bookingRef.trim().toUpperCase();
      const found = state.appointments.find((a) => a.bookingRef === ref);
      if (!found) throw new ServiceError('NOT_FOUND');
      return toView(state, found);
    }),

  slots: (doctorId, date) =>
    request((db) => {
      const state = db.getState();
      const doctor = mustFind(state.doctors, doctorId);
      return buildSlots(doctor, date, availabilityContext(state, doctorId, state.hospital.booking.leadMins));
    }),

  book: (input) =>
    request((db) => {
      const state = db.getState();
      const doctor = bookableDoctor(state, input.doctorId);
      mustFind(state.patients, input.patientId);
      const maxDate = addDaysIso(today(), state.hospital.booking.maxDaysAhead);
      if (input.date < today() || input.date > maxDate) throw new ServiceError('VALIDATION', 'Date out of range');
      const lead = input.source === 'app' ? state.hospital.booking.leadMins : 0;
      const slot = freeSlot(state, doctor, input.date, input.start, lead);
      assertPatientFree(state, input.patientId, doctor.id, input.date, slot.start, slot.end);
      const appointment = newAppointment(state, {
        patientId: input.patientId,
        doctorId: doctor.id,
        departmentId: doctor.departmentId,
        date: input.date,
        start: slot.start,
        end: slot.end,
        source: input.source,
        status: 'booked',
        ...(input.triageId ? { triageId: input.triageId } : {}),
        ...(input.reason ? { reason: input.reason } : {}),
        ...(input.followUpOf ? { followUpOf: input.followUpOf } : {}),
      });
      db.setState({
        appointments: [...state.appointments, appointment],
        notifications: [
          ...state.notifications,
          ...notificationsFor(
            { ...state, appointments: [...state.appointments, appointment] },
            appointment,
            input.followUpOf ? 'follow_up' : 'booking_confirmed',
          ),
        ],
      });
      return toView(db.getState(), appointment);
    }),

  reschedule: (id, change, by) =>
    request((db) => {
      const state = db.getState();
      const current = mustFind(state.appointments, id);
      if (current.status !== 'booked') throw new ServiceError('INVALID_STATE');
      if (by === 'patient') {
        const cutoff = atTime(current.date, current.start).getTime() - state.hospital.booking.changeCutoffMins * 60_000;
        if (now().getTime() > cutoff) throw new ServiceError('TOO_LATE');
      }
      const doctor = bookableDoctor(state, current.doctorId);
      const lead = by === 'patient' ? state.hospital.booking.leadMins : 0;
      const slot = freeSlot(state, doctor, change.date, change.start, lead, id);
      assertPatientFree(state, current.patientId, doctor.id, change.date, slot.start, slot.end, id);
      const next: Appointment = {
        ...current,
        date: change.date,
        start: slot.start,
        end: slot.end,
        tokenNo:
          change.date === current.date
            ? current.tokenNo
            : newAppointment(state, { ...current, date: change.date }).tokenNo,
      };
      return save(db, next, {
        notifications: [...state.notifications, ...notificationsFor(state, next, 'booking_rescheduled')],
      });
    }),

  cancel: (id, reason) =>
    request((db) => {
      const state = db.getState();
      const current = mustFind(state.appointments, id);
      if (current.status !== 'booked' && current.status !== 'checked_in') throw new ServiceError('INVALID_STATE');
      const next: Appointment = { ...current, status: 'cancelled', cancel: reason };
      return save(db, next, {
        notifications: [...state.notifications, ...notificationsFor(state, next, 'booking_cancelled')],
      });
    }),

  checkIn: (id) =>
    request((db) => {
      const state = db.getState();
      const current = mustFind(state.appointments, id);
      if (current.status !== 'booked' || current.date !== today()) throw new ServiceError('INVALID_STATE');
      const next: Appointment = { ...current, status: 'checked_in', checkedInAt: isoNow() };
      return save(db, next, {
        notifications: [...state.notifications, ...notificationsFor(state, next, 'checked_in')],
      });
    }),

  markNoShow: (id) =>
    request((db) => {
      const current = mustFind(db.getState().appointments, id);
      if (current.status !== 'booked' && current.status !== 'checked_in') throw new ServiceError('INVALID_STATE');
      return save(db, { ...current, status: 'no_show' });
    }),

  reassign: (id, doctorId) =>
    request((db) => {
      const state = db.getState();
      const current = mustFind(state.appointments, id);
      if (current.status !== 'booked' && current.status !== 'checked_in') throw new ServiceError('INVALID_STATE');
      const doctor = bookableDoctor(state, doctorId);
      const slot = buildSlots(doctor, current.date, availabilityContext(state, doctorId, 0)).find(
        (s) => s.status === 'available',
      );
      if (!slot) throw new ServiceError('NO_SLOTS');
      const tokenNo =
        doctor.departmentId === current.departmentId
          ? current.tokenNo
          : newAppointment(state, { ...current, departmentId: doctor.departmentId }).tokenNo;
      const next: Appointment = {
        ...current,
        doctorId,
        departmentId: doctor.departmentId,
        start: slot.start,
        end: slot.end,
        tokenNo,
      };
      return save(db, next, {
        notifications: [...state.notifications, ...notificationsFor(state, next, 'booking_rescheduled')],
      });
    }),

  issueWalkIn: (input) =>
    request((db) => {
      const state = db.getState();
      mustFind(state.patients, input.patientId);
      const date = today();
      const candidates = (input.doctorId ? [bookableDoctor(state, input.doctorId)] : state.doctors).filter(
        (d) => d.active && d.departmentId === input.departmentId,
      );
      const options = candidates
        .map((doctor) => ({
          doctor,
          slot: buildSlots(doctor, date, availabilityContext(state, doctor.id, 0)).find(
            (s) => s.status === 'available',
          ),
        }))
        .filter((o): o is { doctor: Doctor; slot: NonNullable<typeof o.slot> } => Boolean(o.slot))
        .sort((a, b) => a.slot.start.localeCompare(b.slot.start));
      const best = options[0];
      if (!best) throw new ServiceError('NO_SLOTS');
      assertPatientFree(state, input.patientId, best.doctor.id, date, best.slot.start, best.slot.end);
      const appointment = newAppointment(state, {
        patientId: input.patientId,
        doctorId: best.doctor.id,
        departmentId: best.doctor.departmentId,
        date,
        start: best.slot.start,
        end: best.slot.end,
        source: input.source,
        status: 'checked_in',
        checkedInAt: isoNow(),
        ...(input.triageId ? { triageId: input.triageId } : {}),
        ...(input.reason ? { reason: input.reason } : {}),
      });
      db.setState({ appointments: [...state.appointments, appointment] });
      return toView(db.getState(), appointment);
    }),

  callNext: (doctorId) =>
    request((db) => {
      const state = db.getState();
      const doctor = mustFind(state.doctors, doctorId);
      const queue = state.appointments.filter((a) => a.doctorId === doctorId && a.date === today()).sort(queueOrder);
      if (queue.some((a) => a.status === 'in_consultation'))
        throw new ServiceError('INVALID_STATE', 'Finish the current consultation first');
      const next = queue.find((a) => a.status === 'checked_in');
      if (!next) {
        db.setState(markManual(state, doctorId));
        return null;
      }
      const called: Appointment = { ...next, status: 'in_consultation', calledAt: isoNow() };
      const following = queue.find((a) => a.status === 'checked_in' && a.id !== next.id);
      return save(db, called, {
        ...markManual(state, doctorId),
        notifications: [
          ...state.notifications,
          ...notificationsFor(state, called, 'called_in', { room: doctor.room }),
          ...(following ? notificationsFor(state, following, 'you_are_next') : []),
        ],
      });
    }),

  complete: (id, note) =>
    request((db) => {
      const state = db.getState();
      const current = mustFind(state.appointments, id);
      if (current.status !== 'in_consultation') throw new ServiceError('INVALID_STATE');
      const next: Appointment = {
        ...current,
        status: 'completed',
        completedAt: isoNow(),
        ...(note?.trim() ? { note: note.trim() } : {}),
      };
      return save(db, next, {
        ...markManual(state, current.doctorId),
        notifications: [...state.notifications, ...notificationsFor(state, next, 'consultation_done')],
      });
    }),

  addNote: (id, note) => request((db) => save(db, { ...mustFind(db.getState().appointments, id), note: note.trim() })),

  scheduleFollowUp: async (id, slot) => {
    const original = await mockAppointmentService.get(id);
    return mockAppointmentService.book({
      patientId: original.patientId,
      doctorId: original.doctorId,
      date: slot.date,
      start: slot.start,
      source: 'desk',
      followUpOf: id,
      ...(original.reason ? { reason: original.reason } : {}),
    });
  },
};

export const mockQueueService: QueueService = {
  getDoctorDay: (doctorId) => request((db) => doctorDayOf(db.getState(), doctorId, today())),

  setDoctorStatus: (doctorId, update) =>
    request((db) => {
      const state = db.getState();
      mustFind(state.doctors, doctorId);
      const date = today();
      const previous = doctorDayOf(state, doctorId, date);
      const next: DoctorDay = {
        doctorId,
        date,
        status: update.status,
        delayMins:
          update.status === 'running_late' ? Math.max(0, Math.round(update.delayMins ?? previous.delayMins)) : 0,
        ...(update.status === 'on_break'
          ? { breakUntil: fromMinutes(minutesOfDay(now()) + (update.breakMins ?? 15)) }
          : {}),
        updatedAt: isoNow(),
      };
      const exists = state.doctorDays.some((d) => d.doctorId === doctorId && d.date === date);
      const doctorDays = exists
        ? state.doctorDays.map((d) => (d.doctorId === doctorId && d.date === date ? next : d))
        : [...state.doctorDays, next];
      const appUsers = appUserPatientIds(state);
      const delayChanged =
        next.status === 'running_late' && next.delayMins > 0 && next.delayMins !== previous.delayMins;
      const affected = delayChanged
        ? state.appointments.filter(
            (a) =>
              a.doctorId === doctorId &&
              a.date === date &&
              appUsers.has(a.patientId) &&
              (a.status === 'booked' || a.status === 'checked_in'),
          )
        : [];
      db.setState({
        doctorDays,
        ...markManual(state, doctorId),
        notifications: [
          ...state.notifications,
          ...affected.flatMap((a) => notificationsFor(state, a, 'running_late', { delay: next.delayMins })),
        ],
      });
      return next;
    }),

  board: () =>
    request((db) => {
      const state = db.getState();
      const date = today();
      const bookableDepartments = new Set(state.departments.filter((d) => d.bookable && d.active).map((d) => d.id));
      return state.doctors
        .filter((d) => d.active && bookableDepartments.has(d.departmentId))
        .map((d) => buildDoctorQueue(state, d, date))
        .filter((q) => q.current || q.waiting.length || q.expected.length || q.done.length);
    }),

  doctorQueue: (doctorId) =>
    request((db) => {
      const state = db.getState();
      return buildDoctorQueue(state, mustFind(state.doctors, doctorId), today());
    }),

  estimate: (appointmentId, travelMins) =>
    request((db) => {
      const state = db.getState();
      const appointment = mustFind(state.appointments, appointmentId);
      const doctor = mustFind(state.doctors, appointment.doctorId);
      return estimateQueue({
        appointment,
        sameDay: state.appointments.filter((a) => a.doctorId === doctor.id && a.date === appointment.date),
        consultMins: doctor.consultMins,
        day: state.doctorDays.find((d) => d.doctorId === doctor.id && d.date === appointment.date),
        now: now(),
        travelMins: travelMins ?? state.hospital.travel.defaultMins,
        bufferMins: state.hospital.travel.bufferMins,
        tokenOf: (a) => tokenOf(state, a),
      });
    }),
};
