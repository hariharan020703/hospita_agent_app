import { z } from 'zod';
import { dateTimeSchema, genderSchema, idSchema, langSchema, phoneSchema, pincodeSchema } from './common';

export const RELATIONS = ['self', 'spouse', 'parent', 'child', 'sibling', 'other'] as const;
export const relationSchema = z.enum(RELATIONS);
export type Relation = z.infer<typeof relationSchema>;

/** ABHA number (Ayushman Bharat Health Account): 14 digits, stored as XX-XXXX-XXXX-XXXX. */
export const abhaNumberSchema = z.string().regex(/^\d{2}-\d{4}-\d{4}-\d{4}$/, { message: 'abha' });

export function formatAbha(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length !== 14) return input.trim();
  return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10)}`;
}

/** Form input: accepts 14 digits with or without hyphens/spaces; empty means "not provided". */
export const abhaInputSchema = z
  .string()
  .trim()
  .transform((v) => (v === '' ? undefined : formatAbha(v)))
  .pipe(abhaNumberSchema.optional());

export const addressSchema = z.object({
  line1: z.string().trim().min(1).max(120),
  area: z.string().trim().min(1).max(60),
  city: z.string().trim().min(1).max(60),
  pincode: pincodeSchema,
});
export type Address = z.infer<typeof addressSchema>;

export const consentSchema = z.object({
  version: z.string(),
  acceptedAt: dateTimeSchema,
  /** Consent to store and process health information for appointments (required). */
  dataProcessing: z.literal(true),
  /** Consent to receive SMS/WhatsApp updates (optional). */
  notifications: z.boolean(),
});
export type Consent = z.infer<typeof consentSchema>;

export const patientSchema = z.object({
  id: idSchema,
  /** Family members share a household; the account holder books for all of them. */
  householdId: idSchema,
  relation: relationSchema,
  name: z.string().trim().min(2).max(80),
  birthYear: z.number().int().min(1900).max(2100),
  gender: genderSchema,
  phone: phoneSchema,
  address: addressSchema,
  abhaNumber: abhaNumberSchema.optional(),
  preferredLang: langSchema,
  conditions: z.array(z.string().min(1).max(60)),
  consent: consentSchema.optional(),
  createdAt: dateTimeSchema,
});
export type Patient = z.infer<typeof patientSchema>;

/** Shared by patient registration, family members, kiosk and front-desk walk-in forms. */
export const patientFormSchema = z.object({
  name: z.string().trim().min(2).max(80),
  age: z.coerce.number({ invalid_type_error: 'number' }).int().min(0).max(120),
  gender: genderSchema,
  phone: phoneSchema,
  address: addressSchema,
  abhaNumber: abhaInputSchema,
  preferredLang: langSchema,
  relation: relationSchema,
  conditions: z.string().trim().max(200),
});
export type PatientFormInput = z.input<typeof patientFormSchema>;
export type PatientFormValues = z.output<typeof patientFormSchema>;
