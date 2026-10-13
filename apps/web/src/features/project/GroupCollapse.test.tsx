import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listItem, makeBoard, STATUS } from '../../api/test/fixtures';
import { mockPhone, skipAnimations } from '../../overlays/testing';
import { resetListView } from './listViewStore';
import { renderProject } from './test/renderProject';

const rowButtons = (region: HTMLElement) =>
  within(region).getAllByRole('button', { name: /^MOB-\d+/ });

const scroller = () =>
  screen.getByRole('region', { name: 'To do' }).closest<HTMLElement>('[data-stack-scroller]')!;

async function renderExpandedTodo() {
  const user = userEvent.setup();
  const tickets = Array.from({ length: 12 }, (_, index) =>
    listItem(index + 1, STATUS.todo, index * 1000),
  );
  renderProject({ board: makeBoard(tickets) });
  const todo = await screen.findByRole('region', { name: 'To do' });
  await user.click(within(todo).getByRole('button', { name: 'Show 7 more' }));
  return { user, todo };
}

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(false)];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  resetListView('MOB');
});

describe('collapsing an expanded group (PT-180)', () => {
  it('offers Show less in the header only while the group is expanded', async () => {
    const { user, todo } = await renderExpandedTodo();
    expect(todo).toHaveAttribute('data-expanded');
    const less = within(todo).getByRole('button', { name: 'Show less of To do' });
    expect(less).toHaveAttribute('aria-expanded', 'true');

    await user.click(less);
    expect(rowButtons(todo)).toHaveLength(5);
    expect(todo).not.toHaveAttribute('data-expanded');
    expect(within(todo).queryByRole('button', { name: 'Show less of To do' })).toBeNull();
    expect(within(todo).getByRole('button', { name: 'Show 7 more' })).toBeInTheDocument();
  });

  it('scrolls back up to the group when it collapses above the view', async () => {
    const { user, todo } = await renderExpandedTodo();
    scroller().scrollTop = 900;
    // Once collapsed, the group's top lies 300px above the screen.
    todo.getBoundingClientRect = () => ({ top: -300 }) as DOMRect;
    await user.click(within(todo).getByRole('button', { name: 'Show less' }));
    expect(scroller().scrollTop).toBe(584);
  });

  it('keeps the scroll when the collapsed group is still in view', async () => {
    const { user, todo } = await renderExpandedTodo();
    scroller().scrollTop = 40;
    todo.getBoundingClientRect = () => ({ top: 120 }) as DOMRect;
    await user.click(within(todo).getByRole('button', { name: 'Show less of To do' }));
    expect(scroller().scrollTop).toBe(40);
  });
});
