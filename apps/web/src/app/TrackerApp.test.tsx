import { ApiError, type TrackerClient } from '@tracker/client';
import type { SessionState } from '@tracker/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NETWORK_ERROR_MESSAGE } from '../api';
import { fakeClient } from '../api/test/fakeClient';
import { makeBoard, makeTicketDetail, otherProject } from '../api/test/fixtures';
import { createTestQueryClient } from '../api/test/render';
import { mockPhone, skipAnimations } from '../overlays/testing';
import { projectSummary } from './test/harness';
import { TrackerApp } from './TrackerApp';

vi.mock('../features/project/ProjectScreen', async () => {
  const { createElement } = await import('react');
  return {
    ProjectScreen: ({ projectKey }: { projectKey: string }) =>
      createElement('p', null, `Project screen ${projectKey}`),
  };
});

vi.mock('../features/ticket/TicketScreen', async () => {
  const { createElement } = await import('react');
  return {
    TicketScreen: ({ projectKey, num }: { projectKey: string; num: number }) =>
      createElement('p', null, `Ticket screen ${projectKey}-${num}`),
  };
});

const OPEN_SESSION: SessionState = { authRequired: false, authenticated: true };
const PROJECTS = [
  projectSummary({ openCount: 3 }),
  projectSummary({ ...otherProject, openCount: 0 }),
];

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  window.history.replaceState(null, '', '/');
});

function renderApp(path: string, overrides: Partial<Record<keyof TrackerClient, unknown>> = {}) {
  window.history.replaceState(null, '', path);
  const client = fakeClient({
    getSession: () => Promise.resolve(OPEN_SESSION),
    listProjects: () => Promise.resolve(PROJECTS),
    getBoard: () => Promise.resolve(makeBoard()),
    getTicket: () => Promise.resolve(makeTicketDetail()),
    ...overrides,
  });
  render(<TrackerApp client={client} queryClient={createTestQueryClient()} />);
  return client;
}

const sidebar = () => screen.getByRole('complementary', { name: 'Projects' });
const breadcrumb = () => screen.getByRole('navigation', { name: 'Breadcrumb' });
const path = () => window.location.pathname;

