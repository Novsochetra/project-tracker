import { ApiError } from '@tracker/client';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currentPath, projectSummary, renderWithApp } from '../../app/test/harness';
import { readMenuConfirm } from '../../components/Popover/testing';
import { mockPhone, readActionSheet, skipAnimations } from '../../overlays/testing';
import { ProjectOptionsButton } from './ProjectOptionsButton';

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
});

function renderOptions(
  placement: 'header' | 'navbar',
  deleteProject = vi.fn(() => Promise.resolve()),
) {
  const view = renderWithApp(<ProjectOptionsButton projectKey="MOB" placement={placement} />, {
    path: '/p/MOB',
    client: { deleteProject },
    projects: [projectSummary({ totalCount: 4 })],
  });
  return { ...view, deleteProject };
}

describe('Project options in the desktop header', () => {
  it('opens a menu with every project action', async () => {
    const user = userEvent.setup();
    renderOptions('header');
    const trigger = screen.getByRole('button', { name: 'Project options' });
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByRole('group', { name: 'Project options' });
    const items = within(menu)
      .getAllByRole('button')
      .map((item) => item.textContent);
    expect(items).toEqual([
      'Edit project',
      'Manage statuses',
      'Connect Claude Code',
      'Delete project',
    ]);
    expect(within(menu).getByRole('button', { name: 'Delete project' })).toHaveClass('danger');
  });

  it.each([
    ['Edit project', { type: 'editProject', projectKey: 'MOB' }],
    ['Manage statuses', { type: 'statuses', projectKey: 'MOB' }],
    ['Connect Claude Code', { type: 'connect' }],
  ])('%s opens its sheet and hands focus back to the ••• button', async (item, request) => {
    const user = userEvent.setup();
    const { sheets } = renderOptions('header');
    const trigger = screen.getByRole('button', { name: 'Project options' });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: item }));
    expect(sheets.open).toHaveBeenCalledWith(request);
    expect(screen.queryByRole('group', { name: 'Project options' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('confirms before deleting, then goes back to Projects with a toast', async () => {
    const user = userEvent.setup();
    const { deleteProject } = renderOptions('header');
    await user.click(screen.getByRole('button', { name: 'Project options' }));
    await user.click(screen.getByRole('button', { name: 'Delete project' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Delete this project and its 4 tickets? This can't be undone.",
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await readMenuConfirm();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(deleteProject).toHaveBeenCalledWith('MOB');
    expect(await screen.findByText('“Mobile app” deleted')).toBeInTheDocument();
    await waitFor(() => expect(currentPath()).toBe('/'));
    expect(screen.queryByRole('group', { name: 'Project options' })).not.toBeInTheDocument();
  });

  it('cancels the confirm and starts over next time', async () => {
    const user = userEvent.setup();
    const { deleteProject } = renderOptions('header');
    const trigger = screen.getByRole('button', { name: 'Project options' });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Delete project' }));
    await readMenuConfirm();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    expect(screen.getByRole('button', { name: 'Edit project' })).toBeInTheDocument();
    expect(deleteProject).not.toHaveBeenCalled();
  });

  it('shows why a delete failed and stays on the project', async () => {
    const user = userEvent.setup();
    renderOptions(
      'header',
      vi.fn(() => Promise.reject(new ApiError(500, 'internal', 'Database is locked'))),
    );
    await user.click(screen.getByRole('button', { name: 'Project options' }));
    await user.click(screen.getByRole('button', { name: 'Delete project' }));
    await readMenuConfirm();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Database is locked')).toBeInTheDocument();
    expect(currentPath()).toBe('/p/MOB');
  });
});

describe('Project options in the phone nav bar', () => {
  beforeEach(() => {
    restore.push(mockPhone(true));
  });

  it('opens an action sheet captioned with the project name', async () => {
    const user = userEvent.setup();
    renderOptions('navbar');
    await user.click(screen.getByRole('button', { name: 'Project options' }));
    const sheet = screen.getByRole('dialog', { name: 'Project options' });
    expect(within(sheet).getByText('Mobile app')).toBeInTheDocument();
    const actions = within(sheet)
      .getAllByRole('button')
      .map((action) => action.textContent);
    expect(actions).toEqual([
      'Edit project',
      'Manage statuses',
      'Connect Claude Code',
      'Delete project',
      'Cancel',
    ]);
  });

  it('closes the action sheet before opening the edit sheet', async () => {
    const user = userEvent.setup();
    const { sheets } = renderOptions('navbar');
    await user.click(screen.getByRole('button', { name: 'Project options' }));
    await readActionSheet();
    await user.click(screen.getByRole('button', { name: 'Edit project' }));
    await waitFor(() =>
      expect(sheets.open).toHaveBeenCalledWith({ type: 'editProject', projectKey: 'MOB' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('turns into a confirmation and deletes the project', async () => {
    const user = userEvent.setup();
    const { deleteProject } = renderOptions('navbar');
    await user.click(screen.getByRole('button', { name: 'Project options' }));
    await readActionSheet();
    await user.click(screen.getByRole('button', { name: 'Delete project' }));
    const sheet = screen.getByRole('dialog', { name: 'Project options' });
    expect(within(sheet).getByRole('alert')).toHaveTextContent(
      "Delete “Mobile app” and its 4 tickets? This can't be undone.",
    );
    const confirm = within(sheet).getByRole('button', { name: 'Delete project' });
    expect(confirm).toHaveClass('bold');
    await readActionSheet();
    await user.click(confirm);
    expect(deleteProject).toHaveBeenCalledWith('MOB');
    expect(await screen.findByText('“Mobile app” deleted')).toBeInTheDocument();
    await waitFor(() => expect(currentPath()).toBe('/'));
  });

  it('puts the reason in the caption when the delete fails', async () => {
    const user = userEvent.setup();
    renderOptions(
      'navbar',
      vi.fn(() => Promise.reject(new ApiError(500, 'internal', 'Database is locked'))),
    );
    await user.click(screen.getByRole('button', { name: 'Project options' }));
    await readActionSheet();
    await user.click(screen.getByRole('button', { name: 'Delete project' }));
    await readActionSheet();
    await user.click(screen.getByRole('button', { name: 'Delete project' }));
    const sheet = screen.getByRole('dialog', { name: 'Project options' });
    await waitFor(() =>
      expect(within(sheet).getByRole('alert')).toHaveTextContent('Database is locked'),
    );
    expect(currentPath()).toBe('/p/MOB');
  });
});
