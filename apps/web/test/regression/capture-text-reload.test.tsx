import type { Ticket } from '@tracker/shared';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listItem, otherProject, STATUS } from '../../src/api/test/fixtures';
import { useSheets } from '../../src/app/sheets/context';
import { SheetsProvider } from '../../src/app/sheets/SheetsProvider';
import { projectSummary, renderWithApp } from '../../src/app/test/harness';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

// Quick capture's text lived only in the sheet, so a reload, a crash or iOS stopping the app lost
// it, while New ticket already kept its fields (PT-11 review).

const PROJECTS = [
  projectSummary({ lastActivityAt: 100 }),
  projectSummary({ ...otherProject, color: '#D97706', lastActivityAt: 300 }),
];
const IDEA = 'Captured idea before iOS stops the app';

const ticketIn = (projectKey: string, title: string): Ticket => {
  const {
    commentCount: _c,
    attachmentCount: _a,
    ...ticket
  } = listItem(1, STATUS.todo, 0, {
    key: `${projectKey}-1`,
    title,
  });
  return ticket;
};

const creates = () =>
  vi.fn((projectKey: string, input: { title: string }) =>
    Promise.resolve(ticketIn(projectKey, input.title)),
  );

function Opener() {
  const sheets = useSheets();
  return (
    <button type="button" onClick={() => sheets.open({ type: 'capture' })}>
      Capture
    </button>
  );
}

// Each call is a fresh page load: new API cache and sheet host, the same storage.
function loadApp(createTicket = creates()) {
  cleanup();
  renderWithApp(
    <SheetsProvider>
      <Opener />
    </SheetsProvider>,
    {
      projects: PROJECTS,
      client: { listProjects: vi.fn().mockResolvedValue(PROJECTS), createTicket },
    },
  );
  return { createTicket, user: userEvent.setup() };
}

type User = ReturnType<typeof userEvent.setup>;

const dialog = () => screen.getByRole('dialog', { name: 'New ticket' });
const title = () => within(dialog()).getByLabelText('Ticket title');
const description = () => within(dialog()).getByLabelText('Description');
const projectRow = () => within(dialog()).getByRole('button', { name: /^Project/ });
const priorityRow = () => within(dialog()).getByRole('button', { name: /^Priority/ });
const sheetClosed = () =>
  waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

const openCapture = (user: User) => user.click(screen.getByRole('button', { name: 'Capture' }));

async function captureIdea(user: User) {
  await openCapture(user);
  await user.type(title(), IDEA);
  await user.type(description(), 'Steps inside');
  await user.click(projectRow());
  await user.click(screen.getByRole('option', { name: 'Mobile app' }));
  await user.click(priorityRow());
  await user.click(screen.getByRole('option', { name: 'High' }));
}

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(false)];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  window.localStorage.clear();
});

describe('regression: quick capture keeps typed text across a reload', () => {
  it('opens again with the text, project and priority until the ticket is created', async () => {
    await captureIdea(loadApp().user);

    const { user, createTicket } = loadApp();
    await openCapture(user);
    expect(title()).toHaveValue(IDEA);
    expect(description()).toHaveValue('Steps inside');
    expect(projectRow()).toHaveTextContent('Mobile app');
    expect(priorityRow()).toHaveTextContent('High');
    await user.type(title(), '{Enter}');
    expect(createTicket).toHaveBeenCalledWith(
      'MOB',
      expect.objectContaining({ title: IDEA, description: 'Steps inside', priority: 'high' }),
    );
    await sheetClosed();

    const after = loadApp();
    await openCapture(after.user);
    expect(title()).toHaveValue('');
    expect(description()).toHaveValue('');
    expect(priorityRow()).toHaveTextContent('Medium');
  });

  it('lets the text go once the capture waits offline', async () => {
    const offline = loadApp(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await captureIdea(offline.user);
    await offline.user.type(title(), '{Enter}');
    await sheetClosed();

    const { user } = loadApp();
    await openCapture(user);
    expect(title()).toHaveValue('');
  });

  it('lets the text go on Discard and once it is emptied', async () => {
    restore.push(mockPhone(true));
    await captureIdea(loadApp().user);
    let next = loadApp();
    await openCapture(next.user);
    await next.user.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    await next.user.click(screen.getByRole('button', { name: 'Discard changes' }));
    await sheetClosed();
    next = loadApp();
    await openCapture(next.user);
    expect(title()).toHaveValue('');

    await next.user.type(title(), 'Typo');
    next = loadApp();
    await openCapture(next.user);
    expect(title()).toHaveValue('Typo');
    await next.user.clear(title());
    next = loadApp();
    await openCapture(next.user);
    expect(title()).toHaveValue('');
  });
});
