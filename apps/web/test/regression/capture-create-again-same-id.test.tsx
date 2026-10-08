import { ApiError } from '@tracker/client';
import type { CreateTicketInput, Ticket, UpdateTicketInput } from '@tracker/shared';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachment } from '../../src/api/test/fixtures';
import { createReachability } from '../../src/app/reachability';
import { useSheets } from '../../src/app/sheets/context';
import { SheetsProvider } from '../../src/app/sheets/SheetsProvider';
import { projectSummary, renderWithApp } from '../../src/app/test/harness';
import {
  FILES_NEED_CONNECTION,
  SAVED_ON_PHONE,
  textNotSaved,
} from '../../src/features/capture/captureForm';
import { QuickCapture } from '../../src/features/capture/QuickCapture';
import { fakeTracker } from '../../src/features/capture/test/fakeTracker';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

// The sheet made a new client id on every Create (PT-59). When a create reached the tracker but
// its answer was lost, the sheet stayed open ("Files need a connection…"), and Create again made a
// second ticket. A tab that crashed mid-create kept the text (PT-11) but not the id, so Create
// after reopening made a second ticket too.
//
// With the id kept, the answer to Create again is the first ticket, with the first text. Text
// typed or replaced in between was then dropped without a word (PT-59 review, repros A and B).

const PROJECTS = [projectSummary()];
const LOST_ANSWER = new TypeError('Failed to fetch');

type Answer = (ticket: Ticket) => Promise<Ticket>;

// The first create reaches the tracker, which makes the ticket; what the page hears is `first`.
function trackerWithFirstAnswer(first: Answer) {
  const tracker = fakeTracker();
  const createTicket = vi.fn((projectKey: string, input: CreateTicketInput) => {
    const ticket = tracker.create(projectKey, input);
    return createTicket.mock.calls.length === 1 ? first(ticket) : Promise.resolve(ticket);
  });
  const updateTicket = vi.fn((ticketKey: string, input: UpdateTicketInput) =>
    Promise.resolve(tracker.update(ticketKey, input)),
  );
  const clientIds = () => createTicket.mock.calls.map(([, input]) => input.clientId);
  return { tracker, createTicket, updateTicket, clientIds };
}

type Sent = Pick<ReturnType<typeof trackerWithFirstAnswer>, 'createTicket' | 'updateTicket'>;

function Opener() {
  const sheets = useSheets();
  return (
    <button type="button" onClick={() => sheets.open({ type: 'capture' })}>
      Capture
    </button>
  );
}

// Each call is a fresh page load: new API cache and sheet host, the same storage.
function loadApp({ createTicket, updateTicket }: Sent, { sync = false } = {}) {
  cleanup();
  renderWithApp(
    <SheetsProvider>
      <Opener />
      {sync && <QuickCapture reachability={createReachability()} />}
    </SheetsProvider>,
    {
      projects: PROJECTS,
      client: {
        listProjects: vi.fn().mockResolvedValue(PROJECTS),
        createTicket,
        updateTicket,
        uploadAttachment: vi.fn().mockResolvedValue(attachment('shot', { ticketId: null })),
        deleteAttachment: vi.fn(),
      },
    },
  );
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

type User = ReturnType<typeof userEvent.setup>;

const dialog = () => screen.getByRole('dialog', { name: 'New ticket' });
const title = () => within(dialog()).getByLabelText('Ticket title');
const create = (user: User) => user.click(within(dialog()).getByRole('button', { name: 'Create' }));
const openCapture = (user: User) => user.click(screen.getByRole('button', { name: 'Capture' }));
const sheetClosed = () =>
  waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

// Select all and type, as on a phone: the title is never empty in between.
const replaceTitle = (user: User, text: string) =>
  user.type(title(), text, {
    initialSelectionStart: 0,
    initialSelectionEnd: (title() as HTMLTextAreaElement).value.length,
  });

async function captureWithPhoto(user: User, text: string) {
  await openCapture(user);
  await user.type(title(), text);
  const photo = new File(['png'], 'shot.png', { type: 'image/png' });
  await user.upload(within(dialog()).getByLabelText('Add files to ticket'), photo);
  expect(await within(dialog()).findByRole('img', { name: 'Image 1' })).toBeInTheDocument();
}

let restore: Array<() => void> = [];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  restore = [skipAnimations(), mockPhone(false)];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  vi.useRealTimers();
  window.localStorage.clear();
});

