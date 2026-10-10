import type {
  Activity,
  FinishRunInput,
  ReportInput,
  Run,
  RunJob,
  TicketDetail,
} from '@tracker/shared';
import { vi } from 'vitest';
import type { WatchApi } from '../../src/watch/watchApi';

export const RUNNER = 'runner-1';

export const runOf = (id: string, ticketKey: string): Run => ({
  id,
  ticketKey,
  runnerId: RUNNER,
  runnerName: 'Mac',
  status: 'running',
  error: null,
  createdAt: 1,
  startedAt: 2,
  endedAt: null,
});

export const job = (id: string, ticketKey: string, prompt = `Work on ${ticketKey}`): RunJob => ({
  run: runOf(id, ticketKey),
  prompt,
});

export const reportEntry = (createdAt: number): Activity =>
  ({ id: `a-${createdAt}`, type: 'report', text: 'TICKET: MOB-1', createdAt }) as Activity;

export function fakeTracker(jobs: RunJob[]) {
  const ended: (FinishRunInput & { id: string })[] = [];
  const statuses = new Map<string, Run['status']>();
  const reports: ReportInput[] = [];
  const activity: Activity[] = [];
  const api: WatchApi = {
    listProjects: vi.fn(),
    eventsUrl: () => 'http://tracker.test/api/events',
    registerRunner: vi.fn(() => Promise.resolve({} as never)),
    takeNextRun: vi.fn(() => Promise.resolve(jobs.shift() ?? null)),
    finishRun: vi.fn((id: string, input: FinishRunInput) => {
      ended.push({ id, ...input });
      return Promise.resolve({} as Run);
    }),
    getRun: vi.fn((id: string) =>
      Promise.resolve({ ...runOf(id, 'MOB-1'), status: statuses.get(id) ?? 'running' }),
    ),
    getTicket: vi.fn(() => Promise.resolve({ activity } as TicketDetail)),
    applyReport: vi.fn((input: ReportInput) => {
      reports.push(input);
      return Promise.resolve({ updatedTicketKeys: [input.ticketKey ?? ''] });
    }),
  };
  return { api, ended, statuses, reports, activity };
}
