import type { RunStatus } from '@tracker/shared';

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
  ticketId: string;
  runnerId: string | null;
  // Copied, so the run still names its computer after the computer is removed.
  runnerName: string;
  prompt: string;
  status: RunStatus;
  error: string | null;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
}

export interface RunTables {
  runners: RunnerRow;
  runs: RunRow;
}
