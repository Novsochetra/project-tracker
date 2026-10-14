import type { RunTodo } from '@tracker/shared';
import { useId, useState } from 'react';
import { ShowMoreButton } from '../../components';
import { todoSummary } from './todoCopy';
import { TodoList } from './TodoList';
import styles from './AnswerTodos.module.css';

// Claude's last list stays with its answer, folded like the steps above it.
export function AnswerTodos({ todos }: { todos: RunTodo[] }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const label = todoSummary(todos);
  return (
    <div className={styles.answerTodos}>
      <ShowMoreButton
        expanded={open}
        controls={open ? id : undefined}
        moreLabel={label}
        lessLabel={label}
        className={styles.toggle}
        onClick={() => setOpen(!open)}
      />
      {open && <TodoList id={id} todos={todos} />}
    </div>
  );
}
