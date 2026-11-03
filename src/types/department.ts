import { z } from 'zod';
import { idSchema, localizedSchema } from './common';

/** Icon keys; the UI maps them to lucide icons (components/ui/DepartmentIcon). */
export const DEPARTMENT_ICONS = [
  'stethoscope',
  'heart-pulse',
  'bone',
  'baby',
  'venus',
  'hand',
  'ear',
  'brain',
  'eye',
  'siren',
] as const;
export const departmentIconSchema = z.enum(DEPARTMENT_ICONS);
export type DepartmentIcon = z.infer<typeof departmentIconSchema>;

export const departmentSchema = z.object({
  id: idSchema,
  name: localizedSchema,
  description: localizedSchema,
  icon: departmentIconSchema,
  floor: z.number().int().min(0).max(20),
  wing: localizedSchema,
  /** Printed on tokens, e.g. CAR-014. */
  tokenPrefix: z.string().regex(/^[A-Z]{2,4}$/, { message: 'tokenPrefix' }),
  /** Emergency is staffed around the clock and is never booked through the app. */
  bookable: z.boolean(),
  active: z.boolean(),
  sortOrder: z.number().int(),
});
export type Department = z.infer<typeof departmentSchema>;

export const departmentFormSchema = departmentSchema.omit({ id: true, sortOrder: true });
export type DepartmentFormValues = z.infer<typeof departmentFormSchema>;
