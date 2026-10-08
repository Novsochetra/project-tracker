import type { CreateTicketInput, Ticket } from '@tracker/shared';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachment } from '../../src/api/test/fixtures';
import { useSheets } from '../../src/app/sheets/context';
import { SheetsProvider } from '../../src/app/sheets/SheetsProvider';
import { projectSummary, renderWithApp } from '../../src/app/test/harness';
import { FILES_NEED_CONNECTION } from '../../src/features/capture/captureForm';
import { fakeTracker } from '../../src/features/capture/test/fakeTracker';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

// The sheet made a new client id on every Create (PT-59). When a create reached the tracker but
// its answer was lost, the sheet stayed open ("Files need a connection…"), and Create again made a
// second ticket. A tab that crashed mid-create kept the text (PT-11) but not the id, so Create
// after reopening made a second ticket too.

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
  const clientIds = () => createTicket.mock.calls.map(([, input]) => input.clientId);
  return { tracker, createTicket, clientIds };
}

function Opener() {
  const sheets = useSheets();
  return (
    <button type="button" onClick={() => sheets.open({ type: 'capture' })}>
      Capture
    </button>
  );
}

// Each call is a fresh page load: new API cache and sheet host, the same storage.
function loadApp(createTicket: ReturnType<typeof trackerWithFirstAnswer>['createTicket']) {
  cleanup();
  renderWithApp(
    <SheetsProvider>
      <Opener />
    </SheetsProvider>,
    {
      projects: PROJECTS,
      client: {
        listProjects: vi.fn().mockResolvedValue(PROJECTS),
        createTicket,
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
    const { tracker, createTicket, clientIds } = trackerWithFirstAnswer(() =>
      Promise.reject(LOST_ANSWER),
    );
    const user = loadApp(createTicket);
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
    const { tracker, createTicket, clientIds } = trackerWithFirstAnswer(() =>
      Promise.reject(LOST_ANSWER),
    );
    const user = loadApp(createTicket);
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
    const { tracker, createTicket, clientIds } = trackerWithFirstAnswer(() =>
      Promise.reject(LOST_ANSWER),
    );
    let user = loadApp(createTicket);
    await captureWithPhoto(user, 'Photo of the bug');
    await create(user);
    await within(dialog()).findByRole('alert');
    await create(user);
    await sheetClosed();

    user = loadApp(createTicket);
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
    const { tracker, createTicket, clientIds } = trackerWithFirstAnswer(
      () => new Promise<Ticket>(() => undefined),
    );
    let user = loadApp(createTicket);
    await openCapture(user);
    await user.type(title(), 'Idea before iOS stops the app{Enter}');
    expect(createTicket).toHaveBeenCalledTimes(1);

    // The crash comes within the 8 s, before the capture waits on the phone; its timers die too.
    vi.clearAllTimers();
    user = loadApp(createTicket);
    await openCapture(user);
    expect(title()).toHaveValue('Idea before iOS stops the app');
    await create(user);

    expect(await screen.findByText('MOB-1 created')).toBeInTheDocument();
    await sheetClosed();
    expect(tracker.titles()).toEqual(['Idea before iOS stops the app']);
    expect(clientIds()).toEqual([expect.any(String), clientIds()[0]]);
  });
});
