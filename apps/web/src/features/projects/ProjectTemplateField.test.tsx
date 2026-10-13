import {
  PROJECT_INSTRUCTIONS_MAX,
  PROJECT_TEMPLATES,
  type CreateProjectInput,
} from '@tracker/shared';
import { screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { project, statuses } from '../../api/test/fixtures';
import { renderWithApp } from '../../app/test/harness';
import { mockPhone, readActionSheet, skipAnimations } from '../../overlays/testing';
import { ProjectSheet } from './ProjectSheet';

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
});

function renderNewSheet() {
  const create = vi.fn((input: CreateProjectInput) =>
    Promise.resolve({ project: { ...project, name: input.name }, statuses }),
  );
  const onClose = vi.fn();
  renderWithApp(<ProjectSheet open onClose={onClose} />, { client: { createProject: create } });
  const dialog = screen.getByRole('dialog', { name: 'New project' });
  return {
    create,
    onClose,
    dialog,
    instructions: within(dialog).getByLabelText('Instructions for Claude'),
  };
}

async function pick(user: UserEvent, dialog: HTMLElement, label: string) {
  await user.click(within(dialog).getByRole('button', { name: /^Template/ }));
  await user.click(screen.getByRole('option', { name: label }));
}

describe('Template picker', () => {
  it('starts on Software, first in the list, with no instructions', async () => {
    const user = userEvent.setup();
    const { dialog, instructions } = renderNewSheet();
    const row = within(dialog).getByRole('button', { name: /^Template/ });
    expect(row).toHaveTextContent('Software');
    expect(
      within(dialog).getByText('Statuses: To do, In progress, Need review, Reviewed, Done.'),
    ).toBeInTheDocument();
    expect(instructions).toHaveValue('');
    expect(instructions).toHaveAttribute('maxLength', String(PROJECT_INSTRUCTIONS_MAX));
    await user.click(row);
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Software',
      'Writing',
      'Research',
      'Operations',
      'Personal',
    ]);
  });

  it('fills the starter instructions and creates a Writing project', async () => {
    const user = userEvent.setup();
    const { dialog, instructions, create } = renderNewSheet();
    await user.type(within(dialog).getByLabelText('Project name'), 'Garden blog');
    await pick(user, dialog, 'Writing');
    expect(instructions).toHaveValue(PROJECT_TEMPLATES.writing.instructions);
    expect(
      within(dialog).getByText('Statuses: Ideas, Drafting, Needs edit, Edited, Published.'),
    ).toBeInTheDocument();
    await user.type(instructions, '\nUse British spelling.');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        template: 'writing',
        instructions: `${PROJECT_TEMPLATES.writing.instructions}\nUse British spelling.`,
      }),
    );
  });

  it('swaps an untouched starter for the next one, and Software clears it', async () => {
    const user = userEvent.setup();
    const { dialog, instructions } = renderNewSheet();
    await pick(user, dialog, 'Writing');
    await pick(user, dialog, 'Research');
    expect(instructions).toHaveValue(PROJECT_TEMPLATES.research.instructions);
    await pick(user, dialog, 'Software');
    expect(instructions).toHaveValue('');
  });

  it('keeps instructions the person typed when the template changes', async () => {
    const user = userEvent.setup();
    const { dialog, instructions, create } = renderNewSheet();
    await user.type(within(dialog).getByLabelText('Project name'), 'Errands');
    await user.type(instructions, 'Plain lists.');
    await pick(user, dialog, 'Personal');
    expect(instructions).toHaveValue('Plain lists.');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'personal', instructions: 'Plain lists.' }),
    );
  });

  it('asks before discarding a picked template on a phone', async () => {
    restore.push(mockPhone(true));
    const user = userEvent.setup();
    const { dialog, onClose } = renderNewSheet();
    await pick(user, dialog, 'Operations');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('dialog', { name: 'Discard changes?' })).toBeInTheDocument();
    await readActionSheet();
    expect(onClose).not.toHaveBeenCalled();
  });
});
