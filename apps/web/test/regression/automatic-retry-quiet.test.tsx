import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi, type Mock } from 'vitest';
import { NETWORK_ERROR_MESSAGE } from '../../src/api';
import { comment, makeTicketDetail } from '../../src/api/test/fixtures';
import { fakeTicketServer } from '../../src/features/ticket/test/fakeTicketServer';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { skipAnimations } from '../../src/overlays/testing';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

// Counts the toasts that appear with this text; each toast is a new element.
function countToasts(text: string): () => number {
  let count = 0;
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node.textContent?.includes(text)) count += 1;
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  cleanups.push(() => observer.disconnect());
  return () => count;
}

// The tracker answers reads but every write fails, as on a connection that drops uploads.
function openWithWritesFailing() {
  const server = fakeTicketServer(
    makeTicketDetail(undefined, { activity: [comment('c1', 'First thought')] }),
  );
  const refuse = () => vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
  const writes = { updateTicket: refuse(), updateComment: refuse() };
  const rendered = renderTicket({ detail: server.detail, client: { ...server.client, ...writes } });
  cleanups.push(rendered.restorePhone);
  return writes;
}

async function nextAttempt(...writes: Mock[]) {
  const before = writes.map((write) => write.mock.calls.length);
  act(() => {
    window.dispatchEvent(new Event('online'));
  });
  await waitFor(() =>
    writes.forEach((write, index) =>
      expect(write.mock.calls.length).toBeGreaterThan(before[index] ?? 0),
    ),
  );
}

// With the ticket open and writes failing, each automatic retry (one every 10 s once the
// tracker answered again) showed "Can't reach the tracker" once more.
it('says once that a save failed, not again on every automatic retry', async () => {
  const user = userEvent.setup();
  const toasts = countToasts(NETWORK_ERROR_MESSAGE);
  const { updateTicket, updateComment } = openWithWritesFailing();
  await user.type(screen.getByLabelText('Description'), 'Steps');
  await user.tab();
  expect(await screen.findByText("Description isn't saved yet.")).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Comment options' }));
  await user.click(screen.getByRole('button', { name: 'Edit comment' }));
  await user.type(screen.getByLabelText('Edit comment'), ' and a second');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText("Your edit isn't saved yet.")).toBeInTheDocument();
  const shown = toasts();
  expect(shown).toBe(2);

  await nextAttempt(updateTicket, updateComment);
  await nextAttempt(updateTicket, updateComment);
  await nextAttempt(updateTicket, updateComment);
  expect(toasts()).toBe(shown);
  expect(screen.getByText("Description isn't saved yet.")).toBeInTheDocument();
  expect(screen.getByText("Your edit isn't saved yet.")).toBeInTheDocument();
});
