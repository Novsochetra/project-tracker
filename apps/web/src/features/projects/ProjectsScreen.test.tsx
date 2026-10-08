import { ApiError } from '@tracker/client';
import type { ProjectSummary, TicketListItem } from '@tracker/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listItem, otherProject, STATUS, statuses } from '../../api/test/fixtures';
import { currentPath, projectSummary, renderWithApp } from '../../app/test/harness';
import { routePath, StackNavigator } from '../../navigation';
import { mockPhone, skipAnimations } from '../../overlays/testing';
import { ProjectsScreen } from './ProjectsScreen';

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
});

const stack = (
  <StackNavigator
    renderScreen={(route) =>
      route.name === 'projects' ? <ProjectsScreen /> : <p>Opened {routePath(route)}</p>
    }
  />
);

function renderProjects(listProjects: () => Promise<ProjectSummary[]>) {
  return renderWithApp(stack, { client: { listProjects: vi.fn(listProjects) } });
}

const reviewedTicket = (num: number) =>
  listItem(num, STATUS.reviewed, 0, { lastReview: { verdict: 'approved', rating: 4 } });

function renderWithReady(
  ready: () => Promise<TicketListItem[]>,
  client: Record<string, unknown> = {},
) {
  const web = projectSummary({ ...otherProject, openCount: 0, totalCount: 0, doneCount: 0 });
  return renderWithApp(stack, {
    client: {
      listProjects: vi.fn().mockResolvedValue([projectSummary({ openCount: 3 }), web]),
      listAllTickets: vi.fn(async () => ({ tickets: await ready(), statuses })),
      ...client,
    },
  });
}

const readySection = () => screen.queryByRole('region', { name: 'Ready for you' });

const MINUTE = 60_000;

