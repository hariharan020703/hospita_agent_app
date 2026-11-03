// Tools the orchestrator can call. Each wraps an existing service (no new business logic) and reports a short
// result for the visible trail: "Orchestrator -> Triage agent -> searchDoctors -> bookAppointment".
import { newId } from '@/lib/id';
import {
  ACTIVE_STATUSES,
  type AppNotification,
  type AppointmentView,
  type BookingInput,
  type DoctorOption,
  type Lang,
  type Localized,
  type NotificationKind,
  type Patient,
  type QueueEstimate,
  type TrailStep,
} from '@/types';
import type { DoctorListItem, Services } from '../../types';
import { accountUserIds, isoNow, today } from '../core';
import { getDb } from '../db';
import { say, step } from './shared';

export const toDoctorOption = (d: DoctorListItem, slot: { date: string; start: string }): DoctorOption => ({
  doctorId: d.id,
  name: d.name,
  ...(d.nameTa ? { nameTa: d.nameTa } : {}),
  departmentId: d.departmentId,
  date: slot.date,
  start: slot.start,
  fee: d.fee,
  languages: d.languages,
  room: d.room,
});

const tool = (name: string, key: string, params?: Parameters<typeof say>[1], ok = true): TrailStep =>
  step('tool', name, say(`triage:trail.${key}`, params), ok);

export function createTools(services: Services) {
  return {
    /** Active doctors in a department with their next free time, earliest first; the patient's language breaks ties. */
    async searchDoctors(departmentId: string, department: Localized, lang: Lang) {
      const list = await services.doctors.list({ departmentId });
      const options = list
        .filter((d): d is DoctorListItem & { nextAvailable: { date: string; start: string } } =>
          Boolean(d.active && d.nextAvailable),
        )
        .sort(
          (a, b) =>
            `${a.nextAvailable.date}${a.nextAvailable.start}`.localeCompare(
              `${b.nextAvailable.date}${b.nextAvailable.start}`,
            ) || Number(b.languages.includes(lang)) - Number(a.languages.includes(lang)),
        )
        .slice(0, 3)
        .map((d) => toDoctorOption(d, d.nextAvailable));
      return { options, step: tool('searchDoctors', 'searchDoctors', { count: options.length, department }) };
    },

    /** Free start times for one doctor on one day. */
    async getSlots(doctorId: string, date: string, except?: string) {
      const slots = await services.appointments.slots(doctorId, date);
      const starts = slots.filter((s) => s.status === 'available' && s.start !== except).map((s) => s.start);
      return { starts, step: tool('getSlots', 'getSlots', { count: starts.length, date }) };
    },

    async bookAppointment(input: BookingInput) {
      const appointment = await services.appointments.book(input);
      return {
        appointment,
        step: tool('bookAppointment', 'bookAppointment', { token: appointment.token, time: appointment.start }),
      };
    },

    async rescheduleAppointment(id: string, date: string, start: string) {
      const appointment = await services.appointments.reschedule(id, { date, start }, 'patient');
      return { appointment, step: tool('rescheduleAppointment', 'rescheduleAppointment', { date, time: start }) };
    },

    async cancelAppointment(id: string) {
      const appointment = await services.appointments.cancel(id, {
        code: 'other',
        note: 'Cancelled through the MediFlow assistant',
        by: 'patient',
      });
      return { appointment, step: tool('cancelAppointment', 'cancelAppointment', { token: appointment.token }) };
    },

    /** The patient, their household and their active appointments from today on. */
    async getPatientProfile(patientId: string) {
      const patient: Patient = await services.patients.get(patientId);
      const household = await services.patients.household(patient.householdId);
      const householdIds = household.map((p) => p.id);
      const upcoming = await services.appointments.list({
        patientIds: householdIds,
        from: today(),
        statuses: [...ACTIVE_STATUSES],
      });
      upcoming.sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
      return { patient, householdIds, upcoming, step: tool('getPatientProfile', 'getPatientProfile') };
    },

    async getQueueStatus(appointment: AppointmentView): Promise<{ estimate: QueueEstimate; step: TrailStep }> {
      const estimate = await services.queue.estimate(appointment.id);
      return {
        estimate,
        step: tool('getQueueStatus', 'getQueueStatus', {
          count: estimate.patientsAhead,
          time: estimate.expectedStart,
        }),
      };
    },

    /** In-app notification to the patient's account holders (there is no SMS, WhatsApp or e-mail). */
    async sendNotification(
      patientId: string,
      kind: NotificationKind,
      params: AppNotification['params'],
      appointmentId?: string,
    ) {
      const db = await getDb();
      const state = db.getState();
      const createdAt = isoNow();
      const notifications: AppNotification[] = accountUserIds(state, patientId).map((userId) => ({
        id: newId('ntf'),
        userId,
        kind,
        params,
        read: false,
        createdAt,
        ...(appointmentId ? { appointmentId } : {}),
      }));
      db.setState({ notifications: [...state.notifications, ...notifications] });
      return { sent: notifications.length, step: tool('sendNotification', 'sendNotification') };
    },
  };
}

export type AgentTools = ReturnType<typeof createTools>;
