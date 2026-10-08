import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { comment, makeTicketDetail } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { skipAnimations } from '../../src/overlays/testing';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

// Safari doesn't focus a tapped button, so the comment box still had focus when the action
// sheet opened; closing the sheet handed focus back to it, away from the comment editor.
it('keeps focus in the comment editor opened from the phone action sheet', async () => {
  const { restorePhone } = renderTicket({
    phone: true,
    detail: makeTicketDetail(undefined, { activity: [comment('c1', 'First thought')] }),
  });
  cleanups.push(restorePhone);
  screen.getByLabelText('Comment').focus();
  fireEvent.click(screen.getByRole('button', { name: 'Comment options' }));
  const sheet = screen.getByRole('dialog', { name: 'Comment options' });
  fireEvent.click(within(sheet).getByRole('button', { name: 'Edit comment' }));
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(screen.getByLabelText('Edit comment')).toHaveFocus();
});
