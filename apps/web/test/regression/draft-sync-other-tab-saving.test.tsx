import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { listItem, makeTicketDetail, STATUS } from '../../src/api/test/fixtures';
import { setupApi } from '../../src/api/test/render';
import { ToastProvider } from '../../src/components';
import { useTicketDrafts } from '../../src/features/ticket/drafts/useTicketDrafts';
import { keepDraft, rebaseDraft, storedDraft } from '../../src/lib/storedDrafts';

function Drafts() {
  useTicketDrafts(true);
  return null;
}

const ID = 'description:MOB-1';
const keep = (text: string) =>
  keepDraft(ID, { ticketKey: 'MOB-1', field: 'description', text }, 'Fix login');

// Tab A, with MOB-1 open: the same modules with memory of their own, as in another tab.
async function otherTab() {
  vi.resetModules();
  return import('../../src/features/ticket/fields/fieldSaves');
}

// This tab has MOB-1 closed, and MOB-2's description typed offline, which its run saves after
// MOB-1's turn.
function syncInThisTab(trackerHas: string) {
  keepDraft('description:MOB-2', { ticketKey: 'MOB-2', field: 'description', text: 'B' }, '');
  const tickets = {
    'MOB-1': makeTicketDetail(listItem(1, STATUS.todo, 0, { description: trackerHas })),
    'MOB-2': makeTicketDetail(listItem(2, STATUS.todo, 0)),
  };
  const api = setupApi({
    getTicket: vi.fn((key: keyof typeof tickets) => Promise.resolve(tickets[key])),
    updateTicket: vi.fn().mockResolvedValue(tickets['MOB-2'].ticket),
  });
  render(
    <api.wrapper>
      <ToastProvider>
        <Drafts />
      </ToastProvider>
    </api.wrapper>,
  );
  return api.client;
}

const runDone = () => waitFor(() => expect(storedDraft('description:MOB-2')).toBeUndefined());

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Reviewer 37 (PT-4): tab A typed " now" and " please" with slow saves, then undid " please".
// The tracker already had the first save's text when tab B's run read the ticket, which looked
// like the kept text was saved, so tab B dropped it while two saves were still on their way.
it('leaves kept text alone while another tab still has saves of it on their way', async () => {
  keep('Fix login now');
  const tabA = await otherTab();
  tabA.startSave(ID, 'Fix login now');
  tabA.startSave(ID, 'Fix login now please');
  const last = tabA.startSave(ID, 'Fix login now');

  const client = syncInThisTab('Fix login now');
  await runDone();
  expect(storedDraft(ID)?.text).toBe('Fix login now');
  expect(client.updateTicket).not.toHaveBeenCalledWith('MOB-1', expect.anything());
  expect(screen.queryByText(/isn't saved/)).not.toBeInTheDocument();
  tabA.finishSave(ID, last, false);
});

// The first save landed and moved the kept text's base; the second was still on its way, so
// tab B took the kept text for its own to save and sent it again.
it('does not send kept text another tab is still saving', async () => {
  keep('Fix login now please');
  rebaseDraft(ID, 'Fix login now');
  const tabA = await otherTab();
  const second = tabA.startSave(ID, 'Fix login now please');

  const client = syncInThisTab('Fix login now');
  await runDone();
  expect(client.updateTicket).not.toHaveBeenCalledWith('MOB-1', expect.anything());
  expect(storedDraft(ID)?.text).toBe('Fix login now please');
  tabA.finishSave(ID, second, true);
});
