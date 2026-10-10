import { describe, expect, it } from 'vitest';
import { stepRows, withoutAnswer } from './stepRows';
import { makeStep } from './testSteps';

describe('stepRows', () => {
  it('marks a call that was not allowed, wherever its denied step comes', () => {
    const rows = stepRows([
      makeStep(1, { label: 'Run echo hello > out.txt', toolId: 'toolu_a' }),
      makeStep(2, { label: 'Read notes.txt', toolId: 'toolu_b' }),
      makeStep(3, {
        kind: 'denied',
        label: 'Not allowed: Run echo hello > out.txt',
        toolId: 'toolu_a',
      }),
    ]);
    expect(rows.map(({ seq, refused }) => [seq, refused])).toEqual([
      [1, true],
      [2, false],
      [3, false],
    ]);
  });

  it('keeps every step, so a list shows as many as its count says', () => {
    const steps = [
      makeStep(1, { kind: 'text', label: 'Let me look.', toolId: null }),
      makeStep(2, { kind: 'agent', label: 'Start sub agent: Find the queue', toolId: 'toolu_s' }),
      makeStep(3, { subAgent: true }),
      makeStep(4, { kind: 'denied', label: 'Not allowed: Start sub agent', toolId: 'toolu_s' }),
    ];
    const rows = stepRows(steps);
    expect(rows).toHaveLength(4);
    expect(rows[1]?.refused).toBe(true);
    expect(rows[2]).toMatchObject({ subAgent: true, refused: false });
  });

  it('marks nothing for a denied step whose call the tracker let go, or text with no id', () => {
    const rows = stepRows([
      makeStep(501, { kind: 'text', label: 'Done.', toolId: null }),
      makeStep(502, { kind: 'denied', label: 'Not allowed: Run rm -rf build', toolId: 'toolu_x' }),
    ]);
    expect(rows.map(({ refused }) => refused)).toEqual([false, false]);
  });
});

describe('withoutAnswer', () => {
  const answer = 'Captures now go in batches of ten.\n\nThe tests pass.';
  const before = [makeStep(1), makeStep(2, { kind: 'text', label: 'Let me look.', toolId: null })];
  const words = (label: string, more = {}) =>
    makeStep(3, { kind: 'text', label, toolId: null, ...more });

  it("leaves out the answer's own words at the end of its steps", () => {
    expect(withoutAnswer(stepRows([...before, words(answer)]), answer)).toHaveLength(2);
  });

  it('knows the answer from words the helper cut short', () => {
    expect(
      withoutAnswer(stepRows([...before, words('Captures now go in batc…')]), answer),
    ).toHaveLength(2);
  });

  it('keeps last words that are not the answer, a sub agent’s, a call, and no steps', () => {
    expect(withoutAnswer(stepRows([...before, words('Something else.')]), answer)).toHaveLength(3);
    const sub = words(answer, { subAgent: true });
    expect(withoutAnswer(stepRows([...before, sub]), answer)).toHaveLength(3);
    expect(withoutAnswer(stepRows([makeStep(1)]), answer)).toHaveLength(1);
    expect(withoutAnswer([], answer)).toEqual([]);
  });
});
