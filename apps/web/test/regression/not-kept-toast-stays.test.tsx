import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NETWORK_ERROR_MESSAGE } from '../../src/api';
import { makeTicketDetail } from '../../src/api/test/fixtures';
import {
  fakeTicketServer,
  goOffline,
  restoreOnLine,
} from '../../src/features/ticket/test/fakeTicketServer';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { skipAnimations } from '../../src/overlays/testing';

const NOT_KEPT = "Unsaved text can't be kept on this device, so it's lost if this page closes.";

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations(), restoreOnLine];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
  vi.restoreAllMocks();
});

// Storage that is full refuses any write that would make it hold more than it does now.
function fillStorage() {
  const setItem = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
    this: Storage,
    key: string,
    value: string,
  ) {
    if (value.length > (this.getItem(key)?.length ?? 0)) {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    }
    setItem.call(this, key, value);
  });
}

// Reviewer 48 (PT-46): with storage full and the tracker out of reach, the autosave 0.4 s after
// typing stopped failed, and its "Can't reach the tracker" toast replaced the one saying the text
// can't be kept. iOS doesn't ask before closing a page, so that toast is all the warning there is.
it('keeps the toast saying typed text can’t be kept when a save then fails', async () => {
  const user = userEvent.setup();
  const server = fakeTicketServer(makeTicketDetail());
  const rendered = renderTicket({ detail: server.detail, client: server.client });
  cleanups.push(rendered.restorePhone);
  goOffline(server);
  fillStorage();

  await user.type(screen.getByLabelText('Title'), ' fixed');
  expect(await screen.findByText(NOT_KEPT)).toBeInTheDocument();
  await waitFor(() => expect(server.client.updateTicket).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByText("Title isn't saved yet.")).toBeInTheDocument());
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

  expect(screen.getByText(NOT_KEPT)).toBeInTheDocument();
  expect(screen.queryByText(NETWORK_ERROR_MESSAGE)).not.toBeInTheDocument();
});