describe('ProjectsScreen', () => {
  it('starts with the empty state, whose button asks for a new project', async () => {
    const user = userEvent.setup();
    const { sheets } = renderProjects(() => Promise.resolve([]));
    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
    expect(
      screen.getByText('Projects hold your tickets. Create one to get started.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New project' }));
    expect(sheets.open).toHaveBeenCalledWith({ type: 'newProject' });
  });

  it('lists each project with its key, description, progress, open count and update time', async () => {
    const mobile = projectSummary({
      description: 'iOS and Android',
      totalCount: 4,
      doneCount: 1,
      openCount: 3,
      lastActivityAt: Date.now() - 5 * MINUTE,
    });
    const web = { ...projectSummary(otherProject), description: '', totalCount: 0, doneCount: 0 };
    renderProjects(() => Promise.resolve([mobile, web]));
    const row = await screen.findByRole('button', { name: /^Mobile app/ });
    expect(row).toHaveTextContent('MOB');
    expect(row).toHaveTextContent('iOS and Android');
    expect(row).toHaveTextContent('25%');
    expect(row).toHaveTextContent('3 open');
    expect(row).toHaveTextContent('Updated 5m ago');
    const empty = screen.getByRole('button', { name: /^Website/ });
    expect(empty).toHaveTextContent('No description');
    expect(empty).toHaveTextContent('0%');
    expect(screen.getByRole('heading', { name: 'Projects' }).parentElement).toHaveTextContent('2');
    expect(screen.getByText('Progress')).toBeInTheDocument();
  });

  it('opens a project', async () => {
    const user = userEvent.setup();
    renderProjects(() => Promise.resolve([projectSummary()]));
    await user.click(await screen.findByRole('button', { name: /^Mobile app/ }));
    expect(currentPath()).toBe('/p/MOB');
    expect(await screen.findByText('Opened /p/MOB')).toBeInTheDocument();
  });

  it('staggers the rows as they rise in', async () => {
    const projects = Array.from({ length: 3 }, (_, index) =>
      projectSummary({ id: `p-${index}`, key: `P${index}`, name: `Project ${index}` }),
    );
    renderProjects(() => Promise.resolve(projects));
    const rows = await screen.findAllByRole('button', { name: /^Project \d/ });
    expect(rows.map((row) => row.style.animationDelay)).toEqual(['0ms', '24ms', '48ms']);
    expect(rows[0]).toHaveClass('rise');
  });

  it('uses the phone nav bar and drops the desktop columns on phones', async () => {
    restore.push(mockPhone(true));
    const user = userEvent.setup();
    const { sheets } = renderProjects(() => Promise.resolve([projectSummary()]));
    await screen.findByRole('button', { name: /^Mobile app/ });
    const navBar = document.querySelector('[data-navbar]');
    expect(navBar).not.toBeNull();
    await user.click(within(navBar as HTMLElement).getByRole('button', { name: 'New project' }));
    expect(sheets.open).toHaveBeenCalledWith({ type: 'newProject' });
    expect(screen.queryByText('Progress')).not.toBeInTheDocument();
  });

  it('opens quick capture from the New ticket button, which shows its C shortcut', async () => {
    const user = userEvent.setup();
    const { sheets } = renderProjects(() => Promise.resolve([projectSummary()]));
    const button = await screen.findByRole('button', { name: 'New ticket' });
    expect(button).toHaveAttribute('aria-keyshortcuts', 'C');
    await user.click(button);
    expect(sheets.open).toHaveBeenCalledWith({ type: 'capture' });
    expect(document.querySelector('[data-bottom-bar]')).toBeNull();
  });

  it('puts New ticket in a bottom bar on phones', async () => {
    restore.push(mockPhone(true));
    const user = userEvent.setup();
    const { sheets } = renderProjects(() => Promise.resolve([projectSummary()]));
    await screen.findByRole('button', { name: /^Mobile app/ });
    const bar = document.querySelector('[data-bottom-bar]');
    expect(bar).not.toBeNull();
    await user.click(within(bar as HTMLElement).getByRole('button', { name: 'New ticket' }));
    expect(sheets.open).toHaveBeenCalledWith({ type: 'capture' });
  });

  it('offers no New ticket before there is a project to put it in', async () => {
    restore.push(mockPhone(true));
    renderProjects(() => Promise.resolve([]));
    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New ticket' })).not.toBeInTheDocument();
    expect(document.querySelector('[data-bottom-bar]')).toBeNull();
  });

  it('offers New ticket offline, before the list loads, when a project was used before', async () => {
    restore.push(mockPhone(true));
    window.localStorage.setItem(
      'tracker.capture.project',
      JSON.stringify({ key: 'MOB', name: 'Mobile app', color: '#5B5BD6' }),
    );
    restore.push(() => window.localStorage.clear());
    renderProjects(() => new Promise<ProjectSummary[]>(() => undefined));
    expect(await screen.findByRole('button', { name: 'New ticket' })).toBeInTheDocument();
  });

  it('shows how many captures wait on this device to sync', async () => {
    window.localStorage.setItem(
      'tracker.capture.queue',
      JSON.stringify({
        items: ['a', 'b'].map((id) => ({ id, projectKey: 'MOB', title: id, capturedAt: 1 })),
        created: [],
      }),
    );
    restore.push(() => window.localStorage.clear());
    renderProjects(() => Promise.resolve([projectSummary()]));
    expect(await screen.findByText('2 waiting to sync')).toBeInTheDocument();
  });

  it('puts tickets waiting in a reviewed status under Ready for you, above the projects', async () => {
    renderWithReady(() => Promise.resolve([reviewedTicket(3)]));
    const section = await screen.findByRole('region', { name: 'Ready for you' });
    const ticket = within(section).getByRole('button', { name: /^MOB-3\b/ });
    expect(ticket).toHaveTextContent('Ticket 3');
    expect(ticket).toHaveTextContent('Mobile app');
    expect(within(ticket).getByRole('img', { name: 'Rated 4 out of 5' })).toBeInTheDocument();
    const firstProject = screen.getByRole('button', { name: /^Mobile app/ });
    expect(section.compareDocumentPosition(firstProject)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('labels each project’s counts with how many of its tickets are ready', async () => {
    renderWithReady(() => Promise.resolve([reviewedTicket(3), reviewedTicket(4)]));
    const mobile = await screen.findByRole('button', { name: /^Mobile app/ });
    await waitFor(() => expect(mobile).toHaveTextContent('2 ready'));
    expect(mobile).toHaveTextContent('3 open');
    const web = screen.getByRole('button', { name: /^Website/ });
    expect(web).toHaveTextContent('0 open');
    expect(web).not.toHaveTextContent('ready');
  });

  it('leaves Ready for you out when nothing is ready', async () => {
    renderWithReady(() => Promise.resolve([]));
    expect(await screen.findByRole('button', { name: /^Mobile app/ })).toBeInTheDocument();
    expect(readySection()).not.toBeInTheDocument();
  });

  it('still lists the projects when Ready for you fails to load', async () => {
    renderWithReady(() => Promise.reject(new ApiError(500, 'internal', 'Database is locked')));
    expect(await screen.findByRole('button', { name: /^Mobile app/ })).toBeInTheDocument();
    expect(readySection()).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('takes a ticket moved to Done off the section at once', async () => {
    const user = userEvent.setup();
    const updateTicket = vi.fn(() => new Promise(() => undefined));
    renderWithReady(() => Promise.resolve([reviewedTicket(3), reviewedTicket(4)]), {
      updateTicket,
    });
    await user.click(await screen.findByRole('button', { name: 'Move MOB-3 to Done' }));
    expect(updateTicket).toHaveBeenCalledWith('MOB-3', { statusId: STATUS.done });
    expect(await screen.findByText('MOB-3 moved to Done')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^MOB-3\b/ })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /^Mobile app/ })).toHaveTextContent('1 ready');
    await user.click(screen.getByRole('button', { name: 'Move MOB-4 to Done' }));
    await waitFor(() => expect(readySection()).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /^Mobile app/ })).not.toHaveTextContent('ready');
  });

  it('explains a failed load and tries again', async () => {
    const user = userEvent.setup();
    const listProjects = vi
      .fn<() => Promise<ProjectSummary[]>>()
      .mockRejectedValueOnce(new ApiError(500, 'internal', 'Database is locked'))
      .mockResolvedValue([projectSummary()]);
    renderWithApp(stack, { client: { listProjects } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Database is locked');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: /^Mobile app/ })).toBeInTheDocument();
  });
});
