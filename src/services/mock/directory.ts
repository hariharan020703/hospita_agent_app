// Mock auth, hospital profile, departments, doctors, schedules and patients.
import { now } from '@/lib/clock';
import { newId } from '@/lib/id';
import { birthYearFromAge } from '@/lib/time';
import { nextAvailableSlot } from '@/features/appointments/availability';
import {
  departmentFormSchema,
  hospitalSchema,
  phoneSchema,
  weeklyHoursSchema,
  type Doctor,
  type DoctorFormValues,
  type Patient,
  type PatientFormValues,
  type Session,
  type User,
  type WeeklyHours,
} from '@/types';
import { ServiceError } from '../errors';
import type {
  AuthService,
  DepartmentService,
  DoctorListItem,
  DoctorService,
  HospitalService,
  PatientService,
  ScheduleService,
} from '../types';
import { availabilityContext } from './appointments';
import { isoNow, mustFind, replaceById, request } from './core';
import type { DbState } from './state';

/** Mock OTP accepted for every phone number. */
export const DEMO_OTP = '123456';

const sessionOf = (user: User): Session => ({
  userId: user.id,
  role: user.role,
  name: user.name,
  ...(user.doctorId ? { doctorId: user.doctorId } : {}),
  ...(user.patientId ? { patientId: user.patientId } : {}),
  ...(user.phone ? { phone: user.phone } : {}),
  signedInAt: isoNow(),
});

export const mockAuthService: AuthService = {
  listDemoAccounts: () => request((db) => db.getState().users.filter((u) => u.active)),

  signInAs: (userId) =>
    request((db) => {
      const user = mustFind(db.getState().users, userId);
      if (!user.active) throw new ServiceError('FORBIDDEN');
      return sessionOf(user);
    }),

  requestOtp: (phone) =>
    request(() => {
      if (!phoneSchema.safeParse(phone).success) throw new ServiceError('VALIDATION', 'Invalid phone');
      return { sentTo: phone };
    }),

  verifyOtp: (phone, code) =>
    request((db) => {
      if (code.trim() !== DEMO_OTP) throw new ServiceError('INVALID_OTP');
      const state = db.getState();
      const existing = state.users.find((u) => u.role === 'patient' && u.phone === phone);
      if (existing) {
        if (!existing.active) throw new ServiceError('FORBIDDEN');
        return sessionOf(existing);
      }
      const user: User = { id: newId('usr'), role: 'patient', name: '', phone, active: true };
      db.setState({ users: [...state.users, user] });
      return sessionOf(user);
    }),

  getUser: (userId) => request((db) => mustFind(db.getState().users, userId)),
};

export const mockHospitalService: HospitalService = {
  get: () => request((db) => db.getState().hospital),
  update: (hospital) =>
    request((db) => {
      const parsed = hospitalSchema.safeParse(hospital);
      if (!parsed.success) throw new ServiceError('VALIDATION');
      db.setState({ hospital: parsed.data });
      return parsed.data;
    }),
};

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'department';

export const mockDepartmentService: DepartmentService = {
  list: (options = {}) =>
    request((db) =>
      db
        .getState()
        .departments.filter((d) => options.includeInactive || d.active)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    ),

  get: (id) => request((db) => mustFind(db.getState().departments, id)),

  create: (values) =>
    request((db) => {
      const state = db.getState();
      const parsed = departmentFormSchema.parse(values);
      if (state.departments.some((d) => d.tokenPrefix === parsed.tokenPrefix))
        throw new ServiceError('CONFLICT', 'tokenPrefix');
      let id = slug(parsed.name.en);
      while (state.departments.some((d) => d.id === id)) id = `${id}-2`;
      const department = { ...parsed, id, sortOrder: Math.max(0, ...state.departments.map((d) => d.sortOrder)) + 1 };
      db.setState({ departments: [...state.departments, department] });
      return department;
    }),

  update: (id, values) =>
    request((db) => {
      const state = db.getState();
      const current = mustFind(state.departments, id);
      const parsed = departmentFormSchema.parse(values);
      if (state.departments.some((d) => d.id !== id && d.tokenPrefix === parsed.tokenPrefix))
        throw new ServiceError('CONFLICT', 'tokenPrefix');
      const next = { ...current, ...parsed };
      db.setState({ departments: replaceById(state.departments, next) });
      return next;
    }),
};

function doctorFromForm(values: DoctorFormValues, id: string): Doctor {
  const bioEn = values.bioEn.trim();
  const bioTa = values.bioTa.trim();
  return {
    id,
    name: values.name.trim(),
    ...(values.nameTa.trim() ? { nameTa: values.nameTa.trim() } : {}),
    gender: values.gender,
    ...(values.photoUrl ? { photoUrl: values.photoUrl } : {}),
    qualifications: values.qualifications
      .split(',')
      .map((q) => q.trim())
      .filter(Boolean),
    registrationNo: values.registrationNo.trim(),
    departmentId: values.departmentId,
    languages: values.languages,
    fee: values.fee,
    consultMins: values.consultMins,
    room: values.room.trim(),
    experienceYears: values.experienceYears,
    ...(bioEn || bioTa ? { bio: { en: bioEn || bioTa, ta: bioTa || bioEn } } : {}),
    active: values.active,
  };
}

