import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Label } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listItem, makeTicketDetail, STATUS } from '../../../api/test/fixtures';
import { skipAnimations } from '../../../overlays/testing';
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

function setup(phone: boolean, labels: Label[] = LABELS, labelIds = ['l-ui']) {
  const updateTicket = vi.fn().mockReturnValue(new Promise(() => undefined));
  const rendered = renderTicket({
    detail: makeTicketDetail(listItem(3, STATUS.progress, 0, { labelIds }), { labels }),
    phone,
    client: { updateTicket },
  });
  cleanups.push(rendered.restorePhone);
  return { ...rendered, updateTicket, user: userEvent.setup() };
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

  it('stay out of the way in a project without labels', () => {
    setup(true, []);
    expect(screen.queryByRole('button', { name: /^Labels/ })).toBeNull();
  });
});
