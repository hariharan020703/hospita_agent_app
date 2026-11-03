import { z } from 'zod';
import { channelSchema, dateTimeSchema, dayOffsetSchema, idSchema, phoneSchema } from './common';
import { ESCALATION_REASONS } from './triage';

const escalationBase = z.object({
  id: idSchema,
  triageId: idSchema.optional(),
  patientId: idSchema.optional(),
  phone: phoneSchema.optional(),
  channel: channelSchema,
  reason: z.enum(ESCALATION_REASONS),
  /** What the patient said, for the receptionist. */
  summary: z.string().min(1).max(500),
  status: z.enum(['open', 'resolved']),
  resolution: z.string().max(300).optional(),
  resolvedBy: idSchema.optional(),
});

export const escalationSchema = escalationBase.extend({
  createdAt: dateTimeSchema,
  resolvedAt: dateTimeSchema.optional(),
});
export type Escalation = z.infer<typeof escalationSchema>;

export const escalationSeedSchema = escalationBase.extend({ day: dayOffsetSchema, at: z.string() });
