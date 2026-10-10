export const RUN_STATUSES = ['queued', 'running', 'done', 'failed', 'cancelled'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

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
  ticketKey: string;
  runnerId: string | null;
  runnerName: string;
  status: RunStatus;
  error: string | null;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
}

export interface RunJob {
  run: Run;
  prompt: string;
}

export interface RunEvent {
  type: 'run';
  runId: string;
  runnerId: string | null;
  projectId: string;
  ticketId: string;
  status: RunStatus;
}
