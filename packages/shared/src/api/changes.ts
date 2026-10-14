import { z } from 'zod';
import { REVIEW_VERDICTS } from '../domain/activity';
import { DIFF_DIGEST_MAX, DIFF_PATH_MAX, DIFF_SIDES, RUN_DIFF_MAX } from '../domain/changes';
import { runnerId } from './runs';

const RUN_ID_MAX = 100;
const LINE_MAX = 10_000_000;

const runIdOf = z.string().trim().min(1).max(RUN_ID_MAX);
const path = z.string().min(1).max(DIFF_PATH_MAX);

// Only the helper that took the run sends its changes, before it ends the run.
export const addRunChangesInput = z.object({
  runnerId,
  diff: z
    .string()
    .max(RUN_DIFF_MAX, `Send at most ${RUN_DIFF_MAX.toLocaleString('en-US')} characters.`),
  cut: z.boolean(),
});
export type AddRunChangesInput = z.input<typeof addRunChangesInput>;

export const lineRefInput = z.object({
  runId: runIdOf,
  path,
  side: z.enum(DIFF_SIDES),
  line: z.number().int().min(1).max(LINE_MAX),
});

export const viewedFileInput = z.object({
  path,
  digest: z.string().min(1).max(DIFF_DIGEST_MAX),
  viewed: z.boolean(),
});
export type ViewedFileInput = z.input<typeof viewedFileInput>;

// Names the changes the person looked at, so a verdict never lands on newer ones.
export const changesVerdictInput = z.object({
  runId: runIdOf,
  verdict: z.enum(REVIEW_VERDICTS),
});
export type ChangesVerdictInput = z.input<typeof changesVerdictInput>;
