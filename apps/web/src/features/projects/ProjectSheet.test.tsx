import { ApiError } from '@tracker/client';
import type { CreateProjectInput, Project, UpdateProjectInput } from '@tracker/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { otherProject, project, statuses } from '../../api/test/fixtures';
import { currentPath, projectSummary, renderWithApp } from '../../app/test/harness';
import { mockPhone, skipAnimations } from '../../overlays/testing';
import { EditProjectSheet } from './EditProjectSheet';
import { ProjectSheet } from './ProjectSheet';

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
});

const createProject = (input: CreateProjectInput) =>
  Promise.resolve({
    project: { ...project, name: input.name, key: input.key ?? 'PRJ' },
    statuses,
  });

function renderNewSheet(create = vi.fn(createProject)) {
  const onClose = vi.fn();
  const view = renderWithApp(<ProjectSheet open onClose={onClose} />, {
    client: { createProject: create },
  });
  return { ...view, onClose, create, dialog: screen.getByRole('dialog', { name: 'New project' }) };
}

describe('New project sheet', () => {
  it('keeps Create disabled and explains prefixes until a name is typed', async () => {
    const user = userEvent.setup();
    const { dialog } = renderNewSheet();
    const create = within(dialog).getByRole('button', { name: 'Create' });
    expect(create).toBeDisabled();
    expect(
      within(dialog).getByText(
        'Tickets are numbered with a short prefix, like MOB-1. The repository is added to every Claude Code prompt.',
      ),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Project name'), 'Mobile app');
    expect(create).toBeEnabled();
    expect(within(dialog).getByLabelText('Ticket prefix')).toHaveAttribute('placeholder', 'MA');
    expect(
      within(dialog).getByText(
        'Tickets will be numbered MA-1, MA-2 and so on. The repository is added to every Claude Code prompt.',
      ),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Ticket prefix'), 'mob');
    expect(within(dialog).getByText(/^Tickets will be numbered MOB-1, MOB-2/)).toBeInTheDocument();
  });

  it('says why when Enter is pressed without a name, until the name changes', async () => {
    const user = userEvent.setup();
    const { dialog, create } = renderNewSheet();
    await user.type(within(dialog).getByLabelText('Repository or folder'), '~/code/app{Enter}');
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Add a name to create the project.',
    );
    expect(create).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText('Project name'), 'A');
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('creates the project, opens it and confirms with a toast', async () => {
    const user = userEvent.setup();
    const { dialog, create, onClose } = renderNewSheet();
    await user.type(within(dialog).getByLabelText('Project name'), ' Mobile app ');
    await user.type(within(dialog).getByLabelText('Description'), 'Phone app');
    await user.type(within(dialog).getByLabelText('Repository or folder'), '~/code/mobile');
    await user.type(within(dialog).getByLabelText('Project name'), '{Enter}');
    expect(create).toHaveBeenCalledWith({
      name: 'Mobile app',
      key: 'MA',
      description: 'Phone app',
      repo: '~/code/mobile',
    });
    expect(await screen.findByText('“Mobile app” created')).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
    await waitFor(() => expect(currentPath()).toBe('/p/MA'));
  });

  it('shows the server error and stays open', async () => {
    const user = userEvent.setup();
    const failing = vi.fn(() =>
      Promise.reject(new ApiError(400, 'invalid_input', 'That name is too long.')),
    );
    const { dialog, onClose } = renderNewSheet(failing);
    await user.type(within(dialog).getByLabelText('Project name'), 'Mobile app');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('That name is too long.');
    expect(onClose).not.toHaveBeenCalled();
    expect(currentPath()).toBe('/');
  });

  it('focuses the name on desktop only', () => {
    renderNewSheet();
    expect(screen.getByLabelText('Project name')).toHaveFocus();
  });

  it('leaves focus alone on phones so the keyboard stays down', () => {
    restore.push(mockPhone(true));
    renderNewSheet();
    expect(screen.getByLabelText('Project name')).not.toHaveFocus();
  });
});

describe('Edit project sheet', () => {
  const website = projectSummary({ ...otherProject, description: 'Docs', repo: '~/code/web' });
  const updateProject = vi.fn((key: string, input: UpdateProjectInput) =>
    Promise.resolve<Project>({ ...otherProject, ...input, key }),
  );

  function renderEditSheet() {
    const onClose = vi.fn();
    renderWithApp(<EditProjectSheet open onClose={onClose} projectKey="WEB" />, {
      client: { updateProject },
      projects: [website],
    });
    return { onClose, dialog: screen.getByRole('dialog', { name: 'Edit project' }) };
  }

  it('starts from the project and has no prefix field', () => {
    const { dialog } = renderEditSheet();
    expect(within(dialog).getByLabelText('Project name')).toHaveValue('Website');
    expect(within(dialog).getByLabelText('Description')).toHaveValue('Docs');
    expect(within(dialog).getByLabelText('Repository or folder')).toHaveValue('~/code/web');
    expect(within(dialog).queryByLabelText('Ticket prefix')).not.toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'The repository is added to every Claude Code prompt for this project.',
      ),
    ).toBeInTheDocument();
  });

  it('saves the changes and confirms with a toast', async () => {
    const user = userEvent.setup();
    const { dialog, onClose } = renderEditSheet();
    const name = within(dialog).getByLabelText('Project name');
    await user.clear(name);
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.type(name, 'Marketing site');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(updateProject).toHaveBeenCalledWith('WEB', {
      name: 'Marketing site',
      description: 'Docs',
      repo: '~/code/web',
      autoReview: false,
    });
    expect(await screen.findByText('Project updated')).toBeInTheDocument();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('turns automatic review on with a switch that Save sends', async () => {
    const user = userEvent.setup();
    const { dialog } = renderEditSheet();
    const save = within(dialog).getByRole('button', { name: 'Save' });
    const toggle = within(dialog).getByRole('switch', { name: 'Review automatically' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toHaveAccessibleDescription(
      'When Claude finishes a ticket, Claude reviews it on the same computer. Changes it asks for go back to Claude, up to 2 rounds.',
    );
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await user.click(save);
    expect(updateProject).toHaveBeenLastCalledWith(
      'WEB',
      expect.objectContaining({ autoReview: true }),
    );
  });
});
