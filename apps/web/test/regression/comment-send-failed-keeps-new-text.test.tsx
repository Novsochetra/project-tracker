import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { deferred } from '../../src/api/test/deferred';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { keptComment } from '../../src/features/ticket/activity/sentComments';
import { DRAFTS_STORAGE_KEY } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

const ID = 'comment:MOB-1';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

function sendFailsLater() {
  const sending = deferred<never>();
  const addComment = vi.fn().mockReturnValue(sending.promise);
  const rendered = renderTicket({ client: { addComment } });
  cleanups.push(rendered.restorePhone);
  const fail = () =>
    act(async () => {
      sending.reject(new TypeError('Failed to fetch'));
      await sending.promise.catch(() => undefined);
    });
  return { addComment, fail };
}

// Reviewer 61 (PT-76): a comment whose send failed came back only into an empty box, so anything
// typed while it was on its way (here, or now in another tab) left the failed comment lost.
it('brings a failed comment back before the text typed while it was sent', async () => {
  const user = userEvent.setup();
  const { addComment, fail } = sendFailsLater();
  const box = screen.getByLabelText('Comment');
  await user.type(box, 'Looks good');
  await user.click(screen.getByRole('button', { name: 'Comment' }));
  expect(addComment).toHaveBeenCalled();
  await user.type(box, 'Also check the logout');

  await fail();
  await waitFor(() => expect(box).toHaveValue('Looks good\nAlso check the logout'));
  expect(keptComment('MOB-1')).toBe('Looks good\nAlso check the logout');
});

it('brings it back when the text meanwhile came from another tab', async () => {
  const user = userEvent.setup();
  const { fail } = sendFailsLater();
  const box = screen.getByLabelText('Comment');
  await user.type(box, 'Looks good');
  await user.click(screen.getByRole('button', { name: 'Comment' }));
  act(() => {
    const draft = { ticketKey: 'MOB-1', field: 'comment', base: '', text: 'From tab B' };
    localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify({ [ID]: draft }));
    window.dispatchEvent(new StorageEvent('storage', { key: DRAFTS_STORAGE_KEY }));
  });
  expect(box).toHaveValue('From tab B');

  await fail();
  await waitFor(() => expect(box).toHaveValue('Looks good\nFrom tab B'));
});
