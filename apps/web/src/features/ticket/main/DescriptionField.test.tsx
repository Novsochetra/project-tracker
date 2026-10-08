import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listItem, makeTicketDetail, STATUS } from '../../../api/test/fixtures';
import { skipAnimations } from '../../../overlays/testing';
import { renderTicket } from '../test/renderTicket';

const LONG = 'Steps to reproduce, what happened and what should happen instead. '.repeat(20);

// jsdom lays nothing out: the description is as tall as its text is long.
const heightOf = (element: HTMLElement) =>
  element.getAttribute('aria-label') === 'Description'
    ? ((element as HTMLTextAreaElement).value.length / 40) * 26
    : 0;

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  const spy = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return heightOf(this);
  });
  cleanups = [skipAnimations(), () => spy.mockRestore()];
});

afterEach(() => cleanups.forEach((undo) => undo()));

function setup(description: string, phone = true) {
  const detail = makeTicketDetail(listItem(1, STATUS.todo, 0, { description }));
  cleanups.push(renderTicket({ detail, phone }).restorePhone);
  return screen.getByLabelText('Description');
}

describe('a long description on a phone', () => {
  it('folds while it is not being edited, with Show more', () => {
    const field = setup(LONG);
    expect(field).toHaveClass('folded');
    expect(field.style.maxHeight).not.toBe('');
    const more = screen.getByRole('button', { name: 'Show more' });
    expect(more).toHaveAttribute('aria-controls', field.id);
  });

  it('opens with Show more and folds again with Show less', async () => {
    const user = userEvent.setup();
    const field = setup(LONG);
    await user.click(screen.getByRole('button', { name: 'Show more' }));
    expect(field).not.toHaveClass('folded');
    await user.click(screen.getByRole('button', { name: 'Show less' }));
    expect(field).toHaveClass('folded');
  });

  it('opens for good when tapped to edit, so the text stays put after the keyboard closes', async () => {
    const user = userEvent.setup();
    const field = setup(LONG);
    await user.click(field);
    expect(field).toHaveFocus();
    expect(field).not.toHaveClass('folded');
    await user.tab();
    expect(field).not.toHaveClass('folded');
    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument();
  });

  it('leaves a short description as it is', () => {
    const field = setup('Rotate twice.');
    expect(field).not.toHaveClass('folded');
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
  });
});

it('never folds on desktop', () => {
  const field = setup(LONG, false);
  expect(field).not.toHaveClass('folded');
  expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
});
