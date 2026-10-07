import { zValidator } from '@hono/zod-validator';
import type { ZodType } from 'zod';
import { invalidInput } from '../errors';

interface ValidationResult {
  success: boolean;
  error?: { issues: readonly { message: string }[] };
}

export function rejectInvalid(result: ValidationResult): void {
  if (!result.success) throw invalidInput(result.error?.issues[0]?.message ?? 'Invalid input.');
}

export const jsonBody = <T extends ZodType>(schema: T) => zValidator('json', schema, rejectInvalid);

export const queryParams = <T extends ZodType>(schema: T) =>
  zValidator('query', schema, rejectInvalid);
