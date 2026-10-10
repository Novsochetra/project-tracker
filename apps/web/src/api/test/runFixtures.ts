import type { Run, Runner } from '@tracker/shared';

export const DARA = "Dara's MacBook";

export const makeRunner = (overrides: Partial<Runner> = {}): Runner => ({
  id: 'h-dara',
  name: DARA,
  projectKeys: ['MOB'],
  createdAt: 1,
  lastSeenAt: Date.now(),
  online: true,
  ...overrides,
});

export const makeRun = (overrides: Partial<Run> = {}): Run => ({
  id: 'r-1',
  ticketKey: 'MOB-1',
  runnerId: 'h-dara',
  runnerName: DARA,
  status: 'queued',
  error: null,
  createdAt: Date.now(),
  startedAt: null,
  endedAt: null,
  ...overrides,
});
