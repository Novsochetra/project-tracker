import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RunTodo } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { AnswerTodos } from './AnswerTodos';
import { TODO_LIST_LABEL } from './todoCopy';
import { TodoList } from './TodoList';

const todos: RunTodo[] = [
  { text: 'Read the code', status: 'completed' },
  { text: 'Fix the crash', status: 'in_progress' },
  { text: 'Run the tests', status: 'pending' },
];

const items = () =>
  within(screen.getByRole('list', { name: TODO_LIST_LABEL })).getAllByRole('listitem');

describe('TodoList', () => {
  it('ticks what is done, marks the current item and says each one for screen readers', () => {
    render(<TodoList todos={todos} />);
    expect(items().map((item) => item.textContent)).toEqual([
      'Read the code, done',
      'Fix the crash, doing now',
      'Run the tests, to do',
    ]);
    const [done, current, next] = items();
    expect(done).toHaveClass('completed');
    expect(current).toHaveClass('in_progress');
    expect(next).toHaveClass('pending');
  });
});

describe('AnswerTodos', () => {
  it('keeps the last list folded under its count until tapped', async () => {
    const user = userEvent.setup();
    render(<AnswerTodos todos={todos} />);
    const toggle = screen.getByRole('button', { name: 'To-do list, 1 of 3 done' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-controls', screen.getByRole('list').id);
    expect(items()).toHaveLength(3);
  });
});
