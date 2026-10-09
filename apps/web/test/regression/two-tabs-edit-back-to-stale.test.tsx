import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { makeTicketDetail } from '../../src/api/test/fixtures';
import { SAVE_MARKS_STORAGE_KEY } from '../../src/features/ticket/fields/saveMarks';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { DRAFTS_STORAGE_KEY, storedDraft } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

type Field = 'title' | 'assignee';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

// Tab A: the same modules with memory of their own, as in another tab.
async function otherTab() {
  vi.resetModules();
  return {
    drafts: await import('../../src/lib/storedDrafts'),
    saves: await import('../../src/features/ticket/fields/fieldSaves'),
  };
}

// This tab hears of tab A's writes the way browsers tell other tabs: one event per write.
function heard(...keys: string[]) {
  keys.forEach((key) =>
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key }));
    }),
  );
}

// Tab A sends `text` over `before`; this tab's reads are slower than the test, so its copy of the
// ticket keeps `before`.
async function anotherTabSends(field: Field, before: string, text: string) {
  const updateTicket = vi.fn().mockResolvedValue(makeTicketDetail().ticket);
  const rendered = renderTicket({ client: { updateTicket } });
  cleanups.push(rendered.restorePhone);
  const tabA = await otherTab();
  const id = `${field}:MOB-1`;
  tabA.drafts.keepDraft(id, { ticketKey: 'MOB-1', field, text }, before);
  const save = tabA.saves.startSave(id, text);
  heard(DRAFTS_STORAGE_KEY, SAVE_MARKS_STORAGE_KEY);
  const land = () => {
    tabA.saves.finishSave(id, save, true);
    heard(DRAFTS_STORAGE_KEY, SAVE_MARKS_STORAGE_KEY);
  };
  return { updateTicket, land };
}

async function anotherTabSaved(field: Field, before: string, text: string) {
  const { updateTicket, land } = await anotherTabSends(field, before, text);
  land();
  return updateTicket;
}

// Reviewer 61 (PT-76): in this tab's slow-read window after tab A's save landed, the field showed
// A's text, but an edit back to the older text its copy still had was taken for no change: the
// save step compared it with that copy, sent nothing and dropped the draft, and the field went
// back to A's text once its read landed.
it('saves an assignee cleared after another tab set it, while this tab still has the older copy', async () => {
  const user = userEvent.setup();
  const updateTicket = await anotherTabSaved('assignee', '', 'Dara');
  const assignee = screen.getByLabelText('Assignee');
  expect(assignee).toHaveValue('Dara');

  await user.clear(assignee);
  await user.click(screen.getByLabelText('Title'));
  await waitFor(() =>
    expect(updateTicket).toHaveBeenCalledWith('MOB-1', { assignee: '' }, { assignee: 'Dara' }),
  );
});

it('saves a title put back to the older text after another tab saved a longer one', async () => {
  const user = userEvent.setup();
  const updateTicket = await anotherTabSaved('title', 'Ticket 1', 'Ticket 1 from A');
  const title = screen.getByLabelText('Title');
  expect(title).toHaveValue('Ticket 1 from A');

  await user.type(title, '{Backspace}'.repeat(' from A'.length));
  await user.click(screen.getByLabelText('Description'));
  await waitFor(() =>
    expect(updateTicket).toHaveBeenCalledWith(
      'MOB-1',
      { title: 'Ticket 1' },
      { title: 'Ticket 1 from A' },
    ),
  );
  expect(title).toHaveValue('Ticket 1');
  expect(storedDraft('title:MOB-1')).toBeUndefined();
});

// The same before that save's answer reached tab A: the tracker may already have A's text.
it('saves an assignee cleared while another tab still sends the one it shows', async () => {
  const user = userEvent.setup();
  const { updateTicket, land } = await anotherTabSends('assignee', '', 'Dara');
  const assignee = screen.getByLabelText('Assignee');
  expect(assignee).toHaveValue('Dara');

  await user.clear(assignee);
  await user.click(screen.getByLabelText('Title'));
  // Typed over A's name, which the tracker may have: were it named as typed over the empty
  // assignee, this save would change nothing, and A's save landing after it would bring 'Dara'
  // back. The tracker refuses it until A's save lands; the field then checks and saves again.
  await waitFor(() =>
    expect(updateTicket).toHaveBeenCalledWith('MOB-1', { assignee: '' }, { assignee: 'Dara' }),
  );
  land();
});

// Seen in Chromium: the assignee was cleared while tab A's save was on its way, that save landed,
// and only then was the field left. The cache still had no assignee, so the save step took the
// cleared field for no change, though the kept text's base said the tracker has 'Dara'.
it('saves an assignee cleared during another tab’s save and left after it landed', async () => {
  const user = userEvent.setup();
  const { updateTicket, land } = await anotherTabSends('assignee', '', 'Dara');
  const assignee = screen.getByLabelText('Assignee');
  await user.clear(assignee);
  land();
  await user.click(screen.getByLabelText('Title'));
  await waitFor(() =>
    expect(updateTicket).toHaveBeenCalledWith('MOB-1', { assignee: '' }, { assignee: 'Dara' }),
  );
});
