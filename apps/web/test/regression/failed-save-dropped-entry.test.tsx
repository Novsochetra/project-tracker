import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { deferred } from '../../src/api/test/deferred';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import {
  actFromCopy,
  copyOfStorage,
  type StorageCopy,
} from '../../src/features/ticket/test/staleCopy';
import { DRAFTS_STORAGE_KEY, storedDraft } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

// Another tab, with memory of its own, lets the title's kept text go from a copy of storage that
// hadn't heard of this tab's last typing: its save of the text it shows landed.
async function anotherTabLetsGo(copy: StorageCopy) {
  vi.resetModules();
  const tab = await import('../../src/lib/storedDrafts');
  act(() => {
    actFromCopy(copy, () => tab.draftSaved('title:MOB-1', 'Ticket 1 from'));
    window.dispatchEvent(new StorageEvent('storage', { key: DRAFTS_STORAGE_KEY }));
  });
}

const FAILURES = [
  ['no answer', () => new TypeError('Failed to fetch')],
  ['a 500', () => new ApiError(500, 'internal', 'Server error')],
] as const;

// Reviewer 77 (PT-90): another tab dropped the kept title from a stale copy of the drafts store
// while this tab's save of it was on its way, and the save then failed. The field took the
// missing entry for "saved elsewhere" and went back to the old title with no note. Since PT-111
// a tab removes only the records it has read, so this tab's newer text stays.
it.each(FAILURES)(
  'keeps the title with its note when its entry went during a save that got %s',
  async (_name, failure) => {
    const user = userEvent.setup();
    const sending = deferred<never>();
    const updateTicket = vi.fn().mockReturnValueOnce(sending.promise);
    const rendered = renderTicket({ client: { updateTicket } });
    cleanups.push(rendered.restorePhone);
    const title = screen.getByLabelText('Title');
    await user.type(title, ' from');
    const copy = copyOfStorage();
    await user.type(title, ' B');
    await user.click(screen.getByLabelText('Description'));
    await waitFor(() => expect(updateTicket).toHaveBeenCalled());

    await anotherTabLetsGo(copy);
    await act(async () => {
      sending.reject(failure());
      await sending.promise.catch(() => undefined);
    });

    expect(await screen.findByText("Title isn't saved yet.")).toBeInTheDocument();
    expect(title).toHaveValue('Ticket 1 from B');
    await waitFor(() => expect(storedDraft('title:MOB-1')?.text).toBe('Ticket 1 from B'));
    expect(storedDraft('title:MOB-1')?.base).toBe('Ticket 1');
  },
);
