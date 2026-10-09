import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listItem, makeTicketDetail, STATUS, statuses } from '../../../api/test/fixtures';
import { skipAnimations } from '../../../overlays/testing';
import { phoneRule, pixels } from '../../../../test/regression/phoneCss';
import { renderTicket } from '../test/renderTicket';

const CHIPS = 'features/ticket/details/DetailChips.module.css';
const LONG_STATUS = 'Waiting on design review from the team';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => cleanups.forEach((undo) => undo()));

function setup(item = listItem(3, STATUS.progress, 0), client = {}) {
  const updateTicket = vi.fn().mockReturnValue(new Promise(() => undefined));
  const rendered = renderTicket({
    detail: makeTicketDetail(item, {
      statuses: statuses.map((status) =>
        status.id === STATUS.review ? { ...status, name: LONG_STATUS } : status,
      ),
    }),
    phone: true,
    client: { updateTicket, ...client },
  });
  cleanups.push(rendered.restorePhone);
  return rendered;
}

const chips = () => screen.getByRole('group', { name: 'Details' });

describe('the phone details chips', () => {
  it('show status, priority, assignee and due date in one group under the title', () => {
    setup(
      listItem(3, STATUS.progress, 0, { priority: 'high', assignee: 'Dara', due: '2026-10-09' }),
    );
    const status = within(chips()).getByRole('button', { name: 'Status In progress' });
    expect(status).toHaveAttribute('aria-haspopup', 'listbox');
    expect(status.querySelector('[data-category="in_progress"]')).not.toBeNull();
    const priority = within(chips()).getByRole('button', { name: 'Priority High' });
    expect(priority.querySelector('[data-priority="high"]')).not.toBeNull();
    expect(within(chips()).getByLabelText('Assignee')).toHaveValue('Dara');
    expect(within(chips()).getByLabelText('Due date')).toHaveValue('2026-10-09');
    expect(chips()).toHaveTextContent('Fri, Oct 9');
  });

  it('change the status and the priority from the same dropdowns as the desktop rows', async () => {
    const user = userEvent.setup();
    const { client } = setup();
    await user.click(within(chips()).getByRole('button', { name: /^Status/ }));
    const list = screen.getByRole('listbox', { name: 'Status' });
    expect(within(list).getByRole('option', { name: 'In progress' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.click(within(list).getByRole('option', { name: LONG_STATUS }));
    expect(client.updateTicket).toHaveBeenCalledWith('MOB-3', { statusId: STATUS.review });
    expect(within(chips()).getByRole('button', { name: /^Status/ })).toHaveTextContent(LONG_STATUS);
    expect(within(chips()).getByRole('button', { name: /^Status/ })).toHaveFocus();
    expect(await screen.findByText(`MOB-3 moved to ${LONG_STATUS}`)).toBeInTheDocument();

    await user.click(within(chips()).getByRole('button', { name: /^Priority/ }));
    await user.click(screen.getByRole('option', { name: 'Low' }));
    expect(client.updateTicket).toHaveBeenCalledWith('MOB-3', { priority: 'low' });
  });

  it('save the assignee when the field is left, with the people as suggestions', async () => {
    const user = userEvent.setup();
    const { client } = setup();
    const assignee = within(chips()).getByLabelText('Assignee');
    expect(assignee).toHaveAttribute('placeholder', 'Unassigned');
    await user.click(assignee);
    const suggestions = () => document.getElementById(assignee.getAttribute('list') ?? '');
    await waitFor(() => expect(suggestions()?.querySelectorAll('option')).toHaveLength(2));
    await user.type(assignee, ' Sophea {Enter}');
    expect(assignee).not.toHaveFocus();
    expect(client.updateTicket).toHaveBeenCalledWith(
      'MOB-3',
      { assignee: 'Sophea' },
      { assignee: '' },
    );
  });

  it('say under the chips when the assignee is not saved', async () => {
    const user = userEvent.setup();
    setup(undefined, {
      updateTicket: vi.fn().mockRejectedValue(new ApiError(500, 'internal', 'Down.')),
    });
    await user.type(within(chips()).getByLabelText('Assignee'), 'Dara');
    await user.tab();
    expect(await screen.findByText("Assignee isn't saved yet.")).toBeInTheDocument();
    expect(within(chips()).getByLabelText('Assignee')).toHaveAccessibleDescription(
      /Assignee isn't saved yet/,
    );
  });

  it('set the due date with the phone’s own picker and clear it', async () => {
    const user = userEvent.setup();
    const { client } = setup();
    const due = within(chips()).getByLabelText('Due date');
    expect(due).toHaveAttribute('type', 'date');
    expect(chips()).toHaveTextContent('Due date');
    fireEvent.change(due, { target: { value: '2026-10-20' } });
    await waitFor(() =>
      expect(client.updateTicket).toHaveBeenCalledWith('MOB-3', { due: '2026-10-20' }),
    );
    await user.click(within(chips()).getByRole('button', { name: 'Clear due date' }));
    expect(client.updateTicket).toHaveBeenLastCalledWith('MOB-3', { due: '' });
    expect(within(chips()).getByLabelText('Due date')).toHaveFocus();
  });

  it('show an overdue date in red until the ticket is done', () => {
    setup(listItem(3, STATUS.progress, 0, { due: '2020-01-02' }));
    expect(within(chips()).getByText('Thu, Jan 2, 2020')).toHaveClass('overdue');
  });

  it('do not show a done ticket as overdue', () => {
    setup(listItem(3, STATUS.done, 0, { due: '2020-01-02' }));
    expect(within(chips()).getByText('Thu, Jan 2, 2020')).not.toHaveClass('overdue');
  });
});

describe('the chips’ size at 320px', () => {
  it('give each chip a 44px target', () => {
    const height = pixels(phoneRule(CHIPS, '.chip', 320).get('height'));
    const reach = phoneRule(CHIPS, '.chip::before', 320).get('inset')!.split(' ').map(pixels);
    expect(height - 2 * reach[0]!).toBeGreaterThanOrEqual(44);
    const clear = phoneRule(CHIPS, '.clear::before', 320).get('inset');
    expect(20 - 2 * pixels(clear)).toBeGreaterThanOrEqual(44);
  });

  it('wrap the chips and end a long status or name in an ellipsis inside the screen', () => {
    expect(phoneRule(CHIPS, '.chips', 320).get('flex-wrap')).toBe('wrap');
    expect(phoneRule(CHIPS, '.chip', 320).get('max-width')).toBe('100%');
    expect(phoneRule(CHIPS, '.value', 320).get('text-overflow')).toBe('ellipsis');
    expect(phoneRule(CHIPS, '.name', 320).get('text-overflow')).toBe('ellipsis');
  });

  it('keep 16px text, so iOS doesn’t zoom into the assignee field', () => {
    expect(phoneRule(CHIPS, '.chip', 320).get('font-size')).toBe('16px');
    expect(phoneRule(CHIPS, '.input', 320).get('font')).toBe('inherit');
  });
});
