import { RUN_TODO_STATUSES, RUN_TODOS_MAX, type RunTodo } from '../../domain/runStep';
import { isJson, type Json } from '../json';
import { stepLabel } from './label';

const statusOf = (value: unknown): RunTodo['status'] =>
  RUN_TODO_STATUSES.find((status) => status === value) ?? 'pending';

function todoOf(item: unknown): RunTodo[] {
  if (!isJson(item) || typeof item.content !== 'string') return [];
  const text = stepLabel(item.content);
  return text ? [{ text, status: statusOf(item.status) }] : [];
}

// TodoWrite sends the whole list each time; only each item's words and status leave the computer,
// and only so many items are read, since each one is masked in stdout's listener.
export function todosOf(input: Json): RunTodo[] {
  const items: unknown[] = Array.isArray(input.todos) ? input.todos : [];
  return items.slice(0, RUN_TODOS_MAX).flatMap(todoOf);
}
