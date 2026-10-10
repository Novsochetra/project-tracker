// A run: a person asked a helper on their own computer (`tracker watch`) to start Claude Code on
// a ticket. It belongs to that person alone; no one else's helper ever sees it.
export const RUN_STATUSES = ['queued', 'running', 'done', 'failed', 'cancelled'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const ACTIVE_RUN_STATUSES = ['queued', 'running'] as const satisfies readonly RunStatus[];
export const ENDED_RUN_STATUSES = [
  'done',
  'failed',
  'cancelled',
] as const satisfies readonly RunStatus[];
export type EndedRunStatus = (typeof ENDED_RUN_STATUSES)[number];

export const isActiveRun = (status: RunStatus): boolean =>
  (ACTIVE_RUN_STATUSES as readonly RunStatus[]).includes(status);

// A helper checks in about every 20 s, so a minute without one means it's gone (closed, asleep,
// offline). The web app offers Run only while one is online.
export const RUNNER_ONLINE_MS = 60_000;

// A run nobody takes in this time fails, so the phone doesn't wait forever for a computer that is
// off. Long enough for a laptop to wake or a helper to restart.
export const RUN_PICKUP_MS = 30 * 60_000;

export const RUN_NOT_TAKEN = "Your computer didn't take the run.";
export const RUNNER_REMOVED = 'That computer was removed.';

export const RUNNER_NAME_MAX = 60;
export const RUNNER_PROJECTS_MAX = 50;
export const RUN_ERROR_MAX = 2000;
// The prompt sheet's text with room to edit: a ticket's longest description and its last review.
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

// What a helper gets when it takes a run: the text to hand Claude Code, never a command.
export interface RunJob {
  run: Run;
  prompt: string;
}

// Sent on GET /api/events as a named `run` event, only to streams of the run's own user.
export interface RunEvent {
  type: 'run';
  runId: string;
  runnerId: string | null;
  projectId: string;
  ticketId: string;
  status: RunStatus;
}
