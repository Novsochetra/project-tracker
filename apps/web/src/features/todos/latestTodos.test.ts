import type { RunTodo } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { makeStep, makeSteps } from '../steps/testSteps';
import { latestTodos, withoutTodoSteps } from './latestTodos';
import { todoSummary } from './todoCopy';

const list: RunTodo[] = [
  { text: 'Read the code', status: 'completed' },
  { text: 'Fix it', status: 'in_progress' },
  { text: 'Run the tests', status: 'pending' },
];

describe('latestTodos', () => {
  it("takes the latest call's list, since each call sends it whole", () => {
    const older = [{ text: 'Read the code', status: 'in_progress' as const }];
    const steps = [makeStep(1, { todos: older }), makeStep(2), makeStep(3, { todos: list })];
    expect(latestTodos(steps)).toEqual(list);
  });

  it('shows no list for a run without one, or when Claude emptied it last', () => {
    expect(latestTodos(makeSteps(3))).toBeNull();
    expect(latestTodos([makeStep(1, { todos: list }), makeStep(2, { todos: [] })])).toBeNull();
    expect(latestTodos([])).toBeNull();
  });

  it('leaves out every call that wrote a list, an earlier one read back empty too', () => {
    const steps = [makeStep(1, { todos: [] }), makeStep(2), makeStep(3, { todos: list })];
    expect(withoutTodoSteps(steps).map(({ seq }) => seq)).toEqual([2]);
  });
});

describe('todoSummary', () => {
  it('says how many items are done', () => {
    expect(todoSummary(list)).toBe('To-do list, 1 of 3 done');
  });
});