describe('desktop shell', () => {
  it('lists the projects in the sidebar and marks All projects on Projects', async () => {
    renderApp('/');
    await screen.findByRole('complementary', { name: 'Projects' });
    const mobile = await within(sidebar()).findByRole('button', { name: 'Mobile app 3 open' });
    expect(mobile).not.toHaveAttribute('aria-current');
    expect(within(sidebar()).getByRole('button', { name: 'Website 0 open' })).toBeInTheDocument();
    expect(within(sidebar()).getByRole('button', { name: 'All projects' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(breadcrumb()).toHaveTextContent(/^Projects$/);
    expect(screen.getAllByRole('button', { name: 'New project' })).toHaveLength(2);
  });

  it('follows a project: active sidebar item, breadcrumb and project actions', async () => {
    const user = userEvent.setup();
    renderApp('/');
    await screen.findByRole('complementary', { name: 'Projects' });
    await user.click(await within(sidebar()).findByRole('button', { name: 'Mobile app 3 open' }));
    expect(path()).toBe('/p/MOB');
    expect(await screen.findByText('Project screen MOB')).toBeInTheDocument();
    expect(within(sidebar()).getByRole('button', { name: 'Mobile app 3 open' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(breadcrumb()).getByRole('button', { name: 'Projects' })).toBeInTheDocument();
    expect(within(breadcrumb()).getByText('Mobile app')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New ticket' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Project options' })).toBeInTheDocument();
    await user.click(within(breadcrumb()).getByRole('button', { name: 'Projects' }));
    expect(path()).toBe('/');
  });

  it('shows the ticket key last and links the project crumb back', async () => {
    const user = userEvent.setup();
    renderApp('/p/MOB/3');
    expect(await screen.findByText('Ticket screen MOB-3')).toBeInTheDocument();
    await within(breadcrumb()).findByRole('button', { name: 'Mobile app' });
    expect(breadcrumb()).toHaveTextContent('ProjectsMobile appMOB-3');
    expect(screen.queryByRole('button', { name: 'New ticket' })).not.toBeInTheDocument();
    expect(within(sidebar()).getByRole('button', { name: 'Mobile app 3 open' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await user.click(within(breadcrumb()).getByRole('button', { name: 'Mobile app' }));
    expect(path()).toBe('/p/MOB');
  });

  it('shows a small banner while the tracker cannot be reached', async () => {
    renderApp('/', { listProjects: () => Promise.reject(new TypeError('Failed to fetch')) });
    await waitFor(() => expect(document.querySelector('.banner')).not.toBeNull());
    expect(document.querySelector('.banner')).toHaveTextContent(NETWORK_ERROR_MESSAGE);
  });

  it('shows no banner for answers from the server', async () => {
    renderApp('/', {
      listProjects: () => Promise.reject(new ApiError(500, 'internal', 'Database is locked')),
    });
    expect(await screen.findByText('Database is locked')).toBeInTheDocument();
    expect(document.querySelector('.banner')).toBeNull();
  });
});

describe('unknown routes', () => {
  const missing = () => Promise.reject(new ApiError(404, 'not_found', 'Not found'));

  it('fall back from an unknown project to Projects', async () => {
    renderApp('/p/NOPE', { getBoard: missing });
    await waitFor(() => expect(path()).toBe('/'));
  });

  it('fall back from an unknown ticket to its project', async () => {
    renderApp('/p/MOB/99', { getTicket: missing });
    await waitFor(() => expect(path()).toBe('/p/MOB'));
    expect(await screen.findByText('Project screen MOB')).toBeInTheDocument();
  });
});

describe('phone shell', () => {
  it('has no sidebar or desktop header, only the stack', async () => {
    restore.push(mockPhone(true));
    renderApp('/', { listProjects: () => Promise.resolve([]) });
    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument();
  });
});

describe('sign in', () => {
  const SIGNED_OUT: SessionState = { authRequired: true, authenticated: false };
  const OWNER: SessionState = { authRequired: true, authenticated: true, email: 'me@example.com' };

  it('signs in on the page it was asked for, after explaining a wrong password', async () => {
    const user = userEvent.setup();
    const login = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(401, 'unauthorized', 'Email or password is incorrect.'))
      .mockResolvedValueOnce(OWNER);
    renderApp('/p/MOB/3', { getSession: () => Promise.resolve(SIGNED_OUT), login });
    expect(await screen.findByRole('heading', { name: 'Sign in to Tracker' })).toBeInTheDocument();
    expect(screen.queryByText('Ticket screen MOB-3')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Email'), 'me@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
    await user.clear(screen.getByLabelText('Password'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Password'), 'correct horse battery{Enter}');

    expect(login).toHaveBeenLastCalledWith({
      email: 'me@example.com',
      password: 'correct horse battery',
    });
    expect(await screen.findByText('Ticket screen MOB-3')).toBeInTheDocument();
    expect(path()).toBe('/p/MOB/3');
  });

  it('says how to set up the owner when there is none yet', async () => {
    renderApp('/', {
      getSession: () => Promise.resolve({ ...SIGNED_OUT, setupRequired: true }),
    });
    expect(await screen.findByText(/No owner account yet/)).toHaveTextContent(
      'npm run owner:set -- --email you@example.com',
    );
  });

  it('signs out from the sidebar on desktop, back to the sign-in screen', async () => {
    const user = userEvent.setup();
    const logout = vi.fn().mockResolvedValue(SIGNED_OUT);
    renderApp('/', { getSession: () => Promise.resolve(OWNER), logout });
    await screen.findByRole('complementary', { name: 'Projects' });
    await user.click(await within(sidebar()).findByRole('button', { name: 'Account' }));
    const sheet = await screen.findByRole('dialog', { name: 'Account' });
    expect(sheet).toHaveTextContent('Signed in as me@example.com');
    await user.click(within(sheet).getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'Sign in to Tracker' })).toBeInTheDocument();
    expect(logout).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Account' })).not.toBeInTheDocument(),
    );
  });

  it('signs out everywhere after a confirm, from the Projects nav bar on a phone', async () => {
    restore.push(mockPhone(true));
    const user = userEvent.setup();
    const signOutEverywhere = vi.fn().mockResolvedValue(SIGNED_OUT);
    renderApp('/', {
      getSession: () => Promise.resolve(OWNER),
      listProjects: () => Promise.resolve([]),
      signOutEverywhere,
    });
    await user.click(await screen.findByRole('button', { name: 'Account' }));
    const sheet = await screen.findByRole('dialog', { name: 'Account' });
    await user.click(within(sheet).getByRole('button', { name: 'Sign out everywhere' }));
    expect(signOutEverywhere).not.toHaveBeenCalled();
    expect(within(sheet).getByRole('alert')).toHaveTextContent(
      'Sign out every phone and browser, this one too?',
    );
    await user.click(within(sheet).getByRole('button', { name: 'Sign out everywhere' }));
    expect(await screen.findByRole('heading', { name: 'Sign in to Tracker' })).toBeInTheDocument();
    expect(signOutEverywhere).toHaveBeenCalledTimes(1);
  });

  it('offers no account where the tracker is open without an owner', async () => {
    renderApp('/');
    await within(await screen.findByRole('complementary', { name: 'Projects' })).findByRole(
      'button',
      { name: 'Mobile app 3 open' },
    );
    expect(screen.queryByRole('button', { name: 'Account' })).not.toBeInTheDocument();
  });
});
