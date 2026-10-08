import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { skipAnimations } from '../overlays/testing';
import { DesktopHeader } from './DesktopHeader';
import { Sidebar } from './Sidebar';
import { currentPath, projectSummary, renderWithApp } from './test/harness';

let restore: () => void = () => undefined;

beforeEach(() => {
  restore = skipAnimations();
});

afterEach(() => {
  restore();
});

const projects = [projectSummary()];

describe('DesktopHeader', () => {
  it('offers New project on Projects', async () => {
    const user = userEvent.setup();
    const { sheets } = renderWithApp(<DesktopHeader />, { projects });
    await user.click(screen.getByRole('button', { name: 'New project' }));
    expect(sheets.open).toHaveBeenCalledWith({ type: 'newProject' });
  });

  it('offers New ticket and the project options on a project', async () => {
    const user = userEvent.setup();
    const { sheets } = renderWithApp(<DesktopHeader />, { path: '/p/mob', projects });
    await user.click(screen.getByRole('button', { name: 'New ticket' }));
    expect(sheets.open).toHaveBeenCalledWith({ type: 'newTicket', projectKey: 'MOB' });
    await user.click(screen.getByRole('button', { name: 'Project options' }));
    expect(screen.getByRole('group', { name: 'Project options' })).toBeInTheDocument();
  });

  it('has no actions on a ticket, and Projects is a link up two levels', async () => {
    const user = userEvent.setup();
    renderWithApp(<DesktopHeader />, { path: '/p/MOB/3', projects });
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByText('MOB-3').parentElement).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Projects',
      'Mobile app',
    ]);
    await user.click(within(crumbs).getByRole('button', { name: 'Projects' }));
    expect(currentPath()).toBe('/');
  });
});

describe('Sidebar', () => {
  it('asks for a new project from its + button', async () => {
    const user = userEvent.setup();
    const { sheets } = renderWithApp(<Sidebar />, { projects });
    await user.click(screen.getByRole('button', { name: 'New project' }));
    expect(sheets.open).toHaveBeenCalledWith({ type: 'newProject' });
  });

  it('opens a project and goes back to All projects', async () => {
    const user = userEvent.setup();
    renderWithApp(<Sidebar />, { projects });
    await user.click(screen.getByRole('button', { name: 'Mobile app 3 open' }));
    expect(currentPath()).toBe('/p/MOB');
    await user.click(screen.getByRole('button', { name: 'All projects' }));
    expect(currentPath()).toBe('/');
  });
});
