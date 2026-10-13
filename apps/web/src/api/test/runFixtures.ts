import type { Run, Runner } from '@tracker/shared';

export const DARA = "Dara's MacBook";

export const makeRunner = (overrides: Partial<Runner> = {}): Runner => ({
  id: 'h-dara',
  name: DARA,
  projectKeys: ['MOB'],
  tools: null,
  createdAt: 1,
  lastSeenAt: Date.now(),
  online: true,
  ...overrides,
});

export const makeRun = (overrides: Partial<Run> = {}): Run => ({
  id: 'r-1',
  kind: 'ticket',
  role: 'work',
  projectKey: 'MOB',
  ticketKey: 'MOB-1',
  chatId: null,
  askOptions: null,
  runnerId: 'h-dara',
  runnerName: DARA,
  status: 'queued',
  error: null,
  createdAt: Date.now(),
  startedAt: null,
  endedAt: null,
  stepCount: 0,
  usage: null,
  ...overrides,
});
