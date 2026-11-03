import { z } from 'zod';
import { idSchema, phoneSchema } from './common';

export const ROLES = ['patient', 'desk', 'doctor', 'admin'] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export const userSchema = z
  .object({
    id: idSchema,
    role: roleSchema,
    name: z.string().min(1),
    title: z.string().optional(),
    email: z.string().email().optional(),
    phone: phoneSchema.optional(),
    /** Set for doctor accounts. */
    doctorId: idSchema.optional(),
    /** Set once a patient account has completed registration. */
    patientId: idSchema.optional(),
    active: z.boolean(),
  })
  .refine((u) => u.role !== 'doctor' || Boolean(u.doctorId), { message: 'required', path: ['doctorId'] })
  .refine((u) => u.role !== 'patient' || Boolean(u.phone), { message: 'required', path: ['phone'] });
export type User = z.infer<typeof userSchema>;

/** What the app keeps for the signed-in user (memory + sessionStorage). */
export interface Session {
  userId: string;
  role: Role;
  name: string;
  doctorId?: string;
  patientId?: string;
  phone?: string;
  signedInAt: string;
}
