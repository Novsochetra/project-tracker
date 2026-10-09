import { act, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Activity, TicketDetail } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import {
  editActivityText,
  removeActivity,
  removeAttachment,
  replaceActivity,
} from '../../src/api/cache/ticketDetail';
import { useDeleteAttachment } from '../../src/api/hooks/attachments';
import { queryKeys } from '../../src/api/queryKeys';
import { attachment, comment, makeTicketDetail } from '../../src/api/test/fixtures';
import { seedTicket, setupApi } from '../../src/api/test/render';
import { serverText } from '../../src/features/ticket/drafts/draftCheck';
import {
  renderTicket,
  type RenderTicketOptions,
} from '../../src/features/ticket/test/renderTicket';
import { hasDrafts } from '../../src/lib/drafts';
import { keepDraft } from '../../src/lib/storedDrafts';
import { skipAnimations } from '../../src/overlays/testing';

// Reviewer 50 and the lead (PT-74): the activity list shows around an entry it can't read, such as
// null, but the cache's comment helpers and the draft check read `id` on every entry. With a null
// entry, Save on an edit of one's own comment sent no PATCH and said "Can't reach the tracker" and
// "Your edit isn't saved yet.", a sent comment's answer failed to replace its draft, and a kept
// edit's check failed as if the tracker were unreachable.

const withNull = (activity: Activity[]): TicketDetail =>
  makeTicketDetail(undefined, { activity: [null, ...activity] as unknown as Activity[] });

const UNREACHABLE = "Can't reach the tracker";
const NOT_SAVED = "Your edit isn't saved yet.";

let cleanups: Array<() => void> = [];
let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
  consoleError.mockRestore();
});

describe('regression: comment helpers pass over an activity entry they cannot read', () => {
  const detail = withNull([
    comment('c1', 'First', { attachments: [attachment('a1')] }),
    comment('c2', 'Next'),
  ]);
  const texts = (next: TicketDetail) =>
    next.activity.map((item) => (item as Activity | null)?.text);

  it('edits, replaces and removes comments and keeps the entry as it came', () => {
    expect(texts(editActivityText(detail, 'c2', 'Changed', 5))).toEqual([
      undefined,
      'First',
      'Changed',
    ]);
    expect(texts(replaceActivity(detail, 'c1', comment('c3', 'Real')))).toEqual([
      undefined,
      'Real',
      'Next',
    ]);
    expect(texts(removeActivity(detail, 'c1'))).toEqual([undefined, 'Next']);
    const withoutFile = removeAttachment(detail, 'a1');
    expect(withoutFile.activity[0]).toBeNull();
    expect(withoutFile.activity[1]?.attachments).toEqual([]);
  });

  it('finds the comment a kept edit is for', () => {
    const draft = {
      ticketKey: 'MOB-1',
      field: 'comment-edit',
      activityId: 'c2',
      base: 'Next',
      text: 'Mine',
    } as const;
    expect(serverText(detail, draft)).toBe('Next');
  });
});

// Reviewer 57 (PT-74): an entry that is an object or an array without an attachments array still
// failed Remove file: no DELETE, and "Can't reach the tracker".
describe('regression: removing a file beside activity entries it cannot read', () => {
  const odd = [{}, [1, 2], { type: 'event', text: 'ghost' }, { attachments: [null] }];
  const detail = makeTicketDetail(undefined, {
    attachments: [attachment('a1'), attachment('a2')],
    activity: [...odd, comment('c1', 'First', { attachments: [attachment('a3')] })] as never,
  });

  it('removes the file and keeps those entries as they came', () => {
    const left = removeAttachment(detail, 'a1');
    expect(left.attachments.map(({ id }) => id)).toEqual(['a2']);
    expect(left.activity.slice(0, odd.length)).toEqual(odd);
    expect(removeAttachment(detail, 'a3').activity.at(-1)?.attachments).toEqual([]);
  });

  it('sends the DELETE', async () => {
    const deleteAttachment = vi.fn().mockResolvedValue(undefined);
    const { queryClient, wrapper } = setupApi({ deleteAttachment });
    seedTicket(queryClient, detail);
    const { result } = renderHook(() => useDeleteAttachment(), { wrapper });

    await act(() => result.current.mutateAsync({ attachmentId: 'a1', ticketKey: 'MOB-1' }));
    expect(deleteAttachment).toHaveBeenCalledWith('a1');
    const cached = queryClient.getQueryData<TicketDetail>(queryKeys.ticket('MOB-1'));
    expect(cached?.attachments.map(({ id }) => id)).toEqual(['a2']);
  });
});

