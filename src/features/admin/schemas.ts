// Form schemas for the admin editors whose fields differ from the stored shape (comma lists, one group per line).
// Messages are keys in the `validation` namespace, like the shared schemas in src/types.
import { z } from 'zod';
import type { RedFlag, SymptomRule } from '@/types';
import { joinGroups, joinList, splitGroups, splitList } from './lib';

export const ruleFormSchema = z
  .object({
    labelEn: z.string().trim().min(1).max(60),
    labelTa: z.string().trim().min(1).max(60),
    keywordsEn: z.string().max(1000),
    keywordsTa: z.string().max(1000),
    weight: z.coerce.number({ invalid_type_error: 'number' }).min(0.5).max(3),
  })
  .refine((v) => splitList(v.keywordsEn).length + splitList(v.keywordsTa).length > 0, {
    message: 'required',
    path: ['keywordsEn'],
  });
export type RuleFormInput = z.input<typeof ruleFormSchema>;
export type RuleFormValues = z.output<typeof ruleFormSchema>;

export const ruleToForm = (rule: SymptomRule | null): RuleFormInput =>
  rule
    ? {
        labelEn: rule.label.en,
        labelTa: rule.label.ta,
        keywordsEn: joinList(rule.keywords.en),
        keywordsTa: joinList(rule.keywords.ta),
        weight: rule.weight,
      }
    : { labelEn: '', labelTa: '', keywordsEn: '', keywordsTa: '', weight: 1 };

export const ruleFromForm = (
  values: RuleFormValues,
  departmentId: string,
  id?: string,
): Omit<SymptomRule, 'id'> & { id?: string } => ({
  ...(id ? { id } : {}),
  departmentId,
  label: { en: values.labelEn, ta: values.labelTa },
  keywords: { en: splitList(values.keywordsEn), ta: splitList(values.keywordsTa) },
  weight: values.weight,
});

const DIAL = /^\+?[0-9 ]{3,16}$/;

export const redFlagFormSchema = z
  .object({
    labelEn: z.string().trim().min(1).max(80),
    labelTa: z.string().trim().min(1).max(80),
    groupsEn: z.string().max(3000),
    groupsTa: z.string().max(3000),
    helplineLabelEn: z.string().trim().max(80),
    helplineLabelTa: z.string().trim().max(80),
    helplineNumber: z.string().trim().max(20),
    active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (splitGroups(v.groupsEn).length + splitGroups(v.groupsTa).length === 0)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'required', path: ['groupsEn'] });
    const anyHelpline = Boolean(v.helplineLabelEn || v.helplineLabelTa || v.helplineNumber);
    if (!anyHelpline) return;
    if (!v.helplineLabelEn)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'required', path: ['helplineLabelEn'] });
    if (!v.helplineLabelTa)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'required', path: ['helplineLabelTa'] });
    if (!v.helplineNumber) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'required', path: ['helplineNumber'] });
    else if (!DIAL.test(v.helplineNumber))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid', path: ['helplineNumber'] });
  });
export type RedFlagFormValues = z.infer<typeof redFlagFormSchema>;

export const redFlagToForm = (flag: RedFlag | null): RedFlagFormValues =>
  flag
    ? {
        labelEn: flag.label.en,
        labelTa: flag.label.ta,
        groupsEn: joinGroups(flag.groups.en),
        groupsTa: joinGroups(flag.groups.ta),
        helplineLabelEn: flag.helpline?.label.en ?? '',
        helplineLabelTa: flag.helpline?.label.ta ?? '',
        helplineNumber: flag.helpline?.number ?? '',
        active: flag.active,
      }
    : {
        labelEn: '',
        labelTa: '',
        groupsEn: '',
        groupsTa: '',
        helplineLabelEn: '',
        helplineLabelTa: '',
        helplineNumber: '',
        active: true,
      };

export const redFlagFromForm = (values: RedFlagFormValues, id?: string): Omit<RedFlag, 'id'> & { id?: string } => ({
  ...(id ? { id } : {}),
  label: { en: values.labelEn, ta: values.labelTa },
  groups: { en: splitGroups(values.groupsEn), ta: splitGroups(values.groupsTa) },
  ...(values.helplineNumber
    ? {
        helpline: {
          label: { en: values.helplineLabelEn, ta: values.helplineLabelTa },
          number: values.helplineNumber,
        },
      }
    : {}),
  active: values.active,
});
