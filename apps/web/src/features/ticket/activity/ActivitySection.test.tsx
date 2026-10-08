import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HUMAN, UNSUPPORTED_ATTACHMENT_MESSAGE, type Activity } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachment, comment, makeTicketDetail } from '../../../api/test/fixtures';
import { deferred } from '../../../api/test/deferred';
import { hasDrafts } from '../../../lib/drafts';
import { skipAnimations } from '../../../overlays/testing';
import { renderTicket } from '../test/renderTicket';

const CLAUDE = { kind: 'agent', name: 'Claude' } as const;
const NOW = Date.now();

let cleanups: Array<() => void> = [];

beforeEach(() => {
  // Unsaved text outlives the screen in the drafts store, so each test starts without any.
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

function setup(activity: Activity[], options: Parameters<typeof renderTicket>[0] = {}) {
  const rendered = renderTicket({ detail: makeTicketDetail(undefined, { activity }), ...options });
  cleanups.push(rendered.restorePhone);
  return rendered;
}

const log = () => screen.getByRole('region', { name: 'Activity' });
const event = (id: string, text: string, extra: Partial<Activity> = {}) =>
  comment(id, text, { type: 'event', createdAt: NOW - 60_000, ...extra });

describe('activity items', () => {
  it('lists events oldest first with who did it', () => {
    setup([
      event('e2', 'picked up the ticket and moved it to In progress', {
        actor: CLAUDE,
        createdAt: NOW - 30_000,
      }),
      event('e1', 'created the ticket', { createdAt: NOW - 3 * 3600_000 }),
    ]);
    expect(within(log()).getByRole('heading', { name: 'Activity' })).toBeInTheDocument();
    const text = log().textContent ?? '';
    expect(text).toContain('You created the ticket · 3h ago');
    expect(text).toContain('Claude picked up the ticket and moved it to In progress · just now');
    expect(text.indexOf('created the ticket')).toBeLessThan(text.indexOf('picked up'));
  });

  it('shows reports and reviews by agent name', () => {
    setup([
      comment('r1', 'TICKET: MOB-1\nSTATUS: done', { type: 'report', actor: CLAUDE }),
      comment('r2', 'Pasted by hand', { type: 'report', actor: HUMAN }),
      comment('v1', 'Works; tests cover expiry.', {
        type: 'review',
        actor: CLAUDE,
        review: { verdict: 'approved', rating: 4 },
      }),
      comment('v2', 'Missing a test.', {
        type: 'review',
        actor: CLAUDE,
        review: { verdict: 'changes_requested', rating: 2 },
      }),
    ]);
    const activity = within(log());
    expect(activity.getByText('Claude report')).toBeInTheDocument();
    expect(activity.getByText('Claude Code report')).toBeInTheDocument();
    expect(activity.getAllByText('Claude reviewed')).toHaveLength(2);
    expect(activity.getByText('Approved')).toBeInTheDocument();
    expect(activity.getByText('Changes requested')).toBeInTheDocument();
    expect(activity.getByRole('img', { name: 'Rated 4 out of 5' })).toBeInTheDocument();
    expect(activity.getByText('Works; tests cover expiry.')).toBeInTheDocument();
    expect(activity.getAllByRole('button', { name: 'Report options' })).toHaveLength(2);
    expect(activity.getAllByRole('button', { name: 'Review options' })).toHaveLength(2);
  });

  it('marks edited comments and shows their images', async () => {
    const user = userEvent.setup();
    setup([
      comment('c1', 'See the screenshot', {
        editedAt: NOW,
        attachments: [attachment('img', { activityId: 'c1' })],
      }),
    ]);
    expect(log()).toHaveTextContent('edited');
    await user.click(within(log()).getByRole('button', { name: 'Open image 1' }));
    expect(screen.getByRole('dialog', { name: 'Image viewer' })).toBeInTheDocument();
  });

  it('deletes a report after confirming', async () => {
    const deleteActivity = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const { client } = setup([comment('r1', 'TICKET: MOB-1', { type: 'report', actor: CLAUDE })], {
      client: { deleteActivity },
    });
    await user.click(screen.getByRole('button', { name: 'Report options' }));
    expect(screen.queryByRole('button', { name: 'Edit report' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete report' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Report options' })).toHaveFocus();
    expect(client.deleteActivity).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Report options' }));
    await user.click(screen.getByRole('button', { name: 'Delete report' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Delete this report? This can't be undone.",
    );
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(client.deleteActivity).toHaveBeenCalledWith('r1');
    expect(screen.queryByText('Claude report')).not.toBeInTheDocument();
  });
});

describe('comments', () => {
  it('adds a comment, clears the box and shows a dimmed draft until it is saved', async () => {
    const saved = deferred<Activity>();
    const addComment = vi.fn().mockReturnValue(saved.promise);
    const user = userEvent.setup();
    const { client } = setup([], { client: { addComment } });
    const box = screen.getByLabelText('Comment');
    const send = screen.getByRole('button', { name: 'Comment' });
    expect(send).toBeDisabled();
    await user.type(box, '  First thought  ');
    await user.click(send);
    expect(client.addComment).toHaveBeenCalledWith('MOB-1', {
      text: 'First thought',
      attachmentIds: [],
    });
    expect(box).toHaveValue('');
    const draft = within(log()).getByText('First thought').closest('article');
    expect(draft).toHaveClass('draft');
    expect(within(log()).queryByRole('button', { name: 'Comment options' })).toBeNull();
    saved.resolve(comment('c1', 'First thought'));
    await waitFor(() =>
      expect(within(log()).getByRole('button', { name: 'Comment options' })).toBeInTheDocument(),
    );
  });

  it('keeps app updates from reloading over an unsent comment', async () => {
    const addComment = vi.fn().mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    setup([], { client: { addComment } });
    await user.type(screen.getByLabelText('Comment'), 'Half a thought');
    expect(hasDrafts()).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Comment' }));
    expect(hasDrafts()).toBe(false);
  });

  it('submits with Cmd+Enter', async () => {
    const addComment = vi.fn().mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    const { client } = setup([], { client: { addComment } });
    await user.type(screen.getByLabelText('Comment'), 'Quick note{Meta>}{Enter}{/Meta}');
    expect(client.addComment).toHaveBeenCalledWith('MOB-1', {
      text: 'Quick note',
      attachmentIds: [],
    });
  });

  it('hands the comment back when it cannot be saved', async () => {
    const addComment = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const user = userEvent.setup();
    setup([], { client: { addComment } });
    const box = screen.getByLabelText('Comment');
    await user.type(box, 'Lost?');
    await user.click(screen.getByRole('button', { name: 'Comment' }));
    await waitFor(() => expect(box).toHaveValue('Lost?'));
    expect(screen.getByText("Can't reach the tracker. Check your connection.")).toBeInTheDocument();
  });

  it('edits a comment inline from the desktop menu', async () => {
    const saved = deferred<Activity>();
    const updateComment = vi.fn().mockReturnValue(saved.promise);
    const user = userEvent.setup();
    const { client } = setup([comment('c1', 'First thought')], { client: { updateComment } });
    await user.click(screen.getByRole('button', { name: 'Comment options' }));
    await user.click(screen.getByRole('button', { name: 'Edit comment' }));
    const editor = screen.getByLabelText('Edit comment');
    expect(editor).toHaveFocus();
    await user.clear(editor);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.type(editor, 'Second thought');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(client.updateComment).toHaveBeenCalledWith('c1', { text: 'Second thought' });
    expect(editor).toBeInTheDocument();
    saved.resolve(comment('c1', 'Second thought', { editedAt: NOW }));
    await waitFor(() => expect(screen.queryByLabelText('Edit comment')).not.toBeInTheDocument());
    expect(within(log()).getByText('Second thought')).toBeInTheDocument();
    expect(log()).toHaveTextContent('edited');
    expect(screen.getByRole('button', { name: 'Comment options' })).toHaveFocus();
  });

  it('keeps what is typed while an edit is saving', async () => {
    const saved = deferred<Activity>();
    const updateComment = vi.fn().mockReturnValue(saved.promise);
    const user = userEvent.setup();
    const { queryClient } = setup([comment('c1', 'First thought')], { client: { updateComment } });
    await user.click(screen.getByRole('button', { name: 'Comment options' }));
    await user.click(screen.getByRole('button', { name: 'Edit comment' }));
    const editor = screen.getByLabelText('Edit comment');
    await user.type(editor, '!');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.type(editor, '!');
    saved.resolve(comment('c1', 'First thought!', { editedAt: NOW }));
    await waitFor(() => expect(queryClient.isMutating()).toBe(0));
    expect(screen.getByLabelText('Edit comment')).toHaveValue('First thought!!');
    expect(hasDrafts()).toBe(true);
  });

  it('reopens the editor with the edit when a save left behind fails', async () => {
    const saved = deferred<Activity>();
    const updateComment = vi.fn().mockReturnValue(saved.promise);
    const user = userEvent.setup();
    setup([comment('c1', 'First thought')], { client: { updateComment } });
    await user.click(screen.getByRole('button', { name: 'Comment options' }));
    await user.click(screen.getByRole('button', { name: 'Edit comment' }));
    await user.type(screen.getByLabelText('Edit comment'), ' revised');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Edit comment')).not.toBeInTheDocument();
    saved.reject(new TypeError('Failed to fetch'));
    expect(await screen.findByLabelText('Edit comment')).toHaveValue('First thought revised');
    expect(screen.getByText("Your edit isn't saved yet.")).toBeInTheDocument();
  });

  it('cancels an edit with Escape', async () => {
    const user = userEvent.setup();
    const { client } = setup([comment('c1', 'First thought')]);
    await user.click(screen.getByRole('button', { name: 'Comment options' }));
    await user.click(screen.getByRole('button', { name: 'Edit comment' }));
    await user.type(screen.getByLabelText('Edit comment'), ' and more{Escape}');
    expect(screen.queryByLabelText('Edit comment')).not.toBeInTheDocument();
    expect(log()).toHaveTextContent('First thought');
    expect(client.updateComment).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Comment options' })).toHaveFocus();
  });

  it('edits and deletes from the action sheet on phones', async () => {
    const deleteActivity = vi.fn().mockResolvedValue(undefined);
    const updateComment = vi
      .fn()
      .mockResolvedValue(comment('c1', 'First thought!', { editedAt: NOW }));
    const user = userEvent.setup();
    const { client } = setup([comment('c1', 'First thought')], {
      phone: true,
      client: { deleteActivity, updateComment },
    });
    await user.click(screen.getByRole('button', { name: 'Comment options' }));
    const sheet = screen.getByRole('dialog', { name: 'Comment options' });
    await user.click(within(sheet).getByRole('button', { name: 'Edit comment' }));
    await user.type(screen.getByLabelText('Edit comment'), '!');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(client.updateComment).toHaveBeenCalledWith('c1', { text: 'First thought!' });

    await user.click(await screen.findByRole('button', { name: 'Comment options' }));
    const again = screen.getByRole('dialog', { name: 'Comment options' });
    await user.click(within(again).getByRole('button', { name: 'Delete comment' }));
    expect(again).toHaveTextContent("Delete this comment? This can't be undone.");
    await user.click(within(again).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(client.deleteActivity).toHaveBeenCalledWith('c1'));
  });

  it('attaches uploaded images and waits for uploads before sending', async () => {
    const upload = deferred<ReturnType<typeof attachment>>();
    const uploadAttachment = vi.fn().mockReturnValue(upload.promise);
    const addComment = vi.fn().mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    const { client } = setup([], { client: { uploadAttachment, addComment } });
    const file = new File(['png'], 'shot.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Attach files to comment'), file);
    expect(
      await screen.findByRole('progressbar', { name: 'Uploading shot.png' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comment' })).toBeDisabled();
    expect(vi.mocked(client.uploadAttachment).mock.calls[0]?.[2]).toBeUndefined();

    upload.resolve(attachment('shot', { ticketId: null }));
    const send = screen.getByRole('button', { name: 'Comment' });
    await waitFor(() => expect(send).toBeEnabled());
    expect(screen.getByRole('img', { name: 'Image 1' })).toBeInTheDocument();
    await user.click(send);
    expect(client.addComment).toHaveBeenCalledWith('MOB-1', { text: '', attachmentIds: ['shot'] });
    expect(within(log()).getByRole('button', { name: 'Open image 1' })).toBeInTheDocument();
  });

  it('removes a pending image and tells the server to drop it', async () => {
    const uploadAttachment = vi.fn().mockResolvedValue(attachment('shot', { ticketId: null }));
    const deleteAttachment = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const { client } = setup([], { client: { uploadAttachment, deleteAttachment } });
    const file = new File(['png'], 'shot.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Attach files to comment'), file);
    await user.click(await screen.findByRole('button', { name: 'Remove image 1' }));
    expect(client.deleteAttachment).toHaveBeenCalledWith('shot');
    expect(screen.getByRole('button', { name: 'Comment' })).toBeDisabled();
  });

  it('refuses files the tracker does not store', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { client } = setup([]);
    const file = new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' });
    await user.upload(screen.getByLabelText('Attach files to comment'), file);
    expect(screen.getByText(UNSUPPORTED_ATTACHMENT_MESSAGE)).toBeInTheDocument();
    expect(client.uploadAttachment).not.toHaveBeenCalled();
  });

  it('attaches a text file to a comment', async () => {
    const notes = attachment('notes', {
      ticketId: null,
      fileName: 'notes.txt',
      mimeType: 'text/plain',
    });
    const uploadAttachment = vi.fn().mockResolvedValue(notes);
    const addComment = vi.fn().mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    const { client } = setup([], { client: { uploadAttachment, addComment } });
    const file = new File(['steps'], 'notes.txt', { type: 'text/plain' });
    await user.upload(screen.getByLabelText('Attach files to comment'), file);
    const send = screen.getByRole('button', { name: 'Comment' });
    await waitFor(() => expect(send).toBeEnabled());
    await user.click(send);
    expect(client.addComment).toHaveBeenCalledWith('MOB-1', { text: '', attachmentIds: ['notes'] });
    expect(within(log()).getByRole('button', { name: 'Open notes.txt' })).toBeInTheDocument();
  });
});
