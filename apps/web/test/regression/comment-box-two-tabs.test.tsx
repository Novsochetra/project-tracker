import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it } from 'vitest';
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
});

function openTicket() {
  const rendered = renderTicket();
  cleanups.push(rendered.restorePhone);
  return rendered;
}

// Another tab writes the drafts store; this tab hears of it the way browsers tell other tabs.
function anotherTabKeeps(text: string | null) {
  act(() => {
    if (text === null) localStorage.removeItem(DRAFTS_STORAGE_KEY);
    else {
      const draft = { ticketKey: 'MOB-1', field: 'comment', base: '', text };
      localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify({ [ID]: draft }));
    }
    window.dispatchEvent(new StorageEvent('storage', { key: DRAFTS_STORAGE_KEY }));
  });
}

// Reviewer 48 (PT-46): tab A typed a comment, tab B typed one in the same ticket's box, and A
// reloaded: A showed B's comment and A's was gone. Each box showed only its own text, and the
// store kept the one typed last.
it('shows the comment another tab types in the same box, so this tab types on top of it', async () => {
  const user = userEvent.setup();
  const first = openTicket();
  const box = screen.getByLabelText('Comment');
  anotherTabKeeps('From tab A');
  expect(box).toHaveValue('From tab A');

  await user.type(box, ', and from tab B');
  expect(storedDraft(ID)?.text).toBe('From tab A, and from tab B');

  first.unmount();
  openTicket();
  expect(screen.getByLabelText('Comment')).toHaveValue('From tab A, and from tab B');
});

it('empties once another tab sends or empties the comment it shows', async () => {
  const user = userEvent.setup();
  openTicket();
  const box = screen.getByLabelText('Comment');
  anotherTabKeeps('From tab A');
  anotherTabKeeps(null);
  expect(box).toHaveValue('');

  // Spaces alone are not kept, and this tab still shows them as typed.
  await user.type(box, '  ');
  expect(box).toHaveValue('  ');
  await user.type(box, 'Hi');
  expect(box).toHaveValue('  Hi');
  expect(storedDraft(ID)?.text).toBe('  Hi');
});
