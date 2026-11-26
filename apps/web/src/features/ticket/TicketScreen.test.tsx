import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachment, listItem, makeTicketDetail, STATUS } from '../../api/test/fixtures';
import { skipAnimations } from '../../overlays/testing';
import { renderTicket } from './test/renderTicket';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
  vi.useRealTimers();
});

function setup(options: Parameters<typeof renderTicket>[0] = {}) {
  const rendered = renderTicket(options);
  cleanups.push(rendered.restorePhone);

  return rendered;
}

const location = () => screen.getByRole('status', { name: 'Location' }).textContent;
const updated = (detail = makeTicketDetail()) => vi.fn().mockResolvedValue(detail.ticket);

describe('TicketScreen fields', () => {
  it('shows the key, title and description', () => {
    const detail = makeTicketDetail(
      listItem(3, STATUS.todo, 0, { title: 'Crash on rotate', description: 'Rotate twice.' }),
    );
    setup({ detail });
    expect(screen.getByText('MOB-3')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Crash on rotate');
    expect(screen.getByLabelText('Description')).toHaveValue('Rotate twice.');
  });

  it('saves the title when the field is left, without waiting for the debounce', async () => {
    const updateTicket = updated();
    const user = userEvent.setup();
    const { client } = setup({ client: { updateTicket } });
    const title = screen.getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Fix the login error');
    await user.tab();
    expect(client.updateTicket).toHaveBeenLastCalledWith(
      'MOB-1',
      { title: 'Fix the login error' },
      { title: 'Ticket 1' },
    );
    expect(title).toHaveValue('Fix the login error');
  });

  it('keeps the title on one line', async () => {
    const user = userEvent.setup();
    setup({ client: { updateTicket: updated() } });
    const title = screen.getByLabelText('Title');
    await user.type(title, '{Enter}!');
    expect(title).toHaveValue('Ticket 1!');
  });

  it('changes status and priority from the dropdowns', async () => {
    const updateTicket = updated();
    const user = userEvent.setup();
    const { client } = setup({ client: { updateTicket } });
    await user.click(screen.getByRole('button', { name: /^Status/ }));
    const statusList = screen.getByRole('listbox', { name: 'Status' });
    expect(
      within(statusList)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['To do', 'In progress', 'Need review', 'Reviewed', 'Done']);
    await user.click(within(statusList).getByRole('option', { name: 'In progress' }));
    expect(client.updateTicket).toHaveBeenCalledWith('MOB-1', { statusId: STATUS.progress });
    expect(screen.getByRole('button', { name: /^Status/ })).toHaveTextContent('In progress');

    await user.click(screen.getByRole('button', { name: /^Priority/ }));
    await user.click(screen.getByRole('option', { name: 'High' }));
    expect(client.updateTicket).toHaveBeenCalledWith('MOB-1', { priority: 'high' });
  });

  it('saves the assignee on blur only when the trimmed name changed', async () => {
    const updateTicket = updated();
    const user = userEvent.setup();
    const { client } = setup({ client: { updateTicket } });
    const assignee = screen.getByLabelText('Assignee');
    await user.type(assignee, '  ');
    await user.tab();
    expect(client.updateTicket).not.toHaveBeenCalled();
    expect(assignee).toHaveValue('');
    await user.type(assignee, ' Dara ');
    expect(client.updateTicket).not.toHaveBeenCalled();
    await user.tab();
    expect(client.updateTicket).toHaveBeenCalledWith(
      'MOB-1',
      { assignee: 'Dara' },
      { assignee: '' },
    );
  });

  it('shows an overdue date in red and clears it', async () => {
    const updateTicket = updated();
    const user = userEvent.setup();
    const detail = makeTicketDetail(listItem(1, STATUS.todo, 0, { due: '2020-01-02' }));
    const { client } = setup({ detail, client: { updateTicket } });
    expect(screen.getByText('Thu, Jan 2, 2020')).toHaveClass('overdue');
    await user.click(screen.getByRole('button', { name: 'Clear due date' }));
    expect(client.updateTicket).toHaveBeenCalledWith('MOB-1', { due: '' });
  });

  it('does not show a done ticket as overdue', () => {
    const detail = makeTicketDetail(listItem(1, STATUS.done, 0, { due: '2020-01-02' }));
    setup({ detail });
    expect(screen.getByText('Thu, Jan 2, 2020')).not.toHaveClass('overdue');
  });

  it('rolls back and explains a failed save', async () => {
    const updateTicket = vi.fn().mockRejectedValue(new ApiError(400, 'invalid_input', 'Nope.'));
    const user = userEvent.setup();
    setup({ client: { updateTicket } });
    await user.click(screen.getByRole('button', { name: /^Priority/ }));
    await user.click(screen.getByRole('option', { name: 'Low' }));
    expect(await screen.findByText('Nope.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Priority/ })).toHaveTextContent('Medium');
  });
});

describe('TicketScreen info and images', () => {
  it('shows the project, the creation date and when it was updated', () => {
    const created = new Date(2026, 9, 2, 12).getTime();
    const detail = makeTicketDetail(
      listItem(1, STATUS.todo, 0, { createdAt: created, updatedAt: Date.now() - 2 * 3600_000 }),
    );
    setup({ detail });
    const details = screen.getByRole('complementary', { name: 'Ticket details' });
    expect(within(details).getByText('Mobile app')).toBeInTheDocument();
    expect(within(details).getByText('Oct 2, 2026')).toBeInTheDocument();
    expect(within(details).getByText('2h ago')).toBeInTheDocument();
  });

  it('shows ticket images and opens them in the viewer', async () => {
    const user = userEvent.setup();
    const images = [attachment('a'), attachment('b'), attachment('c', { activityId: 'x' })];
    setup({ detail: makeTicketDetail(undefined, { attachments: images }) });
    expect(screen.getAllByRole('button', { name: /^Open image/ })).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Open image 2' }));
    const viewer = await screen.findByRole('dialog', { name: 'Image viewer' });
    expect(within(viewer).getByText('2 / 2')).toBeInTheDocument();
  });

  it('removes a ticket image after confirming', async () => {
    const deleteAttachment = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const { client } = setup({
      detail: makeTicketDetail(undefined, { attachments: [attachment('a')] }),
      client: { deleteAttachment },
    });
    await user.click(screen.getByRole('button', { name: 'Remove image 1' }));
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(client.deleteAttachment).toHaveBeenCalledWith('a');
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Open image 1' })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Add files' })).toBeInTheDocument();
  });

  it('keeps the image when its removal fails', async () => {
    const deleteAttachment = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const user = userEvent.setup();
    setup({
      detail: makeTicketDetail(undefined, { attachments: [attachment('a')] }),
      client: { deleteAttachment },
    });
    await user.click(screen.getByRole('button', { name: 'Remove image 1' }));
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(
      await screen.findByText("Can't reach the tracker. Check your connection."),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open image 1' })).toBeInTheDocument();
  });

  it('uploads picked images to the ticket', async () => {
    const shot = attachment('new');
    const uploadAttachment = vi.fn().mockResolvedValue(shot);
    const user = userEvent.setup();
    const { client } = setup({ client: { uploadAttachment } });
    const file = new File(['png'], 'shot.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Add files to ticket'), file);
    await waitFor(() => expect(client.uploadAttachment).toHaveBeenCalled());
    expect(vi.mocked(client.uploadAttachment).mock.calls[0]?.[2]).toBe('MOB-1');
    expect(await screen.findByRole('button', { name: 'Open image 1' })).toBeInTheDocument();
  });
});