describe('regression: Create again after a lost answer', () => {
  it('sends the same client id and shows the ticket the first create made', async () => {
    const { tracker, clientIds, ...sent } = trackerWithFirstAnswer(() =>
      Promise.reject(LOST_ANSWER),
    );
    const user = loadApp(sent);
    await captureWithPhoto(user, 'Photo of the bug');
    await create(user);
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(FILES_NEED_CONNECTION);

    await create(user);

    expect(await screen.findByText('MOB-1 created')).toBeInTheDocument();
    await sheetClosed();
    expect(tracker.titles()).toEqual(['Photo of the bug']);
    expect(clientIds()).toEqual([expect.any(String), clientIds()[0]]);
  });

  it('keeps the id when the files are removed before Create again', async () => {
    const { tracker, clientIds, ...sent } = trackerWithFirstAnswer(() =>
      Promise.reject(LOST_ANSWER),
    );
    const user = loadApp(sent);
    await captureWithPhoto(user, 'Photo of the bug');
    await create(user);
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(FILES_NEED_CONNECTION);
    await user.click(within(dialog()).getByRole('button', { name: 'Remove image 1' }));

    await create(user);

    expect(await screen.findByText('MOB-1 created')).toBeInTheDocument();
    expect(tracker.titles()).toEqual(['Photo of the bug']);
    expect(clientIds()).toEqual([expect.any(String), clientIds()[0]]);
  });

  it('gives the next capture a new id', async () => {
    const { tracker, clientIds, ...sent } = trackerWithFirstAnswer(() =>
      Promise.reject(LOST_ANSWER),
    );
    let user = loadApp(sent);
    await captureWithPhoto(user, 'Photo of the bug');
    await create(user);
    await within(dialog()).findByRole('alert');
    await create(user);
    await sheetClosed();

    user = loadApp(sent);
    await openCapture(user);
    expect(title()).toHaveValue('');
    await user.type(title(), 'Next idea{Enter}');

    expect(await screen.findByText('MOB-2 created')).toBeInTheDocument();
    expect(tracker.titles()).toEqual(['Photo of the bug', 'Next idea']);
    const [first, again, next] = clientIds();
    expect(again).toBe(first);
    expect(next).not.toBe(first);
  });
});

describe('regression: Create after the tab crashed mid-create', () => {
  it('sends the kept id again, so the capture is one ticket', async () => {
    const { tracker, clientIds, ...sent } = trackerWithFirstAnswer(
      () => new Promise<Ticket>(() => undefined),
    );
    let user = loadApp(sent);
    await openCapture(user);
    await user.type(title(), 'Idea before iOS stops the app{Enter}');
    expect(sent.createTicket).toHaveBeenCalledTimes(1);

    // The crash comes within the 8 s, before the capture waits on the phone; its timers die too.
    vi.clearAllTimers();
    user = loadApp(sent);
    await openCapture(user);
    expect(title()).toHaveValue('Idea before iOS stops the app');
    await create(user);

    expect(await screen.findByText('MOB-1 created')).toBeInTheDocument();
    await sheetClosed();
    expect(tracker.titles()).toEqual(['Idea before iOS stops the app']);
    expect(clientIds()).toEqual([expect.any(String), clientIds()[0]]);
  });
});

const HELD: Answer = () => new Promise<Ticket>(() => undefined);
const LOST: Answer = () => Promise.reject(LOST_ANSWER);

