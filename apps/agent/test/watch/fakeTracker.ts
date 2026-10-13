import { laneOf } from '@tracker/shared';
import type {
  Activity,
  AddRunStepsInput,
  AskOptions,
  FinishRunInput,
  ReportInput,
  Run,
  RunJob,
  RunKind,
  TicketDetail,
} from '@tracker/shared';
import { vi } from 'vitest';
import type { ClaudeExit } from '../../src/watch/outcome';
import type { WatchApi } from '../../src/watch/watchApi';

export const RUNNER = 'runner-1';

export const noAsks = (): Promise<ClaudeExit> => Promise.reject(new Error('No asks in this test.'));

export const answered = (text: string, sessionId?: string): ClaudeExit => ({
  code: 0,
  signal: null,
  output: `${text}\n`,
  results: [{ text, sessionId, isError: false }],
});

export const runOf = (id: string, ticketKey: string): Run => ({
  id,
  kind: 'ticket',
  projectKey: ticketKey.split('-')[0] ?? '',
  ticketKey,
  chatId: null,
  askOptions: null,
  runnerId: RUNNER,
  runnerName: 'Mac',
  status: 'running',
  error: null,
  createdAt: 1,
  startedAt: 2,
  endedAt: null,
  stepCount: 0,
  usage: null,
});

export const job = (id: string, ticketKey: string, prompt = `Work on ${ticketKey}`): RunJob => ({
  run: runOf(id, ticketKey),
  prompt,
  resumeSessionId: null,
});

export const askJob = (
  id: string,
  chatId: string,
  resumeSessionId: string | null = null,
  askOptions: AskOptions | null = null,
): RunJob => ({
  run: { ...runOf(id, 'MOB-0'), kind: 'ask', ticketKey: null, chatId, askOptions },
  prompt: `Question in ${chatId}`,
  resumeSessionId,
});

export const reportEntry = (createdAt: number): Activity =>
  ({ id: `a-${createdAt}`, type: 'report', text: 'TICKET: MOB-1', createdAt }) as Activity;

export function fakeTracker(jobs: RunJob[]) {
  const ended: (FinishRunInput & { id: string })[] = [];
  const statuses = new Map<string, Run['status']>();
  const reports: ReportInput[] = [];
  const activity: Activity[] = [];
  const steps: (AddRunStepsInput & { id: string })[] = [];
  const api: WatchApi = {
    listProjects: vi.fn(),
    eventsUrl: () => 'http://tracker.test/api/events',
    registerRunner: vi.fn(() => Promise.resolve({} as never)),
    takeNextRun: vi.fn((_runnerId: string, kind: RunKind) => {
      const index = jobs.findIndex(({ run }) => laneOf(run.kind, run.askOptions) === kind);
      return Promise.resolve(index === -1 ? null : (jobs.splice(index, 1)[0] ?? null));
    }),
    finishRun: vi.fn((id: string, input: FinishRunInput) => {
      ended.push({ id, ...input });
      return Promise.resolve({} as Run);
    }),
    addRunSteps: vi.fn((id: string, input: AddRunStepsInput) => {
      steps.push({ id, ...input });
      return Promise.resolve();
    }),
    getRun: vi.fn((id: string) =>
      Promise.resolve({ ...runOf(id, 'MOB-1'), status: statuses.get(id) ?? 'running' }),
    ),
    getTicket: vi.fn(() => Promise.resolve({ activity } as TicketDetail)),
    applyReport: vi.fn((input: ReportInput) => {
      reports.push(input);
      return Promise.resolve({ updatedTicketKeys: [input.ticketKey ?? ''] });
    }),
    addRunRequest: vi.fn(() => Promise.reject(new Error('No requests here.'))),
    waitForRunRequest: vi.fn(() => Promise.reject(new Error('No requests here.'))),
    cancelRunRequest: vi.fn(() => Promise.reject(new Error('No requests here.'))),
  };
  return { api, ended, statuses, reports, activity, steps };
}
