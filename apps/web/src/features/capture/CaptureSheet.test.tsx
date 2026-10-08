import { ApiError } from '@tracker/client';
import type { Ticket } from '@tracker/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachment, listItem, otherProject, STATUS } from '../../api/test/fixtures';
import { useSheets } from '../../app/sheets/context';
import { SheetsProvider } from '../../app/sheets/SheetsProvider';
import {
  currentPath,
  projectSummary,
  renderWithApp,
  type HarnessOptions,
} from '../../app/test/harness';
import { hasDrafts } from '../../lib/drafts';
import { mockPhone, skipAnimations } from '../../overlays/testing';
import { FILES_NEED_CONNECTION, SAVED_ON_PHONE } from './captureForm';
import { LAST_PROJECT_STORAGE_KEY } from './captureProjects';
import { readQueue } from './queueStore';

const PROJECTS = [
  projectSummary({ lastActivityAt: 100 }),
  projectSummary({ ...otherProject, color: '#D97706', lastActivityAt: 300 }),
];
const NETWORK_DOWN = new TypeError('Failed to fetch');

const ticketIn = (projectKey: string, num: number, title: string): Ticket => {
  const {
    commentCount: _c,
    attachmentCount: _a,
    ...ticket
  } = listItem(num, STATUS.todo, 0, {
    key: `${projectKey}-${num}`,
    title,
  });
  return ticket;
};

function Opener() {
  const sheets = useSheets();
  return (
    <button type="button" onClick={() => sheets.open({ type: 'capture' })}>
      Capture
    </button>
  );
}

function renderCapture(client: HarnessOptions['client'] = {}, projects = PROJECTS) {
  const createTicket = vi.fn((projectKey: string, input: { title: string }) =>
    Promise.resolve(ticketIn(projectKey, 1, input.title)),
  );
  const app = renderWithApp(
    <SheetsProvider>
      <Opener />
    </SheetsProvider>,
    {
      projects,
      client: { listProjects: vi.fn().mockResolvedValue(projects), createTicket, ...client },
    },
  );
  return { ...app, createTicket, user: userEvent.setup() };
}

const dialog = () => screen.getByRole('dialog', { name: 'New ticket' });
const titleField = () => within(dialog()).getByLabelText('Ticket title');
const createButton = () => within(dialog()).getByRole('button', { name: 'Create' });
const projectRow = () => within(dialog()).getByRole('button', { name: /^Project/ });
const toast = (text: string) => screen.findByText(text, { exact: true });

async function openCapture(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Capture' }));
  return dialog();
}

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(false)];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  window.localStorage.clear();
});

