import type { SessionState } from '@tracker/shared';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeClient } from '../api/test/fakeClient';
import { makeBoard, makeTicketDetail } from '../api/test/fixtures';
import { createTestQueryClient } from '../api/test/render';
import { skipAnimations } from '../overlays/testing';
import { useSheets } from './sheets/context';
import { SheetsProvider } from './sheets/SheetsProvider';
import { projectSummary } from './test/harness';
import { TrackerApp } from './TrackerApp';

// Each lazy part's code arrives only when its gate opens, like a chunk on a slow network.
const gates = vi.hoisted(() => {
  const gate = () => {
    let open = () => undefined as void;
    const arrived = new Promise<void>((resolve) => (open = resolve));
    return { arrived, open: () => open() };
  };
  return { project: gate(), ticket: gate(), connect: gate() };
});

vi.mock('../features/project/ProjectScreen', async () => {
  await gates.project.arrived;
  const { createElement } = await import('react');
  return {
    ProjectScreen: ({ projectKey }: { projectKey: string }) =>
      createElement('p', null, `Project screen ${projectKey}`),
  };
});

vi.mock('../features/ticket/TicketScreen', async () => {
  await gates.ticket.arrived;
  const { createElement } = await import('react');
  return {
    TicketScreen: ({ projectKey, num }: { projectKey: string; num: number }) =>
      createElement('p', null, `Ticket screen ${projectKey}-${num}`),
  };
});

vi.mock('../features/connect/ConnectSheet', async () => {
  await gates.connect.arrived;
  const { createElement } = await import('react');
  return {
    ConnectSheet: () => createElement('div', { role: 'dialog', 'aria-label': 'Connect' }),
  };
});

const OPEN_SESSION: SessionState = { authRequired: false, authenticated: true };

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  window.history.replaceState(null, '', '/');
});

function renderApp(path: string) {
  window.history.replaceState(null, '', path);
  const client = fakeClient({
    getSession: () => Promise.resolve(OPEN_SESSION),
    listProjects: () => Promise.resolve([projectSummary({ openCount: 3 })]),
    listTickets: () => Promise.resolve([]),
    getBoard: () => Promise.resolve(makeBoard()),
    getTicket: () => Promise.resolve(makeTicketDetail()),
  });
  render(<TrackerApp client={client} queryClient={createTestQueryClient()} />);
}

const layerPaths = () =>
  [...document.querySelectorAll('[data-stack-path]')].map((layer) =>
    layer.getAttribute('data-stack-path'),
  );

describe('screens whose code loads when opened', () => {
  it('keep the current screen while the code is on its way, then push the new one', async () => {
    const user = userEvent.setup();
    renderApp('/');
    const sidebar = await screen.findByRole('complementary', { name: 'Projects' });
    await user.click(await within(sidebar).findByRole('button', { name: 'Mobile app 3 open' }));
    expect(window.location.pathname).toBe('/p/MOB');
    expect(layerPaths()).toEqual(['/']);
    expect(screen.queryByText('Loading')).not.toBeInTheDocument();

    await act(async () => {
      gates.project.open();
      await gates.project.arrived;
    });
    expect(await screen.findByText('Project screen MOB')).toBeInTheDocument();
    expect(layerPaths()).toEqual(['/', '/p/MOB']);
  });

  it('show a quiet spinner on a first load straight into one, until its code arrives', async () => {
    gates.project.open();
    renderApp('/p/MOB/3');
    expect(await screen.findByText('Loading')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Projects' })).toBeInTheDocument();

    await act(async () => {
      gates.ticket.open();
      await gates.ticket.arrived;
    });
    expect(await screen.findByText('Ticket screen MOB-3')).toBeInTheDocument();
    expect(screen.queryByText('Loading')).not.toBeInTheDocument();
  });
});

function ConnectOpener() {
  const sheets = useSheets();
  return (
    <button type="button" onClick={() => sheets.open({ type: 'connect' })}>
      Connect
    </button>
  );
}

describe('a sheet whose code loads when opened', () => {
  it('shows once its code arrives, and leaves the screen as it was until then', async () => {
    const user = userEvent.setup();
    render(
      <SheetsProvider>
        <ConnectOpener />
      </SheetsProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Connect' }));
    expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await act(async () => {
      gates.connect.open();
      await gates.connect.arrived;
    });
    expect(await screen.findByRole('dialog', { name: 'Connect' })).toBeInTheDocument();
  });
});