describe('TicketScreen navigation', () => {
  it('deletes after confirming, goes back to the project and says so', async () => {
    const deleteTicket = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const { client } = setup({ client: { deleteTicket } });
    await user.click(screen.getByRole('button', { name: 'Delete ticket' }));
    expect(screen.getByRole('alert')).toHaveTextContent("Delete MOB-1? This can't be undone.");
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Delete ticket' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Delete ticket' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(client.deleteTicket).toHaveBeenCalledWith('MOB-1');
    await waitFor(() => expect(location()).toBe('/p/MOB'));
    expect(screen.getByText('MOB-1 deleted')).toBeInTheDocument();
  });

  it('falls back to the project when the ticket does not exist', async () => {
    const getTicket = vi.fn().mockRejectedValue(new ApiError(404, 'not_found', 'Not found.'));
    setup({ seed: false, client: { getTicket } });
    await waitFor(() => expect(location()).toBe('/p/MOB'));
  });

  it('offers a retry when the ticket cannot load', async () => {
    const getTicket = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(makeTicketDetail());
    const user = userEvent.setup();
    setup({ seed: false, client: { getTicket } });
    expect(await screen.findByText("Couldn't load MOB-1")).toBeInTheDocument();
    expect(screen.getByText("Can't reach the tracker. Check your connection.")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByLabelText('Title')).toHaveValue('Ticket 1');
  });

  it('on desktop keeps the details in the side panel, with no bottom bar', () => {
    setup();
    const panel = screen.getByRole('complementary', { name: 'Ticket details' });
    expect(within(panel).getByRole('button', { name: /^Status/ })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Delete ticket' })).toBeInTheDocument();
    expect(within(panel).queryByText('Claude Code')).not.toBeInTheDocument();
    expect(document.querySelector('[data-bottom-bar]')).toBeNull();
  });

  it('on phones has a nav bar, and a bottom bar whose Comment goes to the comment box', async () => {
    const user = userEvent.setup();
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    cleanups.push(() => Reflect.deleteProperty(Element.prototype, 'scrollIntoView'));
    setup({ phone: true });
    expect(screen.getByRole('button', { name: 'Back to Mobile app' })).toBeInTheDocument();
    const bar = document.querySelector<HTMLElement>('[data-bottom-bar]')!;
    await user.click(within(bar).getByRole('button', { name: 'Go to the comment box' }));
    const field = screen.getByRole('textbox', { name: 'Comment' });
    expect(field).toHaveFocus();
    expect(scrolled.mock.contexts[0]).toBe(field.closest('form'));
    await user.click(screen.getByRole('button', { name: 'Back to Mobile app' }));
    await waitFor(() => expect(location()).toBe('/p/MOB'));
  });
});