// The crash comes within the 8 s, before the capture waits on the phone; its timers die too.
async function crashMidCreate(sent: Sent, text: string) {
  let user = loadApp(sent);
  await openCapture(user);
  await user.type(title(), `${text}{Enter}`);
  expect(sent.createTicket).toHaveBeenCalledTimes(1);
  vi.clearAllTimers();
  user = loadApp(sent);
  await openCapture(user);
  expect(title()).toHaveValue(text);
  return user;
}

describe('regression: text changed before Create again', () => {
  it('saves text replaced after a crash mid-create to the ticket the first create made', async () => {
    const { tracker, clientIds, ...sent } = trackerWithFirstAnswer(HELD);
    const user = await crashMidCreate(sent, 'Idea before iOS stops the app');
    await replaceTitle(user, 'A different idea');

    await create(user);

    expect(await screen.findByText('MOB-1 created')).toBeInTheDocument();
    await sheetClosed();
    expect(tracker.titles()).toEqual(['A different idea']);
    expect(sent.updateTicket).toHaveBeenCalledWith('MOB-1', { title: 'A different idea' });
    expect(clientIds()).toEqual([expect.any(String), clientIds()[0]]);
  });

  it('saves a title edited after a lost answer to that ticket', async () => {
    const { tracker, ...sent } = trackerWithFirstAnswer(LOST);
    const user = loadApp(sent);
    await captureWithPhoto(user, 'Photo of the bug');
    await create(user);
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(FILES_NEED_CONNECTION);
    await user.type(title(), ', happens on iOS 18 only');

    await create(user);

    expect(await screen.findByText('MOB-1 created')).toBeInTheDocument();
    await sheetClosed();
    expect(tracker.titles()).toEqual(['Photo of the bug, happens on iOS 18 only']);
  });

  it('keeps the text in the sheet and says so when it cannot be saved', async () => {
    const { tracker, ...sent } = trackerWithFirstAnswer(LOST);
    sent.updateTicket.mockRejectedValueOnce(new ApiError(500, 'internal', 'Database is locked.'));
    const user = loadApp(sent);
    await captureWithPhoto(user, 'Photo of the bug');
    await create(user);
    await within(dialog()).findByRole('alert');
    await replaceTitle(user, 'Photo of the crash');

    await create(user);

    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(textNotSaved('MOB-1'));
    expect(title()).toHaveValue('Photo of the crash');
    expect(tracker.titles()).toEqual(['Photo of the bug']);

    await create(user);

    expect(await screen.findByText('MOB-1 created')).toBeInTheDocument();
    await sheetClosed();
    expect(tracker.titles()).toEqual(['Photo of the crash']);
  });

  it('makes a new capture of what is typed after the capture was emptied', async () => {
    const { tracker, clientIds, ...sent } = trackerWithFirstAnswer(HELD);
    const user = await crashMidCreate(sent, 'Idea before iOS stops the app');
    await user.clear(title());
    await user.type(title(), 'A different idea');

    await create(user);

    expect(await screen.findByText('MOB-2 created')).toBeInTheDocument();
    expect(tracker.titles()).toEqual(['Idea before iOS stops the app', 'A different idea']);
    expect(sent.updateTicket).not.toHaveBeenCalled();
    const [first, next] = clientIds();
    expect(next).not.toBe(first);
  });
});

describe('regression: text changed before the capture waits offline', () => {
  it('saves the latest text to the ticket the first create made when the queue syncs', async () => {
    const { tracker, ...sent } = trackerWithFirstAnswer(LOST);
    const user = loadApp(sent, { sync: true });
    await captureWithPhoto(user, 'Photo of the bug');
    await create(user);
    await within(dialog()).findByRole('alert');
    await user.click(within(dialog()).getByRole('button', { name: 'Remove image 1' }));
    await replaceTitle(user, 'Crash on the second photo');
    sent.createTicket.mockImplementationOnce(() => Promise.reject(LOST_ANSWER));

    await create(user);
    expect(await screen.findByText(SAVED_ON_PHONE)).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(await screen.findByText('1 ticket added')).toBeInTheDocument();
    expect(tracker.titles()).toEqual(['Crash on the second photo']);
  });
});
