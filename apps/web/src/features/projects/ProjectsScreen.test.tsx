import { ApiError } from '@tracker/client';
import type { ProjectSummary } from '@tracker/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { otherProject } from '../../api/test/fixtures';
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
