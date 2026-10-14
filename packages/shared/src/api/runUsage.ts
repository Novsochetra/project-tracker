import { z } from 'zod';

const whole = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
// Far past any model's window, so a helper's mistake can't make the meter meaningless.
const CONTEXT_MAX = 100_000_000;

export const runUsageInput = z.object({
  costMicros: whole.optional(),
  // The column is a 32-bit integer on Postgres.
  turns: whole.max(2_147_483_647).optional(),
  durationMs: whole.optional(),
  contextTokens: whole.max(CONTEXT_MAX).optional(),
  contextWindow: whole.positive().max(CONTEXT_MAX).optional(),
  tokens: whole.optional(),
});
export type RunUsageInput = z.input<typeof runUsageInput>;
