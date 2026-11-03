// Maps zod issues to i18n keys in the `validation` namespace ("key" or "key:count"), so forms show translated errors.
import { z, ZodIssueCode, type ZodErrorMap } from 'zod';

export const validationErrorMap: ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === 'undefined' || issue.received === 'null') return { message: 'required' };
      if (issue.expected === 'number') return { message: 'number' };
      return { message: 'invalid' };
    case ZodIssueCode.too_small:
      if (issue.type === 'string')
        return { message: Number(issue.minimum) <= 1 ? 'required' : `tooShort:${Number(issue.minimum)}` };
      if (issue.type === 'array')
        return { message: Number(issue.minimum) <= 1 ? 'selectOne' : `selectMin:${Number(issue.minimum)}` };
      return { message: `min:${Number(issue.minimum)}` };
    case ZodIssueCode.too_big:
      if (issue.type === 'string') return { message: `tooLong:${Number(issue.maximum)}` };
      return { message: `max:${Number(issue.maximum)}` };
    case ZodIssueCode.invalid_string:
      if (issue.validation === 'email') return { message: 'email' };
      return { message: 'invalid' };
    case ZodIssueCode.invalid_enum_value:
      return { message: 'selectOne' };
    default:
      return { message: ctx.defaultError };
  }
};

z.setErrorMap(validationErrorMap);
