import type { Run, RunJob } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { refusalOf } from '../../src/watch/refusal';

const job = (run: Partial<Run>): RunJob => ({
  prompt: 'Go',
  resumeSessionId: null,
  run: {
    id: 'r-1',
    kind: 'ticket',
    projectKey: 'MOB',
    ticketKey: 'MOB-3',
    chatId: null,
    runnerId: 'x',
    runnerName: 'Mac',
    status: 'running',
    error: null,
    createdAt: 1,
    startedAt: 2,
    endedAt: null,
    ...run,
  },
});

const ticketLane = { projectKey: 'MOB', kind: 'ticket' as const };
const askLane = { projectKey: 'MOB', kind: 'ask' as const };
const question = { kind: 'ask' as const, ticketKey: null, chatId: 'c-1' };

describe('refusalOf', () => {
  it("refuses a ticket outside this helper's project, even one whose key starts the same", () => {
    expect(refusalOf(job({}), ticketLane)).toBeUndefined();
    expect(refusalOf(job({ ticketKey: 'MOBILE-3' }), ticketLane)).toBe(
      'This helper only runs MOB tickets, not MOBILE-3.',
    );
  });

  it('refuses a question about another project', () => {
    expect(refusalOf(job(question), askLane)).toBeUndefined();
    expect(refusalOf(job({ ...question, projectKey: 'WEB' }), askLane)).toBe(
      'This helper only answers about MOB, not WEB.',
    );
  });

  it("never lets a question or an unknown kind take the ticket lane's permission mode", () => {
    expect(refusalOf(job(question), ticketLane)).toBe(
      'This helper expected a run of kind "ticket", not "ask".',
    );
    expect(refusalOf(job({ kind: 'later' as Run['kind'] }), ticketLane)).toBe(
      'This helper expected a run of kind "ticket", not "later".',
    );
    expect(refusalOf(job({ ticketKey: null }), ticketLane)).toBe('This ticket run has no ticket.');
  });

  it('keeps ticket runs out of the read-only lane', () => {
    expect(refusalOf(job({}), askLane)).toBe(
      'This helper expected a run of kind "ask", not "ticket".',
    );
  });
});
