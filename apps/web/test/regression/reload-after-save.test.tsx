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

// Saves the description, then reloads before the fresh read after the save has landed. The
// browser says the page is going, and the page's memory goes with it, with that read.
async function saveThenReload(after: FreshReads) {
  const user = userEvent.setup();
  const slow = slowReads(BEFORE);
  const before = open(slow.page('hold'), true);
  await user.type(screen.getByLabelText('Description'), ' + mine');
  await user.click(screen.getByLabelText('Title'));
  await waitFor(() => expect(slow.tracker().ticket.description).toBe(MINE));
  await waitFor(() => expect(hasDrafts()).toBe(false));
  window.dispatchEvent(new Event('pagehide'));
  before.unmount();
  open(slow.page(after), false);
}

// Seen on a production build with ticket reads delayed 6 s, in Chromium and WebKit: a reload in
// the first seconds after a save (also the app's own reload into a new build, which waits only
// for the save) read the ticket as usual, and the service worker answered with its copy from
// before the save. The field showed the old text and kept it, and typing over it would have
// saved over the new text.
it('shows the saved text after a reload while the read after the save is still on its way', async () => {
  await saveThenReload('answer');
  expect(await screen.findByLabelText('Description')).toHaveValue(MINE);
});

it('still shows the saved copy after a reload when the tracker cannot be reached', async () => {
  await saveThenReload('fail');
  expect(await screen.findByLabelText('Description')).toHaveValue('Original desc');
});
