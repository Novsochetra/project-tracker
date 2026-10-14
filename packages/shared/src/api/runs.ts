import { z } from 'zod';
import { CHAT_ANSWER_IMAGES_MAX, CHAT_ANSWER_MAX } from '../domain/chat';
import {
  BATCH_TICKETS_MAX,
  ENDED_RUN_STATUSES,
  RUN_ROLES,
  MAX_PARALLEL_RUNS_MAX,
  RUN_LANES,
  RUN_ERROR_MAX,
  RUN_PROMPT_MAX,
  RUNNER_NAME_MAX,
  RUNNER_PROJECTS_MAX,
  RUNNER_TOOL_NAME_MAX,
  RUNNER_TOOLS_MAX,
} from '../domain/run';
import { runUsageInput } from './runUsage';

// A helper picks its own id once and keeps it, so runs queued while it restarts still find it.
export const runnerId = z.uuid('Use a UUID for the runner id.');

export const startRunInput = z.object({
  runnerId,
  prompt: z
    .string()
    .trim()
    .min(1, 'Write a prompt for Claude Code.')
    .max(
      RUN_PROMPT_MAX,
      `A run takes a prompt of up to ${RUN_PROMPT_MAX.toLocaleString('en-US')} characters.`,
    ),
  // The sheet's prompt says which; older apps send none and start work runs.
  role: z.enum(RUN_ROLES).optional(),
});
export type StartRunInput = z.input<typeof startRunInput>;

const toolNames = z.array(z.string().trim().min(1).max(RUNNER_TOOL_NAME_MAX)).max(RUNNER_TOOLS_MAX);

export const runnerTools = z.object({
  servers: toolNames,
  commands: toolNames,
  skills: toolNames,
});

export const runAllInput = z.object({
  runnerId,
  maxParallel: z.number().int().min(1).max(MAX_PARALLEL_RUNS_MAX).optional(),
});

export const runAllCardInput = runAllInput.extend({
  ticketKeys: z.array(z.string().trim().min(1).max(40)).max(BATCH_TICKETS_MAX),
});

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
  // Older helpers send none.
  tools: runnerTools.optional(),
});
export type RegisterRunnerInput = z.input<typeof registerRunnerInput>;

// A helper runs one run of each kind at a time. One that names no kind predates asks, and one that
// doesn't say batches=1 predates batches.
export const takeRunQuery = z.object({
  kind: z.enum(RUN_LANES).optional(),
  batches: z.literal('1').optional(),
});
export type TakeRunQuery = z.input<typeof takeRunQuery>;

export const finishRunInput = z.object({
  status: z.enum(ENDED_RUN_STATUSES),
  error: z.string().trim().max(RUN_ERROR_MAX).optional(),
  // An ask run's answer and the Claude Code session that gave it.
  answer: z.string().trim().max(CHAT_ANSWER_MAX).optional(),
  sessionId: z.uuid().optional(),
  // The pictures the answer shows: the helper's own pending uploads, in the answer's order.
  attachmentIds: z.array(z.string().min(1).max(64)).max(CHAT_ANSWER_IMAGES_MAX).optional(),
  usage: runUsageInput.optional(),
});
export type FinishRunInput = z.input<typeof finishRunInput>;
