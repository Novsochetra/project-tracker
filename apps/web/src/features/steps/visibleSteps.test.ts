import { describe, expect, it } from 'vitest';
import { stepRows } from './stepRows';
import { makeStep, makeSteps } from './testSteps';
import { LIVE_STEPS_SHOWN, visibleSteps } from './visibleSteps';

const seqs = (rows: { seq: number }[]) => rows.map(({ seq }) => seq);

describe('visibleSteps', () => {
  it('shows every step of a short run with nothing earlier', () => {
    const visible = visibleSteps(stepRows(makeSteps(LIVE_STEPS_SHOWN)), false);
    expect(seqs(visible.shown)).toEqual([1, 2, 3, 4, 5]);
    expect(visible).toMatchObject({ earlier: 0, canExpand: false, notKept: 0 });
  });

  it('shows the newest steps and counts the earlier ones', () => {
    const visible = visibleSteps(stepRows(makeSteps(17)), false);
    expect(seqs(visible.shown)).toEqual([13, 14, 15, 16, 17]);
    expect(visible).toMatchObject({ earlier: 12, canExpand: true, notKept: 0 });
  });

  it('shows every step it has once expanded', () => {
    const visible = visibleSteps(stepRows(makeSteps(17)), true);
    expect(visible.shown).toHaveLength(17);
    expect(visible).toMatchObject({ earlier: 0, canExpand: true });
  });

  it('counts the steps the tracker let go among the earlier ones, and says so', () => {
    const rows = stepRows(makeSteps(500, 121));
    expect(visibleSteps(rows, false)).toMatchObject({ earlier: 615, notKept: 120 });
    expect(visibleSteps(rows, true)).toMatchObject({ earlier: 120, notKept: 120 });
  });

  it('takes another limit, and shows nothing for no steps', () => {
    expect(seqs(visibleSteps(stepRows(makeSteps(4)), false, { limit: 1 }).shown)).toEqual([4]);
    expect(visibleSteps([], false)).toEqual({
      shown: [],
      earlier: 0,
      canExpand: false,
      notKept: 0,
    });
  });

  it('leaves the to-do list calls out when the list shows, and out of what it counts', () => {
    const todos = [{ text: 'Fix it', status: 'pending' as const }];
    const steps = [makeStep(1, { todos: [] }), ...makeSteps(6, 2), makeStep(8, { todos })];
    const rows = stepRows(steps);
    const hidden = visibleSteps(rows, false, { hideTodos: true });
    expect(seqs(hidden.shown)).toEqual([3, 4, 5, 6, 7]);
    expect(hidden).toMatchObject({ earlier: 1, canExpand: true, notKept: 0 });
    expect(visibleSteps(rows, true, { hideTodos: true })).toMatchObject({ earlier: 0 });
    expect(seqs(visibleSteps(rows, false).shown)).toEqual([4, 5, 6, 7, 8]);
  });
});
