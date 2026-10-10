import type { RunStatus } from '@tracker/shared';

// userId is null on a tracker running locally without an owner, where anyone on this computer is
// the one person. Once an owner exists, rows without one belong to nobody who can sign in.
export interface RunnerRow {
  id: string;
  userId: string | null;
  name: string;
  // A JSON array of project ids, so renaming a project's key doesn't cut the helper off.
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
  // Kept with the run, so its history still names the computer after it is removed.
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
