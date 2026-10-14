import { describe, expect, it } from 'vitest';
import { addRunStepsInput, runStepsQuery } from '../src/api/runSteps';
import { RUN_STEP_LABEL_MAX, RUN_STEP_TEXT_MAX, RUN_TODOS_MAX } from '../src/domain/runStep';

const RUNNER = '11111111-2222-4333-8444-555555555555';
const parse = (steps: unknown) => addRunStepsInput.safeParse({ runnerId: RUNNER, steps });

describe('addRunStepsInput', () => {
  it('trims labels and takes a step as from the main conversation unless it says otherwise', () => {
    expect(parse([{ kind: 'tool', label: ' Read a.ts ' }]).data?.steps).toEqual([
      { kind: 'tool', label: 'Read a.ts', subAgent: false, toolId: null },
    ]);
  });

  it('takes a refused call with the id of the call it refuses', () => {
    const denied = { kind: 'denied', label: 'Not allowed: Run ls', toolId: 'toolu_01' };
    expect(parse([denied]).data?.steps).toEqual([{ ...denied, subAgent: false }]);
    expect(parse([{ ...denied, toolId: 'x'.repeat(101) }]).success).toBe(false);
  });

  it('gives Claude’s words more room than a tool’s one line', () => {
    const line = 'x'.repeat(RUN_STEP_LABEL_MAX + 1);
    expect(parse([{ kind: 'tool', label: line }]).success).toBe(false);
    expect(parse([{ kind: 'agent', label: line }]).success).toBe(false);
    expect(parse([{ kind: 'text', label: line }]).success).toBe(true);
    expect(parse([{ kind: 'text', label: 'x'.repeat(RUN_STEP_TEXT_MAX + 1) }]).success).toBe(false);
  });

  it("takes a tool step's to-do list within its limits", () => {
    const item = { text: 'Fix the bug', status: 'in_progress' };
    const todo = (todos: unknown) =>
      parse([{ kind: 'tool', label: 'Update the to-do list', todos }]);
    expect(todo([item]).data?.steps[0]).toMatchObject({ todos: [item] });
    expect(todo(Array.from({ length: RUN_TODOS_MAX + 1 }, () => item)).success).toBe(false);
    expect(todo([{ ...item, status: 'done' }]).success).toBe(false);
    expect(todo([{ ...item, text: 'x'.repeat(RUN_STEP_LABEL_MAX + 1) }]).success).toBe(false);
  });

  it('refuses a step of another kind, an empty label and a helper id that is no UUID', () => {
    expect(parse([{ kind: 'output', label: 'npm test passed' }]).success).toBe(false);
    expect(parse([{ kind: 'tool', label: '   ' }]).success).toBe(false);
    const wrongRunner = { runnerId: 'mac', steps: [{ kind: 'tool', label: 'Read' }] };
    expect(addRunStepsInput.safeParse(wrongRunner).success).toBe(false);
  });
});

describe('runStepsQuery', () => {
  it('reads from the start by default and takes a whole number after', () => {
    expect(runStepsQuery.parse({})).toEqual({ after: 0 });
    expect(runStepsQuery.parse({ after: '12' })).toEqual({ after: 12 });
    expect(runStepsQuery.safeParse({ after: '1.5' }).success).toBe(false);
  });
});
