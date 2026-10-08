import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UpdateTicketInput } from '@tracker/shared';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { deferred } from '../../src/api/test/deferred';
import { listItem, makeTicketDetail, STATUS } from '../../src/api/test/fixtures';
import { AUTOSAVE_DELAY_MS } from '../../src/features/ticket/fields/useAutosave';
import { fakeTicketServer } from '../../src/features/ticket/test/fakeTicketServer';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { hasDrafts } from '../../src/lib/drafts';
import { storedDraft } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

const wait = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

// A slow connection that answers requests in the order they were sent, holding the first two
// saves until the test lets each one go.
function openOnSlowConnection() {
  const server = fakeTicketServer(
    makeTicketDetail(listItem(1, STATUS.todo, 0, { description: 'Fix login' })),
  );
  const gates = [deferred<void>(), deferred<void>()];
  let calls = 0;
  let line: Promise<unknown> = Promise.resolve();
  const updateTicket = vi.fn((key: string, input: UpdateTicketInput) => {
    const gate = gates[calls++]?.promise ?? Promise.resolve();
    const reply = line.then(() => gate).then(() => server.client.updateTicket(key, input));
    line = reply.catch(() => undefined);
    return reply;
  });
  const rendered = renderTicket({
    detail: server.detail,
    client: { ...server.client, updateTicket },
  });
  cleanups.push(rendered.restorePhone);
  const release = async (count: number) => {
    gates.slice(0, count).forEach((gate) => gate.resolve());
    await wait(100);
  };
  return { server, updateTicket, rendered, release };
}

async function typeAndUndo(updateTicket: ReturnType<typeof vi.fn>) {
  const user = userEvent.setup();
  const field = screen.getByLabelText('Description');
  await user.type(field, ' now');
  await waitFor(() => expect(updateTicket).toHaveBeenCalledTimes(1));
  await user.type(field, ' please');
  await waitFor(() => expect(updateTicket).toHaveBeenCalledTimes(2));
  await user.type(field, '{Backspace>7/}');
  return { user, field };
}

// Seen in Chromium and WebKit with saves taking 3 s: the field skipped any save whose text an
// earlier save still on its way carried, even when a newer save with other text went out after
// it. Deleting the words typed since the first save sent nothing, so the tracker kept them, and
// the first save landing dropped the kept text while the newer one could still overwrite it.
it('saves the text the field ends with when it is left for another field', async () => {
  const { server, updateTicket, release } = openOnSlowConnection();
  const { user, field } = await typeAndUndo(updateTicket);
  await user.click(screen.getByLabelText('Title'));
  await release(2);
  await waitFor(() => expect(server.detail.ticket.description).toBe('Fix login now'));
  expect(updateTicket).toHaveBeenCalledTimes(3);
  expect(field).toHaveValue('Fix login now');
  expect(hasDrafts()).toBe(false);
});

it('saves the text the field ends with while it stays focused', async () => {
  const { server, updateTicket, release } = openOnSlowConnection();
  const { field } = await typeAndUndo(updateTicket);
  await wait(AUTOSAVE_DELAY_MS + 50);
  await release(2);
  await waitFor(() => expect(server.detail.ticket.description).toBe('Fix login now'));
  expect(field).toHaveValue('Fix login now');
  expect(hasDrafts()).toBe(false);
});

it('saves the text the field ends with when the ticket is left, and keeps it until then', async () => {
  const { server, updateTicket, rendered, release } = openOnSlowConnection();
  await typeAndUndo(updateTicket);
  rendered.unmount();
  await waitFor(() => expect(updateTicket).toHaveBeenCalledTimes(3));
  await release(1);
  // The first save carried this text, but the newer one still on its way would overwrite it.
  expect(storedDraft('description:MOB-1')?.text).toBe('Fix login now');
  expect(hasDrafts()).toBe(true);
  await release(2);
  await waitFor(() => expect(server.detail.ticket.description).toBe('Fix login now'));
  expect(hasDrafts()).toBe(false);
});
