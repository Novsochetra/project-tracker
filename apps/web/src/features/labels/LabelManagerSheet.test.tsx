import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CreateLabelInput, Label, ProjectBoard, UpdateLabelInput } from '@tracker/shared';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listItem, makeBoard, project, STATUS } from '../../api/test/fixtures';
import { CLICK_SHIELD_MS } from '../../lib/clickShield';
import { renderWithApi, sheetTestSetup } from '../claude/test/renderWithApi';
import { LabelManagerSheet } from './LabelManagerSheet';

const bug: Label = {
  id: 'l-bug',
  projectId: project.id,
  name: 'Bug',
  color: '#B42318',
  template: '',
  instructions: '',
  position: 0,
  createdAt: 1,
};

function fakeLabelServer(labels: Label[] = []) {
  let board: ProjectBoard = {
    ...makeBoard(),
    labels,
    tickets: [listItem(1, STATUS.todo, 0, { labelIds: labels.map((label) => label.id) })],
  };
  const save = (next: Label[]) => {
    board = { ...board, labels: next };
  };
  return {
    getBoard: vi.fn(() => Promise.resolve(board)),
    createLabel: vi.fn((_key: string, input: CreateLabelInput) => {
      const label: Label = {
        ...bug,
        id: 'l-new',
        name: input.name,
        color: input.color ?? bug.color,
        template: input.template ?? '',
        instructions: input.instructions ?? '',
        position: board.labels?.length ?? 0,
      };
      save([...(board.labels ?? []), label]);
      return Promise.resolve(label);
    }),
    updateLabel: vi.fn((id: string, input: UpdateLabelInput) => {
      const label = { ...board.labels!.find((item) => item.id === id)!, ...input };
      save(board.labels!.map((item) => (item.id === id ? label : item)));
      return Promise.resolve(label);
    }),
    reorderLabels: vi.fn(() => Promise.resolve(board.labels)),
    deleteLabel: vi.fn((id: string) => {
      save(board.labels!.filter((item) => item.id !== id));
      return Promise.resolve(undefined);
    }),
  };
}

function Harness() {
  const [open, setOpen] = useState(true);
  return <LabelManagerSheet open={open} onClose={() => setOpen(false)} projectKey="MOB" />;
}

const sheet = () => screen.getByRole('dialog', { name: 'Labels' });

async function openSheet(server = fakeLabelServer()) {
  renderWithApi(<Harness />, server);
  await within(sheet()).findByRole('button', { name: 'Add label' });
  return { server, user: userEvent.setup() };
}

let restore: () => void;

beforeEach(() => {
  restore = sheetTestSetup();
});

afterEach(() => {
  restore();
});

describe('the Labels sheet', () => {
  it('makes a Bug label with a template and instructions', async () => {
    const { server, user } = await openSheet();
    expect(within(sheet()).queryByRole('list')).toBeNull();
    await user.click(within(sheet()).getByRole('button', { name: 'Add label' }));
    await user.type(within(sheet()).getByRole('textbox', { name: 'Label name' }), 'Bug');
    await user.click(within(sheet()).getByRole('radio', { name: 'Red' }));
    await user.type(within(sheet()).getByRole('textbox', { name: 'Template' }), '## Steps');
    await user.type(
      within(sheet()).getByRole('textbox', { name: 'Instructions for Claude' }),
      ' Write a failing test first. ',
    );
    await user.click(within(sheet()).getByRole('button', { name: 'Save label' }));
    expect(server.createLabel).toHaveBeenCalledWith('MOB', {
      name: 'Bug',
      color: '#B42318',
      template: '## Steps',
      instructions: 'Write a failing test first.',
    });
    expect(await within(sheet()).findByRole('button', { name: /^Bug/ })).toHaveFocus();
  });

  it('says when a name is taken, ignoring case', async () => {
    const { user } = await openSheet(fakeLabelServer([bug]));
    await user.click(within(sheet()).getByRole('button', { name: 'Add label' }));
    await user.type(within(sheet()).getByRole('textbox', { name: 'Label name' }), 'bug');
    expect(within(sheet()).getByRole('alert')).toHaveTextContent(
      'A label named “Bug” already exists.',
    );
    expect(within(sheet()).getByRole('button', { name: 'Save label' })).toBeDisabled();
  });

  it('renames a label and shows how many tickets have it', async () => {
    const { server, user } = await openSheet(fakeLabelServer([bug]));
    const row = within(sheet()).getByRole('button', { name: /^Bug/ });
    expect(row).toHaveTextContent('1');
    await user.click(row);
    const name = within(sheet()).getByRole('textbox', { name: 'Label name' });
    await user.clear(name);
    await user.type(name, 'Defect{Enter}');
    expect(server.updateLabel).toHaveBeenCalledWith('l-bug', { name: 'Defect' });
    expect(await within(sheet()).findByRole('button', { name: /^Defect/ })).toBeInTheDocument();
  });

  it('deletes a label after saying what happens to its tickets', async () => {
    const { server, user } = await openSheet(fakeLabelServer([bug]));
    await user.click(within(sheet()).getByRole('button', { name: /^Bug/ }));
    await user.click(within(sheet()).getByRole('button', { name: 'Delete label' }));
    await new Promise((resolve) => setTimeout(resolve, CLICK_SHIELD_MS));
    expect(sheet()).toHaveTextContent('Delete “Bug” and take it off 1 ticket?');
    await user.click(within(sheet()).getByRole('button', { name: 'Delete' }));
    expect(server.deleteLabel).toHaveBeenCalledWith('l-bug');
    await waitFor(() => expect(within(sheet()).queryByRole('button', { name: /^Bug/ })).toBeNull());
  });
});
