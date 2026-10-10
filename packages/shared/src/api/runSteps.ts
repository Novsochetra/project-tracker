import { z } from 'zod';
import {
  RUN_STEP_LABEL_MAX,
  RUN_STEP_TEXT_MAX,
  RUN_STEPS_BATCH_MAX,
  type RunStepKind,
} from '../domain/runStep';
import { runnerId } from './runs';

const SEQ_MAX = 2_147_483_647;

const stepOf = <K extends RunStepKind>(kind: K, max: number) =>
  z.object({
    kind: z.literal(kind),
    label: z
      .string()
      .trim()
      .min(1, 'Give every step a label.')
      .max(max, `Use at most ${max} characters for a ${kind} step.`),
    subAgent: z.boolean().default(false),
  });

export const runStepInput = z.discriminatedUnion('kind', [
  stepOf('tool', RUN_STEP_LABEL_MAX),
  stepOf('agent', RUN_STEP_LABEL_MAX),
  stepOf('text', RUN_STEP_TEXT_MAX),
]);

// The helper names itself, so only the helper that took the run adds to it.
export const addRunStepsInput = z.object({
  runnerId,
  steps: z
    .array(runStepInput)
    .min(1, 'Send at least one step.')
    .max(RUN_STEPS_BATCH_MAX, `Send at most ${RUN_STEPS_BATCH_MAX} steps at a time.`),
});
export type AddRunStepsInput = z.input<typeof addRunStepsInput>;

// The steps after the last one the phone has, so a refresh on every step event stays small.
export const runStepsQuery = z.object({
  after: z.coerce.number().int().min(0).max(SEQ_MAX).default(0),
});
export type RunStepsQuery = z.input<typeof runStepsQuery>;
