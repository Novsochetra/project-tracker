import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UpdateTicketInput } from '@tracker/shared';
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { deferred, type Deferred } from '../../src/api/test/deferred';
import { listItem, makeTicketDetail, STATUS } from '../../src/api/test/fixtures';
import { TicketScreen } from '../../src/features/ticket/TicketScreen';
import {
  fakeTicketServer,
  type FakeTicketServer,
} from '../../src/features/ticket/test/fakeTicketServer';
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

interface HeldSave {
  input: UpdateTicketInput;
  answer: Deferred<void>;
}

// A slow connection: a save reaches the tracker only when the test says so, and its answer comes
// back only when the test lets it. Chromium sent the second save only after the first one's
// answer, so the tracker could have the first save's text while the second was still to come.
function slowSaves(server: FakeTicketServer) {
  const saves: HeldSave[] = [];
  const updateTicket = vi.fn(async (_key: string, input: UpdateTicketInput) => {
    const save = { input, answer: deferred<void>() };
    saves.push(save);
    await save.answer.promise;
    return server.detail.ticket;
  });
  const settle = async (run: () => void) => {
    await act(async () => {
      run();
      await Promise.resolve();
    });
    await wait(50);
  };
  const reach = (index: number) => server.edit(saves[index]!.input);
  return {
    updateTicket,
    reach,
    answer: (index: number) => settle(() => saves[index]!.answer.resolve()),
    land: (index: number) =>
      settle(() => {
        reach(index);
        saves[index]!.answer.resolve();
      }),
    fail: (index: number) =>
      settle(() => saves[index]!.answer.reject(new TypeError('Failed to fetch'))),
  };
}

// Tapping Back and opening the ticket again, in one app.
function LeaveAndReopen() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen((value) => !value)}>
        {open ? 'Leave the ticket' : 'Open the ticket'}
      </button>
      {open && <TicketScreen projectKey="MOB" num={1} />}
    </>
  );
}

function openOnSlowConnection() {
  const server = fakeTicketServer(
    makeTicketDetail(listItem(1, STATUS.todo, 0, { description: 'Fix login' })),
  );
  const slow = slowSaves(server);
  const rendered = renderTicket({
    detail: server.detail,
    client: { ...server.client, updateTicket: slow.updateTicket },
    children: <LeaveAndReopen />,
  });
  cleanups.push(rendered.restorePhone);
  return { server, slow, user: userEvent.setup() };
}

const description = () => screen.getByLabelText('Description');
const kept = () => storedDraft('description:MOB-1')?.text;
const notes = () =>
  screen.queryAllByText(/changed elsewhere|isn't saved/).map((note) => note.textContent);

async function typeTwoSaves({ slow, user }: ReturnType<typeof openOnSlowConnection>) {
  await user.type(description(), ' now');
  await waitFor(() => expect(slow.updateTicket).toHaveBeenCalledTimes(1));
  slow.reach(0);
  await user.type(description(), ' please');
  await waitFor(() => expect(slow.updateTicket).toHaveBeenCalledTimes(2));
}

// Seen in Chromium and WebKit: the app-wide sync checked the kept text of a ticket just left
// while its saves were still on their way. The tracker had the first save's text, which looked
// like someone else's change, so a toast said the edit wasn't saved.
it('leaves the kept text of a ticket just left to its saves on their way', async () => {
  const opened = openOnSlowConnection();
  const { server, slow, user } = opened;
  await typeTwoSaves(opened);
  await user.click(screen.getByRole('button', { name: 'Leave the ticket' }));
  act(() => {
    window.dispatchEvent(new Event('online'));
  });
  await wait(100);
  expect(notes()).toEqual([]);
  expect(kept()).toBe('Fix login now please');

  await slow.answer(0);
  await slow.land(1);
  await waitFor(() => expect(hasDrafts()).toBe(false));
  expect(server.detail.ticket.description).toBe('Fix login now please');
  expect(notes()).toEqual([]);
  expect(slow.updateTicket).toHaveBeenCalledTimes(2);
});

// Seen in Chromium and WebKit: the field opened again knew nothing of the saves its earlier self
// still had on their way. It checked the kept text at once, took the first save's text for
// someone else's change and said "changed elsewhere", which stayed after both saves landed.
it('shows no note when the ticket is opened again while its saves are on their way', async () => {
  const opened = openOnSlowConnection();
  const { server, slow, user } = opened;
  await typeTwoSaves(opened);
  await user.click(screen.getByRole('button', { name: 'Leave the ticket' }));
  await user.click(screen.getByRole('button', { name: 'Open the ticket' }));
  await wait(100);
  expect(description()).toHaveValue('Fix login now please');
  expect(notes()).toEqual([]);
  expect(kept()).toBe('Fix login now please');

  await slow.answer(0);
  expect(kept()).toBe('Fix login now please');
  await slow.land(1);
  await waitFor(() => expect(hasDrafts()).toBe(false));
  expect(server.detail.ticket.description).toBe('Fix login now please');
  expect(description()).toHaveValue('Fix login now please');
  expect(notes()).toEqual([]);
  expect(slow.updateTicket).toHaveBeenCalledTimes(2);
});

// Seen in Chromium: after typing more and deleting it again, the field opened again found the
// first save's text on the tracker and dropped the kept text, with two saves still on their way.
// The last one then failed, and the tracker kept the deleted words with nothing left to retry.
it('keeps the text until the latest save lands, and says so when it fails', async () => {
  const opened = openOnSlowConnection();
  const { server, slow, user } = opened;
  await typeTwoSaves(opened);
  await user.type(description(), '{Backspace>7/}');
  await user.click(screen.getByRole('button', { name: 'Leave the ticket' }));
  await waitFor(() => expect(slow.updateTicket).toHaveBeenCalledTimes(3));
  await user.click(screen.getByRole('button', { name: 'Open the ticket' }));
  await wait(100);
  expect(description()).toHaveValue('Fix login now');
  expect(notes()).toEqual([]);
  expect(kept()).toBe('Fix login now');

  await slow.answer(0);
  await slow.land(1);
  await slow.fail(2);
  expect(await screen.findByText("Description isn't saved yet.")).toBeInTheDocument();
  expect(description()).toHaveValue('Fix login now');
  expect(kept()).toBe('Fix login now');
  expect(hasDrafts()).toBe(true);
  expect(server.detail.ticket.description).toBe('Fix login now please');

  await user.click(screen.getByRole('button', { name: 'Retry saving description' }));
  await waitFor(() => expect(slow.updateTicket).toHaveBeenCalledTimes(4));
  await slow.land(3);
  await waitFor(() => expect(hasDrafts()).toBe(false));
  expect(server.detail.ticket.description).toBe('Fix login now');
  expect(notes()).toEqual([]);
});
