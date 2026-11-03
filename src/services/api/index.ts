// REST implementation of the service contract (VITE_DATA_SOURCE=api). Endpoints follow /api/<resource> conventions;
// adjust paths here when the backend is ready. Responses are validated with the shared zod schemas.
import { z } from 'zod';
import {
  appointmentSchema,
  departmentSchema,
  doctorDaySchema,
  doctorSchema,
  escalationSchema,
  hospitalSchema,
  leaveSchema,
  notificationSchema,
  patientSchema,
  redFlagSchema,
  scheduleSchema,
  symptomRuleSchema,
  triageSessionSchema,
  userSchema,
  type AppointmentView,
  type DashboardData,
  type DoctorQueue,
  type QueueEstimate,
  type Session,
} from '@/types';
import type { Slot } from '@/features/appointments/availability';
import type { TriageRules } from '@/features/triage/engine';
import { ServiceError } from '../errors';
import type { DoctorListItem, Services } from '../types';
import type { ApiClient } from './client';

const appointmentViewSchema = appointmentSchema.extend({
  token: z.string(),
  patientName: z.string(),
  patientPhone: z.string(),
  doctorName: z.string(),
  doctorNameTa: z.string().optional(),
  room: z.string(),
}) as z.ZodType<AppointmentView>;

const doctorListItemSchema = doctorSchema.extend({
  nextAvailable: z.object({ date: z.string(), start: z.string() }).nullable(),
}) as z.ZodType<DoctorListItem>;

const sessionSchema = z.object({ token: z.string(), session: z.custom<Session>() });

