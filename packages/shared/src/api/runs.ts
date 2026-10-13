import { z } from 'zod';
import { CHAT_ANSWER_MAX } from '../domain/chat';
import {
  ENDED_RUN_STATUSES,
  RUN_KINDS,
  RUN_ROLES,
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
  // The sheet's prompt says which; older apps send none and start work runs.
  role: z.enum(RUN_ROLES).optional(),
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

// A helper runs one run of each kind at a time. One that names no kind predates asks.
export const takeRunQuery = z.object({ kind: z.enum(RUN_KINDS).optional() });
export type TakeRunQuery = z.input<typeof takeRunQuery>;

export const finishRunInput = z.object({
  status: z.enum(ENDED_RUN_STATUSES),
  error: z.string().trim().max(RUN_ERROR_MAX).optional(),
  // An ask run's answer and the Claude Code session that gave it.
  answer: z.string().trim().max(CHAT_ANSWER_MAX).optional(),
  sessionId: z.uuid().optional(),
});
export type FinishRunInput = z.input<typeof finishRunInput>;
