import { RUN_STEPS_KEPT, type RunStep } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { lastSeq, mergeSteps } from './runSteps';

const step = (seq: number, label = `Read file${seq}.ts`): RunStep => ({
  seq,
  at: seq * 1_000,
  kind: 'tool',
  label,
  subAgent: false,
  toolId: `toolu_${seq}`,
});

describe('mergeSteps', () => {
  it('adds a page of newer steps after the ones the phone has', () => {
    expect(mergeSteps([step(1), step(2)], [step(3), step(4)]).map(({ seq }) => seq)).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it('keeps one step per seq when pages overlap, and the first copy of it', () => {
    const merged = mergeSteps([step(1), step(2, 'Run npm test')], [step(2, 'other'), step(3)]);
    expect(merged.map(({ seq, label }) => [seq, label])).toEqual([
      [1, 'Read file1.ts'],
      [2, 'Run npm test'],
      [3, 'Read file3.ts'],
    ]);
  });

  it('puts a page that lands late in seq order', () => {
    expect(mergeSteps([step(4), step(5)], [step(2), step(3)]).map(({ seq }) => seq)).toEqual([
      2, 3, 4, 5,
    ]);
  });

  it('keeps the same list when a page brings nothing new, so nothing renders again', () => {
    const have = [step(1), step(2)];
    expect(mergeSteps(have, [])).toBe(have);
    expect(mergeSteps(have, [step(2)])).toBe(have);
  });

  it('keeps the newest steps the tracker keeps, so the oldest go as new ones come', () => {
    const have = Array.from({ length: RUN_STEPS_KEPT }, (_, index) => step(index + 1));
    const merged = mergeSteps(have, [step(RUN_STEPS_KEPT + 1), step(RUN_STEPS_KEPT + 2)]);
    expect(merged).toHaveLength(RUN_STEPS_KEPT);
    expect(merged[0]?.seq).toBe(3);
    expect(lastSeq(merged)).toBe(RUN_STEPS_KEPT + 2);
  });

  it('starts from the first page the run has, which may begin past steps the tracker let go', () => {
    expect(mergeSteps([], [step(101), step(102)]).map(({ seq }) => seq)).toEqual([101, 102]);
  });
});

describe('lastSeq', () => {
  it('is the seq to read after: the last step the phone has, or 0 for none', () => {
    expect(lastSeq([])).toBe(0);
    expect(lastSeq([step(7), step(9)])).toBe(9);
  });
});
