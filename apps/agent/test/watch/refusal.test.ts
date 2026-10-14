import { DEFAULT_ASK_OPTIONS, type AskMode, type Run, type RunJob } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { refusalOf } from '../../src/watch/refusal';

const job = (run: Partial<Run>): RunJob => ({
  prompt: 'Go',
  resumeSessionId: null,
  ticketKeys: [],
  run: {
    id: 'r-1',
    kind: 'ticket',
    projectKey: 'MOB',
    ticketKey: 'MOB-3',
    chatId: null,
    askOptions: null,
    runnerId: 'x',
    runnerName: 'Mac',
    status: 'running',
    error: null,
    createdAt: 1,
    startedAt: 2,
    endedAt: null,
    stepCount: 0,
    batchId: null,
    ...run,
  },
});

const ticketLane = { projectKey: 'MOB', kind: 'ticket' as const };
const askLane = { projectKey: 'MOB', kind: 'ask' as const };
const question = { kind: 'ask' as const, ticketKey: null, chatId: 'c-1' };
const asked = (mode: AskMode) => ({ ...question, askOptions: { ...DEFAULT_ASK_OPTIONS, mode } });

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
      'This helper\'s ticket lane does not take runs of the "ask" lane.',
    );
    expect(refusalOf(job({ kind: 'later' as Run['kind'] }), ticketLane)).toBe(
      'This helper\'s ticket lane does not take runs of the "later" lane.',
    );
    expect(refusalOf(job({ ticketKey: null }), ticketLane)).toBe('This ticket run has no ticket.');
  });

  it("takes a batch of this helper's project in the ticket lane only", () => {
    const batch = { kind: 'batch' as const, ticketKey: null };
    expect(refusalOf(job(batch), ticketLane)).toBeUndefined();
    expect(refusalOf(job({ ...batch, projectKey: 'WEB' }), ticketLane)).toBe(
      'This helper only runs MOB tickets, not a WEB batch.',
    );
    expect(refusalOf(job(batch), askLane)).toBe(
      'This helper\'s ask lane does not take runs of the "ticket" lane.',
    );
  });

  it('keeps ticket runs out of the read-only lane', () => {
    expect(refusalOf(job({}), askLane)).toBe(
      'This helper\'s ask lane does not take runs of the "ticket" lane.',
    );
  });

  it('takes Ask and Plan questions in the read-only lane only', () => {
    for (const mode of ['ask', 'plan'] as const) {
      expect(refusalOf(job(asked(mode)), askLane)).toBeUndefined();
      expect(refusalOf(job(asked(mode)), ticketLane)).toBe(
        'This helper\'s ticket lane does not take runs of the "ask" lane.',
      );
    }
  });

  it('takes an Edit question in the ticket lane only, so it never edits beside a ticket run', () => {
    expect(refusalOf(job(asked('edit')), ticketLane)).toBeUndefined();
    expect(refusalOf(job(asked('edit')), askLane)).toBe(
      'This helper\'s ask lane does not take runs of the "ticket" lane.',
    );
  });

  it('refuses an Edit question about another project', () => {
    expect(refusalOf(job({ ...asked('edit'), projectKey: 'WEB' }), ticketLane)).toBe(
      'This helper only answers about MOB, not WEB.',
    );
  });

  it('keeps a question with options the helper does not know in the read-only lane', () => {
    const odd = { ...question, askOptions: { model: 'default', mode: 'yolo' } as never };
    expect(refusalOf(job(odd), askLane)).toBeUndefined();
    expect(refusalOf(job(odd), ticketLane)).toBe(
      'This helper\'s ticket lane does not take runs of the "ask" lane.',
    );
  });
});