const DEFAULT_WEEKLY: WeeklyHours = {
  mon: [{ start: '09:00', end: '13:00' }],
  tue: [{ start: '09:00', end: '13:00' }],
  wed: [{ start: '09:00', end: '13:00' }],
  thu: [{ start: '09:00', end: '13:00' }],
  fri: [{ start: '09:00', end: '13:00' }],
  sat: [{ start: '09:00', end: '13:00' }],
  sun: [],
};

function withNextAvailable(state: DbState, doctor: Doctor): DoctorListItem {
  const bookable = state.departments.find((d) => d.id === doctor.departmentId)?.bookable ?? false;
  const nextAvailable =
    doctor.active && bookable
      ? nextAvailableSlot(
          doctor,
          availabilityContext(state, doctor.id, state.hospital.booking.leadMins),
          state.hospital.booking.maxDaysAhead,
        )
      : null;
  return { ...doctor, nextAvailable };
}

export const mockDoctorService: DoctorService = {
  list: (filters = {}) =>
    request((db) => {
      const state = db.getState();
      const q = filters.q?.trim().toLowerCase();
      return state.doctors
        .filter((d) => {
          if (!filters.includeInactive && !d.active) return false;
          if (filters.departmentId && d.departmentId !== filters.departmentId) return false;
          if (filters.lang && !d.languages.includes(filters.lang)) return false;
          if (filters.gender && d.gender !== filters.gender) return false;
          if (filters.maxFee !== undefined && d.fee > filters.maxFee) return false;
          if (q && ![d.name, d.nameTa ?? '', d.registrationNo, d.room].some((f) => f.toLowerCase().includes(q)))
            return false;
          return true;
        })
        .map((d) => withNextAvailable(state, d));
    }),

  get: (id) =>
    request((db) => {
      const state = db.getState();
      return withNextAvailable(state, mustFind(state.doctors, id));
    }),

  create: (values) =>
    request((db) => {
      const state = db.getState();
      mustFind(state.departments, values.departmentId);
      if (state.doctors.some((d) => d.registrationNo.toLowerCase() === values.registrationNo.trim().toLowerCase())) {
        throw new ServiceError('CONFLICT', 'registrationNo');
      }
      const doctor = doctorFromForm(values, newId('doc'));
      db.setState({
        doctors: [...state.doctors, doctor],
        schedules: [...state.schedules, { doctorId: doctor.id, weekly: DEFAULT_WEEKLY }],
      });
      return doctor;
    }),

  update: (id, values) =>
    request((db) => {
      const state = db.getState();
      mustFind(state.doctors, id);
      mustFind(state.departments, values.departmentId);
      if (
        state.doctors.some(
          (d) => d.id !== id && d.registrationNo.toLowerCase() === values.registrationNo.trim().toLowerCase(),
        )
      ) {
        throw new ServiceError('CONFLICT', 'registrationNo');
      }
      const doctor = doctorFromForm(values, id);
      db.setState({ doctors: replaceById(state.doctors, doctor) });
      return doctor;
    }),

  setActive: (id, active) =>
    request((db) => {
      const state = db.getState();
      const doctor = { ...mustFind(state.doctors, id), active };
      db.setState({ doctors: replaceById(state.doctors, doctor) });
      return doctor;
    }),
};

export const mockScheduleService: ScheduleService = {
  get: (doctorId) =>
    request((db) => {
      const state = db.getState();
      mustFind(state.doctors, doctorId);
      return state.schedules.find((s) => s.doctorId === doctorId) ?? { doctorId, weekly: DEFAULT_WEEKLY };
    }),

  updateWeekly: (doctorId, weekly) =>
    request((db) => {
      const state = db.getState();
      mustFind(state.doctors, doctorId);
      const parsed = weeklyHoursSchema.safeParse(weekly);
      if (!parsed.success) throw new ServiceError('VALIDATION');
      const schedule = { doctorId, weekly: parsed.data };
      const exists = state.schedules.some((s) => s.doctorId === doctorId);
      db.setState({
        schedules: exists
          ? state.schedules.map((s) => (s.doctorId === doctorId ? schedule : s))
          : [...state.schedules, schedule],
      });
      return schedule;
    }),

  listLeaves: (filter = {}) =>
    request((db) =>
      db
        .getState()
        .leaves.filter(
          (l) => (!filter.doctorId || l.doctorId === filter.doctorId) && (!filter.status || l.status === filter.status),
        )
        .sort((a, b) => a.from.localeCompare(b.from)),
    ),

  requestLeave: (doctorId, values) =>
    request((db) => {
      const state = db.getState();
      mustFind(state.doctors, doctorId);
      const leave = {
        id: newId('lv'),
        doctorId,
        kind: values.kind,
        from: values.from,
        to: values.kind === 'block' ? values.from : values.to,
        ...(values.kind === 'block' ? { startTime: values.startTime, endTime: values.endTime } : {}),
        reason: values.reason.trim(),
        status: 'pending' as const,
        requestedAt: isoNow(),
      };
      db.setState({ leaves: [...state.leaves, leave] });
      return leave;
    }),

  decideLeave: (id, status, userId) =>
    request((db) => {
      const state = db.getState();
      const leave = { ...mustFind(state.leaves, id), status, decidedBy: userId, decidedAt: isoNow() };
      db.setState({ leaves: replaceById(state.leaves, leave) });
      return leave;
    }),
};

