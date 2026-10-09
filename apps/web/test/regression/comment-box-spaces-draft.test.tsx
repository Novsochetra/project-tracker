import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { DRAFTS_STORAGE_KEY, storedDraft } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

const ID = 'comment:MOB-1';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
  vi.restoreAllMocks();
});

// Reviewer 61 (PT-76): a kept comment of spaces only, such as hand-edited storage, crashed the
// ticket screen on every load: the comment box set its text during render again and again.
it('opens a ticket whose kept comment is only spaces, with an empty box', async () => {
  const user = userEvent.setup();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const draft = { ticketKey: 'MOB-1', field: 'comment', base: '', text: '   ' };
  localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify({ [ID]: draft }));
  const rendered = renderTicket();
  cleanups.push(rendered.restorePhone);

  const box = screen.getByLabelText('Comment');
  expect(box).toHaveValue('');
  await user.type(box, 'Hi');
  expect(storedDraft(ID)?.text).toBe('Hi');
});
