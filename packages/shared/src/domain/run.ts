import type { AskOptions } from './askOptions';
import type { RunUsage } from './runUsage';

export const RUN_STATUSES = ['queued', 'running', 'done', 'failed', 'cancelled'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

// A ticket run works on a ticket; an ask run answers a chat question.
export const RUN_KINDS = ['ticket', 'ask'] as const;
export type RunKind = (typeof RUN_KINDS)[number];

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

export const RUNNER_NAME_MAX = 60;
export const RUNNER_PROJECTS_MAX = 50;
export const RUN_ERROR_MAX = 2000;
// A ticket's longest description, its last review and room to edit.
export const RUN_PROMPT_MAX = 100_000;

export interface Runner {
  id: string;
  name: string;
  projectKeys: string[];
  createdAt: number;
  lastSeenAt: number;
  online: boolean;
}

export interface Run {
  id: string;
  kind: RunKind;
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
  usage: RunUsage | null;
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
