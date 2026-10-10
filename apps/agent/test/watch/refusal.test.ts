import type { RunJob } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { refusalOf } from '../../src/watch/refusal';

const job = (ticketKey: string): RunJob => ({
  prompt: 'Go',
  resumeSessionId: null,
  run: {
    id: 'r-1',
    kind: 'ticket',
    projectKey: ticketKey.split('-')[0] ?? '',
    ticketKey,
    chatId: null,
    runnerId: 'x',
    runnerName: 'Mac',
    status: 'running',
    error: null,
    createdAt: 1,
    startedAt: 2,
    endedAt: null,
  },
});

describe('refusalOf', () => {
  it("refuses a ticket outside this helper's project, even one whose key starts the same", () => {
    expect(refusalOf(job('MOB-3'), 'MOB')).toBeUndefined();
    expect(refusalOf(job('MOBILE-3'), 'MOB')).toBe(
      'This helper only runs MOB tickets, not MOBILE-3.',
    );
  });

  it('refuses a question about another project', () => {
    const ask: RunJob = {
      ...job('MOB-3'),
      run: { ...job('MOB-3').run, kind: 'ask', ticketKey: null, chatId: 'c-1', projectKey: 'WEB' },
    };
    expect(refusalOf(ask, 'MOB')).toBe('This helper only answers about MOB, not WEB.');
    expect(refusalOf({ ...ask, run: { ...ask.run, projectKey: 'MOB' } }, 'MOB')).toBeUndefined();
  });
});
