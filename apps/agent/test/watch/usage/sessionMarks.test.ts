import { describe, expect, it } from 'vitest';
import { createSessionMarks } from '../../../src/watch/usage/sessionMarks';

const usage = (costUsd: number | undefined, readTokens: number | undefined) => ({
  costUsd,
  readTokens,
  turns: 1,
  durationMs: 1,
});

describe('createSessionMarks', () => {
  it("keeps each session's latest figures", () => {
    const marks = createSessionMarks();
    marks.note('s-1', usage(0.1, 10));
    marks.note('s-1', usage(0.3, 30));
    expect(marks.get('s-1')).toEqual({ costUsd: 0.3, readTokens: 30 });
    expect(marks.get('s-2')).toBeUndefined();
  });

  it('notes nothing without a session or figures', () => {
    const marks = createSessionMarks();
    marks.note(undefined, usage(0.1, 10));
    marks.note('s-1', usage(undefined, 10));
    marks.note('s-2', usage(0.1, undefined));
    expect([marks.get('s-1'), marks.get('s-2')]).toEqual([undefined, undefined]);
  });

  it('forgets the session it saw longest ago once it holds 500', () => {
    const marks = createSessionMarks();
    for (let index = 0; index <= 500; index += 1) marks.note(`s-${index}`, usage(index, index));
    marks.note('s-1', usage(1, 1));
    marks.note('s-501', usage(501, 501));
    expect(marks.get('s-0')).toBeUndefined();
    expect(marks.get('s-1')).toEqual({ costUsd: 1, readTokens: 1 });
    expect(marks.get('s-2')).toBeUndefined();
    expect(marks.get('s-501')).toEqual({ costUsd: 501, readTokens: 501 });
  });
});
