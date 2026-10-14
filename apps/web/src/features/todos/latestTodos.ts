import type { RunStep, RunTodo } from '@tracker/shared';

type WithTodos = Pick<RunStep, 'todos'>;

// Each TodoWrite call sends the whole list, and the tracker keeps only the latest one: an earlier
// call's step reads back with an empty list, still marked as one.
export const isTodoStep = (step: WithTodos): boolean => step.todos !== undefined;

export function latestTodos(steps: readonly WithTodos[]): RunTodo[] | null {
  const todos = steps.findLast(isTodoStep)?.todos;
  return todos && todos.length > 0 ? todos : null;
}

export const withoutTodoSteps = <T extends WithTodos>(steps: readonly T[]): T[] =>
  steps.filter((step) => !isTodoStep(step));
