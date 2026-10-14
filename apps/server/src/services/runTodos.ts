import type { RunStepInput, RunTodo } from '@tracker/shared';

// Stored as the helper sent it, checked by addRunStepsInput, so it reads back as written.
export const todosOfColumn = (todos: string | null): RunTodo[] | undefined =>
  todos === null ? undefined : (JSON.parse(todos) as RunTodo[]);

export const todosColumn = (step: Pick<RunStepInput, 'todos'>): string | null =>
  step.todos ? JSON.stringify(step.todos) : null;
