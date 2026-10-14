import type { AskOptions } from './askOptions';
import type { Attachment } from './attachment';
import type { ChainStop } from './autoReview';
import type { RunUsage } from './runUsage';
import type { StatusCategory } from './status';

export const RUN_STATUSES = ['queued', 'running', 'done', 'failed', 'cancelled'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

// A ticket run works on a ticket; an ask run answers a chat question; a batch run works on many
// tickets with sub agents (Run all), each ticket held by a run of its own in the batch.
export const RUN_KINDS = ['ticket', 'ask', 'batch'] as const;
export type RunKind = (typeof RUN_KINDS)[number];

// A work run does the ticket; a review run checks the work on a ticket in review and records a
// review. Ask runs are work runs.
export const RUN_ROLES = ['work', 'review'] as const;
export type RunRole = (typeof RUN_ROLES)[number];

export const roleForCategory = (category: StatusCategory): RunRole =>
  category === 'in_review' ? 'review' : 'work';

// A helper runs one run of each lane at a time; a batch runs in the ticket lane.
export const RUN_LANES = ['ticket', 'ask'] as const;
export type RunLane = (typeof RUN_LANES)[number];

export const ACTIVE_RUN_STATUSES = ['queued', 'running'] as const satisfies readonly RunStatus[];
export const ENDED_RUN_STATUSES = [
  'done',
  'failed',
  'cancelled',
] as const satisfies readonly RunStatus[];
export type EndedRunStatus = (typeof ENDED_RUN_STATUSES)[number];

// How many runs of one project may run at once, and how many sub agents a batch starts at once; a
// project can set its own within the maximum.
export const DEFAULT_MAX_PARALLEL_RUNS = 5;
export const MAX_PARALLEL_RUNS_MAX = 5;
// One Claude session hands out every ticket of its batch and gets every sub agent's result, so a
// batch holds no more than its context can take; the rest wait for the next Run all.
export const BATCH_TICKETS_MAX = 30;
export const BATCH_NEEDS_NEW_HELPER =
  "This computer's tracker watch is too old for Run all. Update it and press Run all Todo again.";

// The Activity screen keeps a failed run in view for a day, so a person who was away still sees it.
export const FAILED_RUN_SHOWN_MS = 24 * 60 * 60_000;

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
  usage: RunUsage | null;
  // Why the project's automatic review went no further after this run. Optional: trackers from
  // before PT-192 don't send it.
  chainStop?: ChainStop | null;
  // The batch run a ticket's run belongs to; the batch's Claude works on it, not a run of its own.
  batchId: string | null;
}

export interface RunJob {
  run: Run;
  prompt: string;
  // Claude Code's session from the chat's last answer on this helper, for an ask to continue it.
  resumeSessionId: string | null;
  // An older tracker sends none.
  files?: Attachment[];
  // A batch's tickets, so the helper can put each one's report on it; empty for other runs. An
  // older tracker sends none.
  ticketKeys?: string[];
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

// A run is waiting while it is queued.
export const ACTIVITY_STATES = ['running', 'waiting', 'failed'] as const;
export type ActivityState = (typeof ACTIVITY_STATES)[number];

export interface ActivityRun {
  runId: string;
  batchId: string | null;
  projectKey: string;
  projectName: string;
  ticketKey: string;
  ticketTitle: string;
  state: ActivityState;
  startedAt: number | null;
  createdAt: number;
}

export const BATCH_TICKET_STATES = ['waiting', 'running', 'done', 'failed', 'cancelled'] as const;
export type BatchTicketState = (typeof BATCH_TICKET_STATES)[number];

export interface BatchTicket {
  ticketKey: string;
  ticketTitle: string;
  state: BatchTicketState;
}

export interface RunBatch {
  runId: string;
  projectKey: string;
  status: RunStatus;
  tickets: BatchTicket[];
}

export interface ActivityBatch {
  runId: string;
  projectKey: string;
  projectName: string;
  state: ActivityState;
  total: number;
  done: number;
  failedKeys: string[];
  startedAt: number | null;
  createdAt: number;
}

export interface RunActivity {
  runs: ActivityRun[];
  batches: ActivityBatch[];
  runningCount: number;
  limit: number;
}

export interface RunAllInput {
  runnerId: string;
  // Sub agents at once for this batch; the project's setting when left out.
  maxParallel?: number | undefined;
}

// Run all Todo: the batch it queued, and why it left tickets out.
export interface RunAllResult {
  runId: string | null;
  queued: number;
  skippedActive: number;
  skippedDevice: number;
  // To do tickets past BATCH_TICKETS_MAX, left for the next Run all.
  leftOver: number;
  maxParallel: number;
}

// What Run all would do now, for the chat's card to show before the person confirms.
export interface RunAllPreview {
  tickets: { ticketKey: string; ticketTitle: string }[];
  skippedActive: number;
  skippedDevice: number;
  leftOver: number;
  maxParallel: number;
}
