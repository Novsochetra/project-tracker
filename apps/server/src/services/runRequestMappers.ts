import type { RunQuestion, RunRequest, RunRequestInput } from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import type { RunRequestRow, RunRow } from '../db/runTables';
import type { ServiceContext } from './context';

// The tracker wrote this text itself, so a value that doesn't parse is only ever a bug: shown as
// nothing rather than failing the read.
function parsed<T>(text: string | null): T | null {
  if (text === null) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function inputOf({ kind, label, labelCut, questions }: RunRequestRow): RunRequestInput {
  const cut = labelCut === 1;
  return kind === 'question'
    ? { kind, label, labelCut: cut, questions: parsed<RunQuestion[]>(questions) ?? [] }
    : { kind, label, labelCut: cut, questions: null };
}

export const toRunRequest = (row: RunRequestRow): RunRequest => ({
  ...inputOf(row),
  id: row.id,
  runId: row.runId,
  status: row.status,
  decision: row.decision,
  answers: parsed<string[]>(row.answers),
  createdAt: row.createdAt,
  expiresAt: row.expiresAt,
  endedAt: row.endedAt,
});

export type RequestRun = Pick<RunRow, 'id' | 'projectId' | 'ticketId' | 'chatId'>;

export function notifyRunRequest(
  ctx: ServiceContext,
  userId: UserScope,
  run: RequestRun,
  row: RunRequestRow,
): void {
  ctx.runEvents.publish({
    userId,
    event: {
      type: 'run-request',
      runId: run.id,
      requestId: row.id,
      projectId: run.projectId,
      ticketId: run.ticketId,
      chatId: run.chatId,
      status: row.status,
    },
  });
}
