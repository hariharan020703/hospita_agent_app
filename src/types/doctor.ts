import { z } from 'zod';
import { genderSchema, idSchema, langSchema, localizedSchema } from './common';

export const doctorSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(2).max(80),
  /** Name in Tamil script, shown when the app is in Tamil. */
  nameTa: z.string().trim().max(80).optional(),
  gender: genderSchema,
  /** URL or data URL; initials are shown when absent. */
  photoUrl: z.string().optional(),
  qualifications: z.array(z.string().trim().min(1)).min(1),
  /** Tamil Nadu Medical Council registration number. */
  registrationNo: z.string().trim().min(3).max(30),
  departmentId: idSchema,
  languages: z.array(langSchema).min(1),
  fee: z.number().int().min(0).max(10000),
  consultMins: z.number().int().min(5).max(60),
  room: z.string().trim().min(1).max(20),
  experienceYears: z.number().int().min(0).max(60),
  bio: localizedSchema.optional(),
  active: z.boolean(),
});
export type Doctor = z.infer<typeof doctorSchema>;

export const doctorFormSchema = z.object({
  name: z.string().trim().min(2).max(80),
  nameTa: z.string().trim().max(80),
  gender: genderSchema,
  photoUrl: z.string().optional(),
  qualifications: z.string().trim().min(2).max(120),
  registrationNo: z.string().trim().min(3).max(30),
  departmentId: z.string().min(1),
  languages: z.array(langSchema).min(1),
  fee: z.coerce.number({ invalid_type_error: 'number' }).int().min(0).max(10000),
  consultMins: z.coerce.number({ invalid_type_error: 'number' }).int().min(5).max(60),
  room: z.string().trim().min(1).max(20),
  experienceYears: z.coerce.number({ invalid_type_error: 'number' }).int().min(0).max(60),
  bioEn: z.string().trim().max(400),
  bioTa: z.string().trim().max(400),
  active: z.boolean(),
});
export type DoctorFormInput = z.input<typeof doctorFormSchema>;
export type DoctorFormValues = z.output<typeof doctorFormSchema>;

export interface DoctorFilters {
  departmentId?: string;
  lang?: 'en' | 'ta';
  gender?: 'female' | 'male';
  maxFee?: number;
  q?: string;
  includeInactive?: boolean;
}
