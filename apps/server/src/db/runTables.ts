import type { AskMode, AskModel, RunKind, RunStatus, RunStepKind } from '@tracker/shared';

export interface RunnerRow {
  id: string;
  userId: string | null;
  name: string;
  // Ids, not keys, so renaming a project keeps its helpers.
  projectIds: string;
  createdAt: number;
  lastSeenAt: number;
}

export interface RunRow {
  id: string;
  userId: string | null;
  projectId: string;
  ticketId: string | null;
  runnerId: string | null;
  // Copied, so the run still names its computer after the computer is removed.
  runnerName: string;
  prompt: string;
  status: RunStatus;
  error: string | null;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
  kind: RunKind;
  chatId: string | null;
  // Copied from the chat when the run is queued on the helper that holds that session.
  resumeSessionId: string | null;
  // The question's choice; null on ticket runs and on asks queued before options.
  askModel: AskModel | null;
  askMode: AskMode | null;
  stepCount: number;
}

export interface RunStepRow {
  runId: string;
  seq: number;
  kind: RunStepKind;
  label: string;
  // 0 or 1: neither database's boolean is portable.
  subAgent: number;
  createdAt: number;
}

export interface RunTables {
  runners: RunnerRow;
  runs: RunRow;
  runSteps: RunStepRow;
}