describe('CaptureSheet', () => {
  it('opens ready to type, with Medium priority and the most recently active project', async () => {
    const { user } = renderCapture();
    await openCapture(user);
    expect(titleField()).toHaveFocus();
    expect(projectRow()).toHaveTextContent('Website');
    expect(within(dialog()).getByRole('button', { name: /^Priority/ })).toHaveTextContent('Medium');
    expect(createButton()).toBeDisabled();
  });

  it('focuses the title on phones too, so the keyboard comes up with the sheet', async () => {
    restore.push(mockPhone(true));
    const { user } = renderCapture();
    await openCapture(user);
    expect(titleField()).toHaveFocus();
  });

  it('creates the ticket in the first status, confirms and stays where it is', async () => {
    const { user, createTicket } = renderCapture();
    await openCapture(user);
    await user.type(titleField(), ' Idea from the bus ');
    await user.type(within(dialog()).getByLabelText('Description'), 'Try it on iOS.');
    await user.click(createButton());

    expect(createTicket).toHaveBeenCalledWith('WEB', {
      title: 'Idea from the bus',
      description: 'Try it on iOS.',
      priority: 'medium',
      clientId: expect.any(String),
    });
    expect(await toast('WEB-1 created')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(currentPath()).toBe('/');
    expect(JSON.parse(window.localStorage.getItem(LAST_PROJECT_STORAGE_KEY) ?? '')).toMatchObject({
      key: 'WEB',
    });
  });

  it('creates with Enter in the title, and explains a blank one', async () => {
    const { user, createTicket } = renderCapture();
    await openCapture(user);
    await user.type(titleField(), '{Enter}');
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(
      'Add a title to create the ticket.',
    );
    await user.type(titleField(), 'Quick one{Enter}');
    expect(createTicket).toHaveBeenCalledWith(
      'WEB',
      expect.objectContaining({ title: 'Quick one' }),
    );
  });

  it('opens the next capture empty, in the project used last', async () => {
    const { user } = renderCapture();
    await openCapture(user);
    await user.click(projectRow());
    await user.click(screen.getByRole('option', { name: 'Mobile app' }));
    await user.click(within(dialog()).getByRole('button', { name: /^Priority/ }));
    await user.click(screen.getByRole('option', { name: 'High' }));
    await user.type(titleField(), 'First{Enter}');
    expect(await toast('MOB-1 created')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await openCapture(user);
    expect(titleField()).toHaveValue('');
    expect(projectRow()).toHaveTextContent('Mobile app');
    expect(within(dialog()).getByRole('button', { name: /^Priority/ })).toHaveTextContent('Medium');
  });

  it('saves the capture on this phone when the tracker cannot be reached', async () => {
    const { user } = renderCapture({ createTicket: vi.fn().mockRejectedValue(NETWORK_DOWN) });
    await openCapture(user);
    await user.type(titleField(), 'Offline idea{Enter}');

    expect(await toast(SAVED_ON_PHONE)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(readQueue().items).toEqual([
      expect.objectContaining({ projectKey: 'WEB', title: 'Offline idea', priority: 'medium' }),
    ]);
    expect(JSON.parse(window.localStorage.getItem(LAST_PROJECT_STORAGE_KEY) ?? '')).toMatchObject({
      key: 'WEB',
    });
  });

  it('keeps a capture with photos open, since photos need a connection', async () => {
    const uploadAttachment = vi.fn().mockResolvedValue(attachment('shot', { ticketId: null }));
    const createTicket = vi.fn().mockRejectedValue(NETWORK_DOWN);
    const { user } = renderCapture({ uploadAttachment, createTicket, deleteAttachment: vi.fn() });
    await openCapture(user);
    await user.type(titleField(), 'With a photo');
    const photo = new File(['png'], 'shot.png', { type: 'image/png' });
    await user.upload(within(dialog()).getByLabelText('Add files to ticket'), photo);
    expect(await within(dialog()).findByRole('img', { name: 'Image 1' })).toBeInTheDocument();

    await user.click(createButton());

    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(FILES_NEED_CONNECTION);
    expect(createTicket).toHaveBeenCalledWith(
      'WEB',
      expect.objectContaining({ attachmentIds: ['shot'] }),
    );
    expect(titleField()).toHaveValue('With a photo');
    expect(readQueue().items).toEqual([]);

    await user.click(within(dialog()).getByRole('button', { name: 'Remove image 1' }));
    expect(within(dialog()).queryByRole('alert')).not.toBeInTheDocument();
    await user.click(createButton());
    expect(await toast(SAVED_ON_PHONE)).toBeInTheDocument();
  });

  it("shows the server's answer when it refuses the ticket", async () => {
    const refused = new ApiError(404, 'not_found', 'Project WEB was not found.');
    const { user } = renderCapture({ createTicket: vi.fn().mockRejectedValue(refused) });
    await openCapture(user);
    await user.type(titleField(), 'Idea{Enter}');
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(
      'Project WEB was not found.',
    );
    expect(readQueue().items).toEqual([]);
  });

  it('keeps typed text for the next opening, and marks files as a draft until it closes', async () => {
    const uploadAttachment = vi.fn().mockResolvedValue(attachment('shot', { ticketId: null }));
    const { user } = renderCapture({ uploadAttachment, deleteAttachment: vi.fn() });
    await openCapture(user);
    await user.type(titleField(), 'Half a thought');
    expect(hasDrafts()).toBe(false);
    const photo = new File(['png'], 'shot.png', { type: 'image/png' });
    await user.upload(within(dialog()).getByLabelText('Add files to ticket'), photo);
    expect(hasDrafts()).toBe(true);
    await user.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(hasDrafts()).toBe(false);
  });

  it('asks for a project first when there are none', async () => {
    const { user } = renderCapture({}, []);
    await openCapture(user);
    expect(await within(dialog()).findByText('Create a project first.')).toBeInTheDocument();
    await user.type(titleField(), 'Idea');
    expect(createButton()).toBeDisabled();
    expect(projectRow()).toBeDisabled();
  });
});