function patientFromForm(
  values: PatientFormValues,
  base: Pick<Patient, 'id' | 'householdId' | 'createdAt'> & Partial<Patient>,
): Patient {
  return {
    ...base,
    relation: values.relation,
    name: values.name.trim(),
    birthYear: birthYearFromAge(values.age, now()),
    gender: values.gender,
    phone: values.phone,
    address: values.address,
    ...(values.abhaNumber ? { abhaNumber: values.abhaNumber } : { abhaNumber: undefined }),
    preferredLang: values.preferredLang,
    conditions: values.conditions
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean),
  };
}

const consentRecord = (state: DbState, notifications: boolean) => ({
  version: state.hospital.consentVersion,
  acceptedAt: isoNow(),
  dataProcessing: true as const,
  notifications,
});

export const mockPatientService: PatientService = {
  get: (id) => request((db) => mustFind(db.getState().patients, id)),

  list: (filter = {}) =>
    request((db) => {
      const q = filter.q?.trim().toLowerCase();
      return db
        .getState()
        .patients.filter(
          (p) => !q || p.name.toLowerCase().includes(q) || p.phone.includes(q) || (p.abhaNumber ?? '').includes(q),
        )
        .sort((a, b) => a.name.localeCompare(b.name));
    }),

  household: (householdId) => request((db) => db.getState().patients.filter((p) => p.householdId === householdId)),

  search: (q) =>
    request((db) => {
      const query = q.trim().toLowerCase();
      if (query.length < 2) return [];
      return db
        .getState()
        .patients.filter((p) => p.name.toLowerCase().includes(query) || p.phone.includes(query))
        .slice(0, 20);
    }),

  findByPhone: (phone) => request((db) => db.getState().patients.filter((p) => p.phone === phone)),

  registerAccountHolder: (userId, input) =>
    request((db) => {
      const state = db.getState();
      const user = mustFind(state.users, userId);
      if (user.patientId) throw new ServiceError('CONFLICT', 'Already registered');
      const id = newId('pat');
      const patient = patientFromForm(
        { ...input.values, relation: 'self' },
        {
          id,
          householdId: newId('hh'),
          createdAt: isoNow(),
          ...(input.consent ? { consent: consentRecord(state, input.consent.notifications) } : {}),
        },
      );
      db.setState({
        patients: [...state.patients, patient],
        users: replaceById(state.users, { ...user, patientId: id, name: patient.name }),
      });
      return patient;
    }),

  addFamilyMember: (householdId, values) =>
    request((db) => {
      const state = db.getState();
      const holder = state.patients.find((p) => p.householdId === householdId && p.relation === 'self');
      if (!holder) throw new ServiceError('NOT_FOUND');
      const patient = patientFromForm(values, {
        id: newId('pat'),
        householdId,
        createdAt: isoNow(),
        ...(holder.consent ? { consent: holder.consent } : {}),
      });
      db.setState({ patients: [...state.patients, patient] });
      return patient;
    }),

  registerWalkIn: (input) =>
    request((db) => {
      const state = db.getState();
      const name = input.values.name.trim().toLowerCase();
      const existing = state.patients.find((p) => p.phone === input.values.phone && p.name.toLowerCase() === name);
      if (existing) return existing;
      const patient = patientFromForm(input.values, {
        id: newId('pat'),
        householdId: newId('hh'),
        createdAt: isoNow(),
        ...(input.consent ? { consent: consentRecord(state, input.consent.notifications) } : {}),
      });
      db.setState({ patients: [...state.patients, patient] });
      return patient;
    }),

  update: (id, values) =>
    request((db) => {
      const state = db.getState();
      const current = mustFind(state.patients, id);
      const patient = patientFromForm(values, current);
      const users = state.users.map((u) => (u.patientId === id ? { ...u, name: patient.name } : u));
      db.setState({ patients: replaceById(state.patients, patient), users });
      return patient;
    }),

  acceptConsent: (id, notifications) =>
    request((db) => {
      const state = db.getState();
      const patient = { ...mustFind(state.patients, id), consent: consentRecord(state, notifications) };
      db.setState({ patients: replaceById(state.patients, patient) });
      return patient;
    }),
};
