import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Label } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listItem, makeTicketDetail, STATUS } from '../../../api/test/fixtures';
import { skipAnimations } from '../../../overlays/testing';
import { PICKER_FIELD_LABEL } from '../../labels/LabelPicker';
import { renderTicket } from '../test/renderTicket';

const label = (id: string, name: string, position: number): Label => ({
  id,
  projectId: 'p1',
  name,
  color: '#B42318',
  template: '',
  instructions: '',
  position,
  createdAt: 1,
});

const LABELS = [label('l-bug', 'Bug', 0), label('l-ui', 'UI', 1)];

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => cleanups.forEach((undo) => undo()));

const RELEASE = { ...label('l-new', 'v1.4', 2), color: '#3E63DD' };

function setup(phone: boolean, labels: Label[] = LABELS, labelIds = ['l-ui']) {
  const updateTicket = vi.fn().mockReturnValue(new Promise(() => undefined));
  const createLabel = vi.fn().mockResolvedValue(RELEASE);
  const rendered = renderTicket({
    detail: makeTicketDetail(listItem(3, STATUS.progress, 0, { labelIds }), { labels }),
    phone,
    client: { updateTicket, createLabel },
  });
  cleanups.push(rendered.restorePhone);

  return { ...rendered, updateTicket, createLabel, user: userEvent.setup() };
}

describe('a ticket’s labels', () => {
  it('show as a chip on phones, whose menu adds and removes one at a time', async () => {
    const { updateTicket, user } = setup(true);
    const details = screen.getByRole('group', { name: 'Details' });
    const chip = within(details).getByRole('button', { name: 'Labels UI' });
    await user.click(chip);
    const menu = screen.getByRole('listbox', { name: 'Labels' });
    expect(menu).toHaveAttribute('aria-multiselectable', 'true');
    expect(within(menu).getByRole('option', { name: 'UI' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.click(within(menu).getByRole('option', { name: 'Bug' }));
    expect(updateTicket).toHaveBeenLastCalledWith('MOB-3', { labelIds: ['l-ui', 'l-bug'] });
    expect(screen.getByRole('listbox', { name: 'Labels' })).toBeInTheDocument();
    expect(chip).toHaveAccessibleName('Labels Bug, UI');
    await user.click(within(menu).getByRole('option', { name: 'UI' }));
    expect(updateTicket).toHaveBeenLastCalledWith('MOB-3', { labelIds: ['l-bug'] });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox', { name: 'Labels' })).toBeNull();
    expect(chip).toHaveFocus();
  });

  it('show as a row in the desktop side panel', async () => {
    const { updateTicket, user } = setup(false, LABELS, []);
    const row = screen.getByRole('button', { name: /^Labels/ });
    expect(row).toHaveTextContent('None');
    await user.click(row);
    await user.click(screen.getByRole('option', { name: 'UI' }));
    expect(updateTicket).toHaveBeenCalledWith('MOB-3', { labelIds: ['l-ui'] });
  });

  it('open as a sheet of chips on phones, where a typed name makes the first label', async () => {
    const { updateTicket, createLabel, user } = setup(true, [], []);
    const chip = screen.getByRole('button', { name: 'Labels No labels' });
    await user.click(chip);
    const sheet = screen.getByRole('dialog', { name: 'Pick labels' });
    expect(sheet).toHaveTextContent('No labels yet');
    await user.type(within(sheet).getByRole('searchbox', { name: PICKER_FIELD_LABEL }), ' v1.4 ');
    await user.click(within(sheet).getByRole('button', { name: 'Create “v1.4”' }));
    expect(createLabel).toHaveBeenCalledWith('MOB', { name: 'v1.4', color: expect.any(String) });
    await waitFor(() =>
      expect(updateTicket).toHaveBeenLastCalledWith('MOB-3', { labelIds: ['l-new'] }),
    );
    expect(within(sheet).getByRole('option', { name: 'v1.4' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(chip).toHaveAccessibleName('Labels v1.4');
  });

  it('narrow to what is typed on desktop, and Enter picks the label named or makes it', async () => {
    const { updateTicket, createLabel, user } = setup(false, LABELS, []);
    await user.click(screen.getByRole('button', { name: /^Labels/ }));
    const field = screen.getByRole('searchbox', { name: PICKER_FIELD_LABEL });
    expect(field).toHaveFocus();
    await user.keyboard('bu');
    const list = screen.getByRole('listbox', { name: 'Labels' });
    expect(
      within(list)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Bug']);
    await user.keyboard('g{Enter}');
    expect(updateTicket).toHaveBeenLastCalledWith('MOB-3', { labelIds: ['l-bug'] });
    expect(field).toHaveValue('');
    await user.keyboard('v1.4{Enter}');
    expect(createLabel).toHaveBeenCalledWith('MOB', { name: 'v1.4', color: expect.any(String) });
    await waitFor(() => expect(field).toHaveValue(''));
  });

  it('send one create for a quick double Enter, and keep what is typed meanwhile', async () => {
    const { createLabel, updateTicket, user } = setup(false, LABELS, []);
    let finish: (label: Label) => void = () => undefined;
    createLabel.mockReturnValue(new Promise<Label>((resolve) => (finish = resolve)));
    await user.click(screen.getByRole('button', { name: /^Labels/ }));
    const field = screen.getByRole('searchbox', { name: PICKER_FIELD_LABEL });
    await user.keyboard('v1.4{Enter}{Enter}');
    expect(createLabel).toHaveBeenCalledTimes(1);
    await user.clear(field);
    await user.keyboard('v1.5');
    finish(RELEASE);
    await waitFor(() =>
      expect(updateTicket).toHaveBeenLastCalledWith('MOB-3', { labelIds: ['l-new'] }),
    );
    expect(field).toHaveValue('v1.5');
  });

  it('move between the field and the labels with the arrows', async () => {
    const { user } = setup(false, LABELS, []);
    await user.click(screen.getByRole('button', { name: /^Labels/ }));
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: 'Bug' })).toHaveFocus();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByRole('option', { name: 'UI' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: 'Edit labels' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('searchbox', { name: PICKER_FIELD_LABEL })).toHaveFocus();
  });

  it('link to the Labels sheet to rename, recolor or delete them', async () => {
    const { user } = setup(false, LABELS, []);
    await user.click(screen.getByRole('button', { name: /^Labels/ }));
    await user.click(screen.getByRole('button', { name: 'Edit labels' }));
    expect(screen.queryByRole('dialog', { name: 'Pick labels' })).toBeNull();
    expect(await screen.findByRole('dialog', { name: 'Labels' })).toBeInTheDocument();
  });

  it('take no more labels once a ticket has ten', async () => {
    const many = Array.from({ length: 11 }, (_, index) => label(`l-${index}`, `L${index}`, index));
    const { updateTicket, user } = setup(
      false,
      many,
      many.slice(0, 10).map((item) => item.id),
    );
    await user.click(screen.getByRole('button', { name: /^Labels/ }));
    const last = screen.getByRole('option', { name: 'L10' });
    expect(last).toHaveAttribute('aria-disabled', 'true');
    await user.click(last);
    expect(updateTicket).not.toHaveBeenCalled();
    expect(screen.getByText('A ticket can have up to 10 labels.')).toBeInTheDocument();
    await user.keyboard('v2');
    expect(screen.queryByRole('button', { name: /^Create/ })).toBeNull();
  });
});
