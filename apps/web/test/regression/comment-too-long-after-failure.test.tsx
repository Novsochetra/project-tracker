import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { keepDraft } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

// Reviewer 77 (PT-90): a failed comment came back before text typed meanwhile, and together they
// went past the 20,000-character limit the box enforces only for typing. Sending showed zod's raw
// "Too big: expected string to have <=20000 characters".
it('says a comment is too long before sending it', async () => {
  const user = userEvent.setup();
  const text = `${'x'.repeat(15_000)}\n${'y'.repeat(6_000)}`;
  keepDraft('comment:MOB-1', { ticketKey: 'MOB-1', field: 'comment', text }, '');
  const addComment = vi.fn();
  const rendered = renderTicket({ client: { addComment } });
  cleanups.push(rendered.restorePhone);
  expect(screen.getByLabelText('Comment')).toHaveValue(text);

  await user.click(screen.getByRole('button', { name: 'Comment' }));
  expect(
    await screen.findByText(
      'A comment can be up to 20,000 characters. This one has 21,001: shorten it to send it.',
    ),
  ).toBeInTheDocument();
  expect(addComment).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Comment')).toHaveValue(text);
});
