import type { SessionState } from '@tracker/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NETWORK_ERROR_MESSAGE } from '../../src/api';
import { fakeClient } from '../../src/api/test/fakeClient';
import { makeBoard, otherProject } from '../../src/api/test/fixtures';
import { createTestQueryClient } from '../../src/api/test/render';
import { announce } from '../../src/app/announce';
import { LiveRegion } from '../../src/app/LiveRegion';
import { OfflineBanner } from '../../src/app/OfflineBanner';
import { ProjectScreen } from '../../src/app/lazyParts';
import { projectSummary } from '../../src/app/test/harness';
import { TrackerApp } from '../../src/app/TrackerApp';
import { skipAnimations } from '../../src/overlays/testing';

// The banner followed only the device's online state and the project list: a server that
// stopped went unnoticed while other requests failed, and after it came back the banner and
// the empty sidebar stayed until the project list happened to refetch.

const OPEN_SESSION: SessionState = { authRequired: false, authenticated: true };
const PROJECTS = [
  projectSummary({ openCount: 3 }),
  projectSummary({ ...otherProject, openCount: 0 }),
];

function fakeServer() {
  let up = true;
  const route = (answer: () => unknown) =>
    vi.fn(() =>
      up ? Promise.resolve(answer()) : Promise.reject(new TypeError('Failed to fetch')),
    );
  const routes = {
    getSession: route(() => OPEN_SESSION),
    listProjects: route(() => PROJECTS),
    getBoard: route(() => makeBoard()),
  };
  return {
    routes,
    client: fakeClient(routes),
    stop: () => void (up = false),
    start: () => void (up = true),
  };
}

function renderApp(path: string, server = fakeServer()) {
  window.history.replaceState(null, '', path);
  render(<TrackerApp client={server.client} queryClient={createTestQueryClient()} />);
  return server;
}

const banner = () => document.querySelector('.banner');
const liveRegion = () => document.querySelector('[aria-live="polite"]');
const sidebar = () => screen.getByRole('complementary', { name: 'Projects' });
const breadcrumb = () => screen.getByRole('navigation', { name: 'Breadcrumb' });
const MOVE_MOB_1 = 'Move MOB-1. Drag, or use the arrow keys.';

let restore: Array<() => void> = [];

// Loaded late on a busy machine, the screen mounted after the list read failed and read it again,
// which broke the read count (PT-174).
beforeAll(() => ProjectScreen.preload());

beforeEach(() => {
  restore = [skipAnimations()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  announce('');
  window.history.replaceState(null, '', '/');
});

describe('regression: the offline banner follows every API request', () => {
  it('appears when a project fails to load after the server stopped', async () => {
    const user = userEvent.setup();
    const server = renderApp('/p/MOB');
    await screen.findByRole('button', { name: MOVE_MOB_1 });
    const website = await within(sidebar()).findByRole('button', { name: 'Website 0 open' });
    expect(banner()).toBeNull();

    server.stop();
    await user.click(website);

    expect(await screen.findByText("Couldn't load this project")).toBeInTheDocument();
    await waitFor(() => expect(banner()).toHaveTextContent(NETWORK_ERROR_MESSAGE));
  });

  it('goes away and refills the sidebar once a request succeeds again', async () => {
    const user = userEvent.setup();
    const server = fakeServer();
    server.stop();
    renderApp('/p/MOB', server);
    await waitFor(() => expect(banner()).toHaveTextContent(NETWORK_ERROR_MESSAGE));
    const retry = await screen.findByRole('button', { name: 'Try again' });

    server.start();
    await user.click(retry);

    expect(await screen.findByRole('button', { name: MOVE_MOB_1 })).toBeInTheDocument();
    await waitFor(() => expect(banner()).toBeNull());
    expect(
      await within(sidebar()).findByRole('button', { name: 'Mobile app 3 open' }),
    ).toBeVisible();
    expect(server.routes.listProjects).toHaveBeenCalledTimes(2);
    expect(within(breadcrumb()).getByText('Mobile app')).toBeInTheDocument();
    expect(liveRegion()).not.toHaveTextContent(NETWORK_ERROR_MESSAGE);
  });

  it('takes its announcement back when it goes away', () => {
    const Harness = ({ offline }: { offline: boolean }) => (
      <>
        {offline && <OfflineBanner />}
        <LiveRegion />
      </>
    );
    const { rerender } = render(<Harness offline />);
    expect(liveRegion()).toHaveTextContent(NETWORK_ERROR_MESSAGE);

    rerender(<Harness offline={false} />);

    expect(liveRegion()).toBeEmptyDOMElement();
  });
});
