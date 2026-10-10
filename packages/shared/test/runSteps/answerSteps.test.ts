import { describe, expect, it } from 'vitest';
import type { RunStep } from '../../src/domain/runStep';
import { isAnswerStep, withoutAnswer } from '../../src/logic/runSteps/answerSteps';

const step = (seq: number, changes: Partial<RunStep> = {}): RunStep => ({
  seq,
  kind: 'tool',
  label: `Read file-${seq}.ts`,
  subAgent: false,
  toolId: `toolu_${seq}`,
  at: seq,
  ...changes,
});

describe('withoutAnswer', () => {
  const answer = 'Captures now go in batches of ten.\n\nThe tests pass.';
  const before = [step(1), step(2, { kind: 'text', label: 'Let me look.', toolId: null })];
  const words = (label: string, more: Partial<RunStep> = {}) =>
    step(3, { kind: 'text', label, toolId: null, ...more });

  it("leaves out the answer's own words at the end of its steps", () => {
    expect(withoutAnswer([...before, words(answer)], answer)).toEqual(before);
    expect(isAnswerStep(words(answer), answer)).toBe(true);
  });

  it('knows the answer from words the helper cut short', () => {
    expect(withoutAnswer([...before, words('Captures now go in batc…')], answer)).toHaveLength(2);
  });

  it('keeps last words that are not the answer, a sub agent’s, a call, and no steps', () => {
    expect(withoutAnswer([...before, words('Something else.')], answer)).toHaveLength(3);
    expect(withoutAnswer([...before, words(answer, { subAgent: true })], answer)).toHaveLength(3);
    expect(withoutAnswer([step(1)], answer)).toHaveLength(1);
    expect(withoutAnswer([], answer)).toEqual([]);
    expect(isAnswerStep(words('…'), answer)).toBe(false);
  });
});
