import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { listItem, makeTicketDetail, STATUS } from '../../src/api/test/fixtures';
import { SAVE_MARKS_STORAGE_KEY } from '../../src/features/ticket/fields/saveMarks';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { DRAFTS_STORAGE_KEY } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

const ID = 'assignee:MOB-1';
const NOTE = "Assignee isn't saved yet.";
const STALE = new ApiError(409, 'stale', 'The ticket changed since this edit was typed.');

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

function heard(...keys: string[]) {
  keys.forEach((key) =>
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key }));
    }),
  );
}

// The tracker refuses this tab's first save, typed over A's name before A's save reached it, and
// reads hang until A's save has landed.
function trackerBehindTabA() {
  let landed = false;
  let detail = makeTicketDetail(listItem(1, STATUS.todo, 0, { assignee: 'Dara' }));
  const client = {
    getTicket: vi.fn(() => (landed ? Promise.resolve(detail) : new Promise<never>(() => {}))),
    updateTicket: vi
      .fn()
      .mockRejectedValueOnce(STALE)
      .mockImplementation((_key: string, input: { assignee: string }) => {
        detail = { ...detail, ticket: { ...detail.ticket, ...input } };
        return Promise.resolve(detail.ticket);
      }),
  };
  const rendered = renderTicket({ client });
  cleanups.push(rendered.restorePhone);
  return { client, land: () => (landed = true) };
}

// Lead (PT-90 E2E, about 1 run in 16): tab B cleared the name tab A was still sending, and the
// tracker refused B's save until A's landed. A's answer, worked out from a copy of the drafts store
// that hadn't heard of B's clear yet, removed the kept text. B took that for "saved elsewhere": it
// dropped its note, never sent the clear again, and the tracker kept 'Dara'.
it('keeps a refused edit with its note and saves it once the other tab lands, though the kept text went', async () => {
  const user = userEvent.setup();
  const tracker = trackerBehindTabA();
  const tabA = await otherTab();
  tabA.drafts.keepDraft(ID, { ticketKey: 'MOB-1', field: 'assignee', text: 'Dara' }, '');
  const save = tabA.saves.startSave(ID, 'Dara');
  heard(DRAFTS_STORAGE_KEY, SAVE_MARKS_STORAGE_KEY);
  const assignee = screen.getByLabelText('Assignee');
  expect(assignee).toHaveValue('Dara');

  await user.clear(assignee);
  await user.click(screen.getByLabelText('Title'));
  await waitFor(() => expect(tracker.client.updateTicket).toHaveBeenCalledTimes(1));
  expect(await screen.findByText(NOTE)).toBeInTheDocument();

  tracker.land();
  tabA.saves.finishSave(ID, save, true);
  localStorage.removeItem(DRAFTS_STORAGE_KEY);
  heard(DRAFTS_STORAGE_KEY, SAVE_MARKS_STORAGE_KEY);
  expect(assignee).toHaveValue('');

  await waitFor(() =>
    expect(tracker.client.updateTicket).toHaveBeenLastCalledWith(
      'MOB-1',
      { assignee: '' },
      { assignee: 'Dara' },
    ),
  );
  await waitFor(() => expect(screen.queryByText(NOTE)).not.toBeInTheDocument());
  expect(assignee).toHaveValue('');
});
