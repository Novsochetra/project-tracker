import type { CreatedTicket, CreateTicketInput } from '@tracker/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachment } from '../../src/api/test/fixtures';
import { useSheets } from '../../src/app/sheets/context';
import { SheetsProvider } from '../../src/app/sheets/SheetsProvider';
import { projectSummary, renderWithApp } from '../../src/app/test/harness';
import { FILES_NEED_CONNECTION } from '../../src/features/capture/captureForm';
import { fakeTracker } from '../../src/features/capture/test/fakeTracker';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

// PT-97: Create again after a lost answer gets the ticket the first create made, and since PT-82
// the tracker leaves out a file that is gone, such as one chosen after the first create whose
// upload expired, where it refused the repeat before. The sheet said "MOB-1 created" all the
// same, so the person never learned the file wasn't on the ticket.

const PROJECTS = [projectSummary()];
const LOST_ANSWER = new TypeError('Failed to fetch');

// The first create's answer is lost; the repeat's says the tracker left out `leftOut`.
function trackerLeavingOut(leftOut: string[]) {
  const tracker = fakeTracker();
  const createTicket = vi.fn((projectKey: string, input: CreateTicketInput) => {
    const ticket = tracker.create(projectKey, input);
    if (createTicket.mock.calls.length === 1) return Promise.reject(LOST_ANSWER);
    const answer: CreatedTicket =
      leftOut.length > 0 ? { ...ticket, leftOutAttachmentIds: leftOut } : ticket;
    return Promise.resolve(answer);
  });
  return { createTicket, updateTicket: vi.fn() };
}

function Opener() {
  const sheets = useSheets();
  return (
    <button type="button" onClick={() => sheets.open({ type: 'capture' })}>
      Capture
    </button>
  );
}

function loadApp(client: ReturnType<typeof trackerLeavingOut>) {
  let uploads = 0;
  renderWithApp(
    <SheetsProvider>
      <Opener />
    </SheetsProvider>,
    {
      projects: PROJECTS,
      client: {
        ...client,
        listProjects: vi.fn().mockResolvedValue(PROJECTS),
        uploadAttachment: vi.fn(() => {
          uploads += 1;
          return Promise.resolve(attachment(`shot-${uploads}`, { ticketId: null }));
        }),
        deleteAttachment: vi.fn(),
      },
    },
  );
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

type User = ReturnType<typeof userEvent.setup>;

const dialog = () => screen.getByRole('dialog', { name: 'New ticket' });
const create = (user: User) => user.click(within(dialog()).getByRole('button', { name: 'Create' }));

async function addPhoto(user: User, count: number) {
  const photo = new File(['png'], `shot-${count}.png`, { type: 'image/png' });
  await user.upload(within(dialog()).getByLabelText('Add files to ticket'), photo);
  expect(await within(dialog()).findByRole('img', { name: `Image ${count}` })).toBeInTheDocument();
}

// The first Create's answer is lost; a second photo is chosen before Create again.
async function createAgainWithLaterPhoto(user: User) {
  await user.click(screen.getByRole('button', { name: 'Capture' }));
  await user.type(within(dialog()).getByLabelText('Ticket title'), 'Photo of the bug');
  await addPhoto(user, 1);
  await create(user);
  expect(await within(dialog()).findByRole('alert')).toHaveTextContent(FILES_NEED_CONNECTION);
  await addPhoto(user, 2);
  await create(user);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
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

describe('regression: Create again tells the person about a file the tracker left out', () => {
  it('says the ticket was created without the file', async () => {
    const user = loadApp(trackerLeavingOut(['shot-2']));

    await createAgainWithLaterPhoto(user);

    expect(
      await screen.findByText("MOB-1 created, but 1 file couldn't be attached"),
    ).toBeInTheDocument();
    expect(screen.queryByText('MOB-1 created')).not.toBeInTheDocument();
  });

  it('says plainly that it was created when nothing was left out', async () => {
    const user = loadApp(trackerLeavingOut([]));

    await createAgainWithLaterPhoto(user);

    expect(await screen.findByText('MOB-1 created')).toBeInTheDocument();
  });
});