export function createApiServices(api: ApiClient): Services {
  const signIn = async (path: string, body: unknown) => {
    const { token, session } = await api.post(path, { body, schema: sessionSchema });
    api.setToken(token);
    return session;
  };

  return {
    auth: {
      listDemoAccounts: () => api.get('/auth/demo-accounts', { schema: z.array(userSchema) }),
      signInAs: (userId) => signIn('/auth/demo-sign-in', { userId }),
      requestOtp: (phone) => api.post('/auth/otp', { body: { phone }, schema: z.object({ sentTo: z.string() }) }),
      verifyOtp: (phone, code) => signIn('/auth/otp/verify', { phone, code }),
      getUser: (userId) => api.get(`/users/${userId}`, { schema: userSchema }),
    },
    hospital: {
      get: () => api.get('/hospital', { schema: hospitalSchema }),
      update: (hospital) => api.put('/hospital', { body: hospital, schema: hospitalSchema }),
    },
    departments: {
      list: (options = {}) =>
        api.get('/departments', {
          query: { includeInactive: options.includeInactive },
          schema: z.array(departmentSchema),
        }),
      get: (id) => api.get(`/departments/${id}`, { schema: departmentSchema }),
      create: (values) => api.post('/departments', { body: values, schema: departmentSchema }),
      update: (id, values) => api.put(`/departments/${id}`, { body: values, schema: departmentSchema }),
    },
    doctors: {
      list: (filters = {}) => api.get('/doctors', { query: { ...filters }, schema: z.array(doctorListItemSchema) }),
      get: (id) => api.get(`/doctors/${id}`, { schema: doctorListItemSchema }),
      create: (values) => api.post('/doctors', { body: values, schema: doctorSchema }),
      update: (id, values) => api.put(`/doctors/${id}`, { body: values, schema: doctorSchema }),
      setActive: (id, active) => api.patch(`/doctors/${id}`, { body: { active }, schema: doctorSchema }),
    },
    schedules: {
      get: (doctorId) => api.get(`/doctors/${doctorId}/schedule`, { schema: scheduleSchema }),
      updateWeekly: (doctorId, weekly) =>
        api.put(`/doctors/${doctorId}/schedule`, { body: { weekly }, schema: scheduleSchema }),
      listLeaves: (filter = {}) => api.get('/leaves', { query: { ...filter }, schema: z.array(leaveSchema) }),
      requestLeave: (doctorId, values) =>
        api.post(`/doctors/${doctorId}/leaves`, { body: values, schema: leaveSchema }),
      decideLeave: (id, status) => api.patch(`/leaves/${id}`, { body: { status }, schema: leaveSchema }),
    },
    appointments: {
      list: (filters = {}) =>
        api.get('/appointments', { query: { ...filters }, schema: z.array(appointmentViewSchema) }),
      get: (id) => api.get(`/appointments/${id}`, { schema: appointmentViewSchema }),
      getByRef: (ref) => api.get(`/appointments/by-ref/${encodeURIComponent(ref)}`, { schema: appointmentViewSchema }),
      slots: (doctorId, date) => api.get<Slot[]>(`/doctors/${doctorId}/slots`, { query: { date } }),
      book: (input) => api.post('/appointments', { body: input, schema: appointmentViewSchema }),
      reschedule: (id, change, by) =>
        api.post(`/appointments/${id}/reschedule`, { body: { ...change, by }, schema: appointmentViewSchema }),
      cancel: (id, reason) => api.post(`/appointments/${id}/cancel`, { body: reason, schema: appointmentViewSchema }),
      checkIn: (id) => api.post(`/appointments/${id}/check-in`, { schema: appointmentViewSchema }),
      markNoShow: (id) => api.post(`/appointments/${id}/no-show`, { schema: appointmentViewSchema }),
      reassign: (id, doctorId) =>
        api.post(`/appointments/${id}/reassign`, { body: { doctorId }, schema: appointmentViewSchema }),
      issueWalkIn: (input) => api.post('/appointments/walk-in', { body: input, schema: appointmentViewSchema }),
      callNext: (doctorId) =>
        api.post(`/doctors/${doctorId}/queue/call-next`, { schema: appointmentViewSchema.nullable() }),
      complete: (id, note) =>
        api.post(`/appointments/${id}/complete`, { body: { note }, schema: appointmentViewSchema }),
      addNote: (id, note) => api.patch(`/appointments/${id}`, { body: { note }, schema: appointmentViewSchema }),
      scheduleFollowUp: (id, slot) =>
        api.post(`/appointments/${id}/follow-up`, { body: slot, schema: appointmentViewSchema }),
    },
    queue: {
      getDoctorDay: (doctorId) => api.get(`/doctors/${doctorId}/day`, { schema: doctorDaySchema }),
      setDoctorStatus: (doctorId, update) =>
        api.put(`/doctors/${doctorId}/day`, { body: update, schema: doctorDaySchema }),
      board: () => api.get<DoctorQueue[]>('/queue/board'),
      doctorQueue: (doctorId) => api.get<DoctorQueue>(`/doctors/${doctorId}/queue`),
      estimate: (appointmentId, travelMins) =>
        api.get<QueueEstimate>(`/appointments/${appointmentId}/estimate`, { query: { travelMins } }),
    },
    patients: {
      get: (id) => api.get(`/patients/${id}`, { schema: patientSchema }),
      list: (filter = {}) => api.get('/patients', { query: { ...filter }, schema: z.array(patientSchema) }),
      household: (householdId) => api.get(`/households/${householdId}/patients`, { schema: z.array(patientSchema) }),
      search: (q) => api.get('/patients/search', { query: { q }, schema: z.array(patientSchema) }),
      findByPhone: (phone) => api.get('/patients', { query: { phone }, schema: z.array(patientSchema) }),
      registerAccountHolder: (userId, input) =>
        api.post(`/users/${userId}/patient`, { body: input, schema: patientSchema }),
      addFamilyMember: (householdId, values) =>
        api.post(`/households/${householdId}/patients`, { body: values, schema: patientSchema }),
      registerWalkIn: (input) => api.post('/patients/walk-in', { body: input, schema: patientSchema }),
      update: (id, values) => api.put(`/patients/${id}`, { body: values, schema: patientSchema }),
      acceptConsent: (id, notifications) =>
        api.post(`/patients/${id}/consent`, { body: { notifications }, schema: patientSchema }),
    },
    triage: {
      rules: () => api.get<TriageRules>('/triage/rules'),
      save: (session) => api.post('/triage/sessions', { body: session, schema: triageSessionSchema }),
      get: (id) => api.get(`/triage/sessions/${id}`, { schema: triageSessionSchema }),
      listSymptomRules: (departmentId) =>
        api.get('/triage/symptom-rules', { query: { departmentId }, schema: z.array(symptomRuleSchema) }),
      saveSymptomRule: (rule) =>
        rule.id
          ? api.put(`/triage/symptom-rules/${rule.id}`, { body: rule, schema: symptomRuleSchema })
          : api.post('/triage/symptom-rules', { body: rule, schema: symptomRuleSchema }),
      deleteSymptomRule: (id) => api.delete(`/triage/symptom-rules/${id}`),
      listRedFlags: () => api.get('/triage/red-flags', { schema: z.array(redFlagSchema) }),
      saveRedFlag: (flag) =>
        flag.id
          ? api.put(`/triage/red-flags/${flag.id}`, { body: flag, schema: redFlagSchema })
          : api.post('/triage/red-flags', { body: flag, schema: redFlagSchema }),
      deleteRedFlag: (id) => api.delete(`/triage/red-flags/${id}`),
    },
    escalations: {
      list: (filter = {}) => api.get('/escalations', { query: { ...filter }, schema: z.array(escalationSchema) }),
      create: (input) => api.post('/escalations', { body: input, schema: escalationSchema }),
      resolve: (id, resolution) =>
        api.post(`/escalations/${id}/resolve`, { body: { resolution }, schema: escalationSchema }),
    },
    notifications: {
      list: (userId) => api.get(`/users/${userId}/notifications`, { schema: z.array(notificationSchema) }),
      markRead: (id) => api.post(`/notifications/${id}/read`),
      markAllRead: (userId) => api.post(`/users/${userId}/notifications/read-all`),
    },
    analytics: {
      dashboard: (range) => api.get<DashboardData>('/analytics/dashboard', { query: { ...range } }),
    },
    system: {
      resetData: () =>
        Promise.reject(new ServiceError('FORBIDDEN', 'Sample data reset is only available with mock data')),
      subscribe: () => () => undefined,
      start: () => () => undefined,
    },
  };
}
