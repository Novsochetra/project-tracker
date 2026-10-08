import { ApiError } from '@tracker/client';
import type { CreateTicketInput, UpdateTicketInput } from '@tracker/shared';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachment } from '../../src/api/test/fixtures';
import { createReachability } from '../../src/app/reachability';
import { useSheets } from '../../src/app/sheets/context';
import { SheetsProvider } from '../../src/app/sheets/SheetsProvider';
import { projectSummary, renderWithApp } from '../../src/app/test/harness';
import {
  earlierTextToast,
  FILES_NEED_CONNECTION,
  SAVED_ON_PHONE,
} from '../../src/features/capture/captureForm';
import { QuickCapture } from '../../src/features/capture/QuickCapture';
import { fakeTracker } from '../../src/features/capture/test/fakeTracker';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

// Reviewer 51 (PT-79): a capture whose create reached the tracker but whose answer was lost waits
// on the phone. Someone else edits the ticket. When the phone syncs, the repeat's answer has their
// text, and the sync saved the capture's text over it although the person changed nothing: title
// and description edits are not in the activity, so their text was gone for good. Create again in
// the sheet did the same. Only what the person changed since the first create may be saved.

const PROJECTS = [projectSummary()];
const LOST_ANSWER = new TypeError('Failed to fetch');
const OTHER_EDIT = {
  title: 'Login button does nothing on iOS Safari',
  description: 'Lead added steps',
  priority: 'high',
} as const;

// The first create reaches the tracker and its answer is lost; the phone is then offline until
// `goOnline`, so no sync runs before someone else's edit.
function trackerLosingFirstAnswer() {
  const tracker = fakeTracker();
  let offline = false;
  const createTicket = vi.fn((projectKey: string, input: CreateTicketInput) => {
    if (offline) return Promise.reject(LOST_ANSWER);
    const ticket = tracker.create(projectKey, input);
    if (createTicket.mock.calls.length > 1) return Promise.resolve(ticket);
    offline = true;
    return Promise.reject(LOST_ANSWER);
  });
  const updateTicket = vi.fn((ticketKey: string, input: UpdateTicketInput) =>
    Promise.resolve(tracker.update(ticketKey, input)),
  );
  const goOnline = () => {
    offline = false;
  };
  const ticket = () => tracker.search('MOB')[0];
  return { tracker, createTicket, updateTicket, goOnline, ticket };
}

type Sent = Pick<ReturnType<typeof trackerLosingFirstAnswer>, 'createTicket' | 'updateTicket'>;

function Opener() {
  const sheets = useSheets();
  return (
    <button type="button" onClick={() => sheets.open({ type: 'capture' })}>
      Capture
    </button>
  );
}

function loadApp({ createTicket, updateTicket }: Sent) {
  cleanup();
  renderWithApp(
    <SheetsProvider>
      <Opener />
      <QuickCapture reachability={createReachability()} />
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
const syncNow = () =>
  act(() => {
    window.dispatchEvent(new Event('online'));
  });
const textOf = (ticket: { title: string; description: string; priority: string } | undefined) => ({
  title: ticket?.title,
  description: ticket?.description,
  priority: ticket?.priority,
});

async function captureWithPhoto(user: User, text: string) {
  await openCapture(user);
  await user.type(title(), text);
  const photo = new File(['png'], 'shot.png', { type: 'image/png' });
  await user.upload(within(dialog()).getByLabelText('Add files to ticket'), photo);
  expect(await within(dialog()).findByRole('img', { name: 'Image 1' })).toBeInTheDocument();
  await create(user);
  expect(await within(dialog()).findByRole('alert')).toHaveTextContent(FILES_NEED_CONNECTION);
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

describe('regression: a capture never saves text the person did not change', () => {
  it('leaves someone else’s edit when a queued capture syncs unchanged', async () => {
    const { tracker, goOnline, ticket, ...sent } = trackerLosingFirstAnswer();
    const user = loadApp(sent);
    await openCapture(user);
    await user.type(title(), 'Login button does nothing{Enter}');
    expect(await screen.findByText(SAVED_ON_PHONE)).toBeInTheDocument();

    tracker.update('MOB-1', OTHER_EDIT);
    goOnline();
    syncNow();

    expect(await screen.findByText('1 ticket added')).toBeInTheDocument();
    expect(textOf(ticket())).toEqual(OTHER_EDIT);
    expect(sent.updateTicket).not.toHaveBeenCalled();
  });

  it('leaves someone else’s edit on Create again with nothing changed', async () => {
    const { tracker, goOnline, ticket, ...sent } = trackerLosingFirstAnswer();
    const user = loadApp(sent);
    await captureWithPhoto(user, 'Login button does nothing');

    tracker.update('MOB-1', OTHER_EDIT);
    goOnline();
    await create(user);

    expect(await screen.findByText('MOB-1 created')).toBeInTheDocument();
    expect(textOf(ticket())).toEqual(OTHER_EDIT);
    expect(sent.updateTicket).not.toHaveBeenCalled();
  });

  it('saves only the field the person changed since the first create', async () => {
    const { tracker, goOnline, ticket, ...sent } = trackerLosingFirstAnswer();
    const user = loadApp(sent);
    await captureWithPhoto(user, 'Login button does nothing');
    await user.click(within(dialog()).getByRole('button', { name: /^Priority/ }));
    await user.click(screen.getByRole('option', { name: 'Low' }));

    tracker.update('MOB-1', OTHER_EDIT);
    goOnline();
    await create(user);

    expect(await screen.findByText('MOB-1 created')).toBeInTheDocument();
    expect(sent.updateTicket).toHaveBeenCalledWith('MOB-1', { priority: 'low' });
    expect(textOf(ticket())).toEqual({ ...OTHER_EDIT, priority: 'low' });
  });
});

describe('regression: a synced capture whose later text is refused', () => {
  it('says the ticket was created with the earlier text instead of “Couldn’t add”', async () => {
    const { goOnline, ticket, ...sent } = trackerLosingFirstAnswer();
    const user = loadApp(sent);
    await captureWithPhoto(user, 'Photo of the bug');
    await user.click(within(dialog()).getByRole('button', { name: 'Remove image 1' }));
    await user.type(title(), ', on iOS 18 only');
    await create(user);
    expect(await screen.findByText(SAVED_ON_PHONE)).toBeInTheDocument();
    sent.updateTicket.mockRejectedValueOnce(new ApiError(404, 'not_found', 'Ticket not found.'));

    goOnline();
    syncNow();

    expect(await screen.findByText(earlierTextToast('MOB-1'))).toBeInTheDocument();
    expect(screen.queryByText(/Couldn’t add/)).not.toBeInTheDocument();
    expect(ticket()?.title).toBe('Photo of the bug');
    await waitFor(() =>
      expect(JSON.parse(window.localStorage.getItem('tracker.capture.queue') ?? '{}')).toEqual({
        items: [],
        created: [expect.any(String)],
      }),
    );
  });
});
