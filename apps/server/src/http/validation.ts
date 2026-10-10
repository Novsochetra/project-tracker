import { zValidator } from '@hono/zod-validator';
import { z, type ZodType } from 'zod';
import { invalidInput } from '../errors';
import { withoutNulInJson } from '../withoutNul';

interface ValidationResult {
  success: boolean;
  error?: { issues: readonly { message: string }[] };
}

export function rejectInvalid(result: ValidationResult): void {
  if (!result.success) throw invalidInput(result.error?.issues[0]?.message ?? 'Invalid input.');
}

// A NUL is dropped as the text arrives, not only on its way into the database, so the answer to a
// write, its activity and its checks against stored text (an edit that changes nothing, the text a
// save was typed over) all see the text as stored.
const droppingNul = <T extends ZodType>(schema: T) => z.preprocess(withoutNulInJson, schema);

export const jsonBody = <T extends ZodType>(schema: T) =>
  zValidator('json', droppingNul(schema), rejectInvalid);

// For sign-in: the password is compared with what owner:set was given, NULs and all, and is never
// kept or shown.
export const jsonBodyAsSent = <T extends ZodType>(schema: T) =>
  zValidator('json', schema, rejectInvalid);

export const queryParams = <T extends ZodType>(schema: T) =>
  zValidator('query', droppingNul(schema), rejectInvalid);
