import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { listItem, makeTicketDetail, STATUS } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { hasDrafts } from '../../src/lib/drafts';
import { skipAnimations } from '../../src/overlays/testing';
import { slowReads, type FreshReads } from './slowReads';

const BEFORE = makeTicketDetail(listItem(1, STATUS.todo, 0, { description: 'Original desc' }));
const MINE = 'Original desc + mine';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

function open(client: ReturnType<ReturnType<typeof slowReads>['page']>, seed: boolean) {
  const rendered = renderTicket({ detail: BEFORE, client, seed });
  cleanups.push(rendered.restorePhone);
  return rendered;
}

// Saves the description; the fresh read after the save is still on its way when another page
// opens the ticket. That page has a session of its own: a new tab, or a home-screen app that iOS
// stopped and started again.
async function saveThenOpenElsewhere(after: FreshReads) {
  const user = userEvent.setup();
  const slow = slowReads(BEFORE);
  const before = open(slow.page('hold'), true);
  await user.type(screen.getByLabelText('Description'), ' + mine');
  await user.click(screen.getByLabelText('Title'));
  await waitFor(() => expect(slow.tracker().ticket.description).toBe(MINE));
  await waitFor(() => expect(hasDrafts()).toBe(false));
  sessionStorage.clear();
  before.unmount();
  open(slow.page(after), false);
}

// Reviewer 45 (PT-57): the tickets still waiting for a fresh read were kept in sessionStorage,
// written as the page went. A new tab opened in the seconds after a save, or the app relaunched
// in a new session, read the ticket as usual, and on a slow network the service worker answered
// with its copy from before the save.
it('shows the saved text in a page with a session of its own', async () => {
  await saveThenOpenElsewhere('answer');
  expect(await screen.findByLabelText('Description')).toHaveValue(MINE);
});

it('still shows the saved copy there when the tracker cannot be reached', async () => {
  await saveThenOpenElsewhere('fail');
  expect(await screen.findByLabelText('Description')).toHaveValue('Original desc');
});
