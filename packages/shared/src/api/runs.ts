import { z } from 'zod';
import {
  ENDED_RUN_STATUSES,
  RUN_ERROR_MAX,
  RUN_PROMPT_MAX,
  RUNNER_NAME_MAX,
  RUNNER_PROJECTS_MAX,
} from '../domain/run';

// A helper picks its own id once and keeps it, so runs queued while it restarts still find it.
export const runnerId = z.uuid('Use a UUID for the runner id.');

export const startRunInput = z.object({
  runnerId,
  prompt: z
    .string()
    .trim()
    .min(1, 'Write a prompt for Claude Code.')
    .max(RUN_PROMPT_MAX, `Use at most ${RUN_PROMPT_MAX} characters for the prompt.`),
});
export type StartRunInput = z.input<typeof startRunInput>;

export const registerRunnerInput = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name the computer, like “Dara’s MacBook”.')
    .max(RUNNER_NAME_MAX, `Use at most ${RUNNER_NAME_MAX} characters for the name.`),
  projectKeys: z
    .array(z.string().trim().min(1).max(20))
    .min(1, 'Name at least one project this computer runs.')
    .max(RUNNER_PROJECTS_MAX),
});
export type RegisterRunnerInput = z.input<typeof registerRunnerInput>;

export const finishRunInput = z.object({
  status: z.enum(ENDED_RUN_STATUSES),
  error: z.string().trim().max(RUN_ERROR_MAX).optional(),
});
export type FinishRunInput = z.input<typeof finishRunInput>;
