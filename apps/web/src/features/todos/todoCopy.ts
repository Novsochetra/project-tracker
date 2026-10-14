import type { RunTodo, RunTodoStatus } from '@tracker/shared';

export const TODO_LIST_LABEL = "Claude's to-do list";

export const TODO_STATUS_TEXT: Readonly<Record<RunTodoStatus, string>> = {
  completed: 'done',
  in_progress: 'doing now',
  pending: 'to do',
};

export function todoSummary(todos: readonly RunTodo[]): string {
  const done = todos.filter(({ status }) => status === 'completed').length;
  return `To-do list, ${done} of ${todos.length} done`;
}