describe('regression: comments on a ticket with an activity entry it cannot read', () => {
  function open(detail: TicketDetail, client: RenderTicketOptions['client'] = {}) {
    const updateComment = vi.fn((activityId: string, { text }: { text: string }) =>
      Promise.resolve(comment(activityId, text.trim(), { editedAt: 2 })),
    );
    const addComment = vi.fn((_key: string, { text }: { text?: string }) =>
      Promise.resolve(comment('c9', text ?? '', { createdAt: 3 })),
    );
    const rendered = renderTicket({ detail, client: { updateComment, addComment, ...client } });
    cleanups.push(rendered.restorePhone);
    return { updateComment, addComment };
  }

  it('saves an edit of the user’s own comment', async () => {
    const user = userEvent.setup();
    const { updateComment } = open(withNull([comment('c1', 'First thought')]));
    await user.click(screen.getByRole('button', { name: 'Comment options' }));
    await user.click(screen.getByRole('button', { name: 'Edit comment' }));
    await user.type(screen.getByLabelText('Edit comment'), ', mine');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByLabelText('Edit comment')).toBeNull());
    expect(updateComment).toHaveBeenCalledWith(
      'c1',
      { text: 'First thought, mine' },
      { text: 'First thought' },
    );
    const log = screen.getByRole('region', { name: 'Activity' });
    expect(within(log).getByText('First thought, mine')).toBeInTheDocument();
    expect(screen.queryByText(UNREACHABLE)).toBeNull();
    expect(screen.queryByText(NOT_SAVED)).toBeNull();
  });

  it('puts a sent comment in place of its draft', async () => {
    const user = userEvent.setup();
    const { addComment } = open(withNull([comment('c1', 'First thought')]));
    await user.type(screen.getByLabelText('Comment'), 'A new one');
    await user.click(screen.getByRole('button', { name: 'Comment' }));

    await waitFor(() => expect(addComment).toHaveBeenCalled());
    const log = screen.getByRole('region', { name: 'Activity' });
    // A draft has no menu until the tracker's answer takes its place.
    await waitFor(() =>
      expect(within(log).getAllByRole('button', { name: 'Comment options' })).toHaveLength(2),
    );
    expect(within(log).getAllByText('A new one')).toHaveLength(1);
    expect(screen.queryByText(UNREACHABLE)).toBeNull();
  });

  it('checks and saves an edit kept from an earlier visit', async () => {
    const user = userEvent.setup();
    keepDraft(
      'comment-edit:c1',
      { ticketKey: 'MOB-1', field: 'comment-edit', activityId: 'c1', text: 'First thought, mine' },
      'First thought',
    );
    const detail = withNull([comment('c1', 'First thought')]);
    const { updateComment } = open(detail, { getTicket: vi.fn().mockResolvedValue(detail) });
    expect(screen.getByLabelText('Edit comment')).toHaveValue('First thought, mine');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByLabelText('Edit comment')).toBeNull());
    expect(updateComment).toHaveBeenCalledWith(
      'c1',
      { text: 'First thought, mine' },
      { text: 'First thought' },
    );
    expect(screen.queryByText(UNREACHABLE)).toBeNull();
    await waitFor(() => expect(hasDrafts()).toBe(false));
  });
});
