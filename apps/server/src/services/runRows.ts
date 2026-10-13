import { randomUUID } from 'node:crypto';
import type { UserScope } from '../auth/scope';
import { isUniqueViolation } from '../db/errors';
import type { RunnerRow, RunRow } from '../db/runTables';
import type { Db } from '../db/schema';
import { conflict } from '../errors';
import { insertRun } from '../repositories/runs';

export interface QueuedRun {
  scope: UserScope;
  runner: RunnerRow;
  projectId: string;
  now: number;
}

type RunTarget = Pick<
  RunRow,
  | 'kind'
  | 'ticketId'
  | 'chatId'
  | 'resumeSessionId'
  | 'prompt'
  | 'askModel'
  | 'askMode'
  | 'askEffort'
>;

export const queuedRunRow = (run: QueuedRun, target: RunTarget): RunRow => ({
  id: randomUUID(),
  userId: run.scope,
  projectId: run.projectId,
  runnerId: run.runner.id,
  runnerName: run.runner.name,
  status: 'queued',
  error: null,
  createdAt: run.now,
  startedAt: null,
  endedAt: null,
  stepCount: 0,
  costMicros: null,
  turns: null,
  durationMs: null,
  ...target,
  prompt: target.prompt.trim(),
});

// A partial unique index allows one active run per ticket and per chat, so two taps that race
// can't both start one.
export async function insertQueuedRun(db: Db, row: RunRow, busy: string): Promise<void> {
  try {
    await insertRun(db, row);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    throw conflict(busy);
  }
}
