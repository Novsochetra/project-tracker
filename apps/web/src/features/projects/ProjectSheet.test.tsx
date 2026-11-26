import { ApiError } from '@tracker/client';
import type { CreateProjectInput, Project, UpdateProjectInput } from '@tracker/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { otherProject, project, statuses } from '../../api/test/fixtures';
import { currentPath, projectSummary, renderWithApp } from '../../app/test/harness';
import { mockPhone, readActionSheet, skipAnimations } from '../../overlays/testing';
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
        'Tickets are numbered with a short prefix, like MOB-1. Agents get the repository with every ticket, and find the project by it.',
      ),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Project name'), 'Mobile app');
    expect(create).toBeEnabled();
    expect(within(dialog).getByLabelText('Ticket prefix')).toHaveAttribute('placeholder', 'MA');
    expect(
      within(dialog).getByText(
        'Tickets will be numbered MA-1, MA-2 and so on. Agents get the repository with every ticket, and find the project by it.',
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
      instructions: '',
      template: 'software',
    });
    expect(await screen.findByText('“Mobile app” created')).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
    await waitFor(() => expect(currentPath()).toBe('/p/MA'));
  });

  it('sends the instructions for agents', async () => {
    const user = userEvent.setup();
    const { dialog, create } = renderNewSheet();
    await user.type(within(dialog).getByLabelText('Project name'), 'Garden blog');
    await user.type(
      within(dialog).getByLabelText('Instructions for agents'),
      ' Plain voice.{Enter}Cite two sources. ',
    );
    expect(
      within(dialog).getByText('Agents get these with every ticket in this project.'),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ instructions: 'Plain voice.\nCite two sources.' }),
    );
  });

  it('asks before discarding typed instructions on a phone', async () => {
    restore.push(mockPhone(true));
    const user = userEvent.setup();
    const { dialog, onClose } = renderNewSheet();
    await user.type(within(dialog).getByLabelText('Instructions for agents'), 'Plain voice.');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    const ask = screen.getByRole('dialog', { name: 'Discard changes?' });
    await readActionSheet();
    await user.click(within(ask).getByRole('button', { name: 'Keep editing' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(within(dialog).getByLabelText('Instructions for agents')).toHaveValue('Plain voice.');
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
  const website = projectSummary({
    ...otherProject,
    description: 'Docs',
    repo: '~/code/web',
    instructions: 'Plain voice.',
  });
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
    expect(within(dialog).getByLabelText('Instructions for agents')).toHaveValue('Plain voice.');
    expect(within(dialog).queryByLabelText('Ticket prefix')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /^Template/ })).not.toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'Agents get the repository with every ticket in this project, and find the project by it.',
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
      instructions: 'Plain voice.',
      hideName: false,
    });
    expect(await screen.findByText('Project updated')).toBeInTheDocument();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('hides the name with a switch that Save sends, and keeps the real name here', async () => {
    const user = userEvent.setup();
    const { dialog } = renderEditSheet();
    const toggle = within(dialog).getByRole('switch', { name: 'Hide name' });
    expect(within(dialog).getAllByRole('switch')).toEqual([toggle]);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toHaveAccessibleDescription(
      "Shows the project's key instead of its name, and hides its description and folder. This sheet still shows them, and agents still get them with each ticket.",
    );
    await user.click(toggle);
    expect(within(dialog).getByLabelText('Project name')).toHaveValue('Website');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(updateProject).toHaveBeenLastCalledWith(
      'WEB',
      expect.objectContaining({ hideName: true }),
    );
  });

  it('saves changed instructions', async () => {
    const user = userEvent.setup();
    const { dialog } = renderEditSheet();
    const field = within(dialog).getByLabelText('Instructions for agents');
    await user.clear(field);
    await user.type(field, 'Cite two sources.');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(updateProject).toHaveBeenLastCalledWith(
      'WEB',
      expect.objectContaining({ instructions: 'Cite two sources.' }),
    );
  });

  it('has no parallel runs or sub agents field', () => {
    const { dialog } = renderEditSheet();
    expect(within(dialog).queryByLabelText(/most runs at once/i)).toBeNull();
    expect(within(dialog).queryByLabelText(/sub agents/i)).toBeNull();
  });
});
