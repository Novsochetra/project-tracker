import type { RunTodo, RunTodoStatus } from '@tracker/shared';
import clsx from 'clsx';
import { Circle, CircleCheck, CircleDot, type LucideIcon } from 'lucide-react';
import { Icon } from '../../components';
import { TODO_LIST_LABEL, TODO_STATUS_TEXT } from './todoCopy';
import styles from './TodoList.module.css';

const ICONS: Readonly<Record<RunTodoStatus, LucideIcon>> = {
  completed: CircleCheck,
  in_progress: CircleDot,
  pending: Circle,
};

export interface TodoListProps {
  todos: RunTodo[];
  id?: string | undefined;
}

export function TodoList({ todos, id }: TodoListProps) {
  return (
    <ul id={id} className={styles.list} aria-label={TODO_LIST_LABEL}>
      {todos.map(({ text, status }, index) => (
        // The list is rewritten whole on every call, so its place is all an item has.
        <li key={index} className={clsx(styles.todo, styles[status])}>
          <Icon icon={ICONS[status]} size={14} className={styles.icon} />
          <span className={styles.text}>{text}</span>
          <span className="visually-hidden">{`, ${TODO_STATUS_TEXT[status]}`}</span>
        </li>
      ))}
    </ul>
  );
}
