import type { AskOptions } from './askOptions';
import type { ChainStop } from './autoReview';
import type { StatusCategory } from './status';

export const RUN_STATUSES = ['queued', 'running', 'done', 'failed', 'cancelled'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

// A ticket run works on a ticket; an ask run answers a chat question.
export const RUN_KINDS = ['ticket', 'ask'] as const;
export type RunKind = (typeof RUN_KINDS)[number];

// A work run does the ticket; a review run checks the work on a ticket in review and records a
// review. Ask runs are work runs.
export const RUN_ROLES = ['work', 'review'] as const;
export type RunRole = (typeof RUN_ROLES)[number];

export const roleForCategory = (category: StatusCategory): RunRole =>
  category === 'in_review' ? 'review' : 'work';

export const ACTIVE_RUN_STATUSES = ['queued', 'running'] as const satisfies readonly RunStatus[];
export const ENDED_RUN_STATUSES = [
  'done',
  'failed',
  'cancelled',
] as const satisfies readonly RunStatus[];
export type EndedRunStatus = (typeof ENDED_RUN_STATUSES)[number];

// A helper checks in about every 20 s, so a minute of silence means it is gone.
export const RUNNER_ONLINE_MS = 60_000;

// Long enough for a laptop to wake or a helper to restart, short enough that a phone stops waiting.
export const HELPER_SILENCE_MS = 30 * 60_000;

export const RUN_NOT_TAKEN = "Your computer didn't take the run.";
export const RUN_LOST = 'Your computer stopped answering.';
export const RUN_RESTARTED = 'The helper restarted before it finished.';
export const RUNNER_REMOVED = 'That computer was removed.';
export const REVIEW_NOT_RECORDED = "Claude didn't record a review.";

export const RUNNER_NAME_MAX = 60;
export const RUNNER_PROJECTS_MAX = 50;
export const RUNNER_TOOLS_MAX = 40;
export const RUNNER_TOOL_NAME_MAX = 64;
export const RUN_ERROR_MAX = 2000;
// A ticket's longest description, its last review and room to edit.
export const RUN_PROMPT_MAX = 100_000;

// Names only: a server's address, command or environment can hold a secret.
export interface RunnerTools {
  servers: string[];
  commands: string[];
  skills: string[];
}

export interface Runner {
  id: string;
  name: string;
  projectKeys: string[];
  // Null from a helper older than tools.
  tools: RunnerTools | null;
  createdAt: number;
  lastSeenAt: number;
  online: boolean;
}

export interface Run {
  id: string;
  kind: RunKind;
  role: RunRole;
  projectKey: string;
  ticketKey: string | null;
  chatId: string | null;
  // The person's choice for a question; null for a ticket run.
  askOptions: AskOptions | null;
  runnerId: string | null;
  runnerName: string;
  status: RunStatus;
  error: string | null;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
  // How many steps the helper has sent, the oldest dropped included (the latest step's seq).
  stepCount: number;
  // Why the project's automatic review went no further after this run. Optional: trackers from
  // before PT-192 don't send it.
  chainStop?: ChainStop | null;
}

export interface RunJob {
  run: Run;
  prompt: string;
  // Claude Code's session from the chat's last answer on this helper, for an ask to continue it.
  resumeSessionId: string | null;
}

export interface RunEvent {
  type: 'run';
  runId: string;
  runnerId: string | null;
  projectId: string;
  ticketId: string | null;
  chatId: string | null;
  status: RunStatus;
}
