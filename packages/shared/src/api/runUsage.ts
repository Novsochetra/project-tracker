import { z } from 'zod';

const whole = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const runUsageInput = z.object({
  costMicros: whole.optional(),
  // The column is a 32-bit integer on Postgres.
  turns: whole.max(2_147_483_647).optional(),
  durationMs: whole.optional(),
});
export type RunUsageInput = z.input<typeof runUsageInput>;
