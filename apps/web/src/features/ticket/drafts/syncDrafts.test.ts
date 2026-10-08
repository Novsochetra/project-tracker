import { renderHook } from '@testing-library/react';
import { ApiError } from '@tracker/client';
import type { TicketDetail } from '@tracker/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred } from '../../../api/test/deferred';
import { comment, listItem, makeTicketDetail, STATUS } from '../../../api/test/fixtures';
import { draftIdOf, keepDraft, storedDrafts, type DraftTarget } from '../../../lib/storedDrafts';
import { useLiveDraft } from './liveDrafts';
import { runDraftSync, syncDrafts, type DraftSyncDeps } from './syncDrafts';

const NOT_FOUND = new ApiError(404, 'not_found', 'Not found');
const NETWORK_DOWN = new TypeError('Failed to fetch');
const SIGNED_OUT = new ApiError(401, 'unauthorized', 'Sign in');
const SERVER_DOWN = new ApiError(503, 'unavailable', 'Try again');
const REFUSED = new ApiError(400, 'invalid_input', 'Too long');

const ticket = (num: number, fields: { title?: string; description?: string } = {}) =>
  makeTicketDetail(listItem(num, STATUS.todo, 0, fields), {
    activity: [comment('c1', 'First thought')],
  });

const keep = (target: DraftTarget, text: string, base: string) =>
  keepDraft(draftIdOf(target), { ...target, text }, base);

// An edit whose Save failed; only those are sent for the user.
const keepSubmittedEdit = (activityId: string, text: string, base: string) =>
  keepDraft(
    draftIdOf({ ticketKey: 'MOB-1', field: 'comment-edit', activityId }),
    { ticketKey: 'MOB-1', field: 'comment-edit', activityId, text, submitted: true },
    base,
  );

function deps(tickets: Record<string, TicketDetail | Error>): DraftSyncDeps {
  return {
    fetchTicket: vi.fn((key: string) => {
      const answer = tickets[key] ?? new Error(`No answer for ${key}`);
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    }),
    save: vi.fn(() => Promise.resolve()),
  };
}

const keptIds = () => storedDrafts().map(([id]) => id);

beforeEach(() => {
  localStorage.clear();
});

describe('syncDrafts', () => {
  it('saves drafts left in closed tickets while the tracker still has what they replaced', async () => {
    keep({ ticketKey: 'MOB-1', field: 'title' }, 'Fix the login', 'Ticket 1');
    keepSubmittedEdit('c1', 'Second', 'First thought');
    const sync = deps({ 'MOB-1': ticket(1) });
    expect(await syncDrafts(sync)).toEqual({ changed: [] });
    expect(sync.fetchTicket).toHaveBeenCalledTimes(1);
    expect(sync.save).toHaveBeenCalledWith(expect.objectContaining({ text: 'Fix the login' }));
    expect(sync.save).toHaveBeenCalledWith(expect.objectContaining({ text: 'Second' }));
    expect(keptIds()).toEqual([]);
  });

  it('keeps and reports a draft whose field someone else changed meanwhile', async () => {
    keep({ ticketKey: 'MOB-1', field: 'description' }, 'Mine', '');
    const sync = deps({ 'MOB-1': ticket(1, { description: 'Theirs' }) });
    const report = await syncDrafts(sync);
    expect(report.changed.map(([id]) => id)).toEqual(['description:MOB-1']);
    expect(sync.save).not.toHaveBeenCalled();
    expect(keptIds()).toEqual(['description:MOB-1']);
  });

  it('drops drafts the tracker already has or that have nothing left to save into', async () => {
    keep({ ticketKey: 'MOB-1', field: 'title' }, 'Ticket 1', 'Old');
    keep({ ticketKey: 'MOB-1', field: 'comment-edit', activityId: 'gone' }, 'Edit', 'Was');
    keep({ ticketKey: 'MOB-2', field: 'title' }, 'Deleted ticket', 'Ticket 2');
    const sync = deps({ 'MOB-1': ticket(1), 'MOB-2': NOT_FOUND });
    await syncDrafts(sync);
    expect(sync.save).not.toHaveBeenCalled();
    expect(keptIds()).toEqual([]);
  });

  it('drops a draft whose save finds the comment deleted', async () => {
    keepSubmittedEdit('c1', 'Second', 'First thought');
    const sync = deps({ 'MOB-1': ticket(1) });
    vi.mocked(sync.save).mockRejectedValue(NOT_FOUND);
    await syncDrafts(sync);
    expect(keptIds()).toEqual([]);
  });

  it('leaves drafts on screen to their field', async () => {
    keep({ ticketKey: 'MOB-1', field: 'title' }, 'Typed on screen', 'Ticket 1');
    const retry = vi.fn();
    const { unmount } = renderHook(() => useLiveDraft('title:MOB-1', retry));
    retry.mockClear();
    const sync = deps({ 'MOB-1': ticket(1) });
    await syncDrafts(sync);
    expect(retry).toHaveBeenCalledTimes(1);
    expect(sync.fetchTicket).not.toHaveBeenCalled();
    expect(keptIds()).toEqual(['title:MOB-1']);
    unmount();
  });

  it('never sends the comment box or an edit nobody saved, and drops them once they are gone', async () => {
    keep({ ticketKey: 'MOB-1', field: 'comment' }, 'Half a thought', '');
    keep(
      { ticketKey: 'MOB-1', field: 'comment-edit', activityId: 'c1' },
      'Unsent',
      'First thought',
    );
    keep({ ticketKey: 'MOB-1', field: 'comment-edit', activityId: 'gone' }, 'Unsent', 'Was');
    keep({ ticketKey: 'MOB-2', field: 'comment' }, 'In a deleted ticket', '');
    const sync = deps({ 'MOB-1': ticket(1), 'MOB-2': NOT_FOUND });
    await syncDrafts(sync);
    expect(sync.save).not.toHaveBeenCalled();
    expect(keptIds()).toEqual(['comment:MOB-1', 'comment-edit:c1']);
  });

  it.each([
    ['no answer', NETWORK_DOWN],
    ['a 401', SIGNED_OUT],
    ['a 5xx', SERVER_DOWN],
  ])('stops when a save gets %s and keeps the rest', async (_answer, error) => {
    keep({ ticketKey: 'MOB-1', field: 'title' }, 'One', 'Ticket 1');
    keep({ ticketKey: 'MOB-2', field: 'title' }, 'Two', 'Ticket 2');
    const sync = deps({ 'MOB-1': ticket(1), 'MOB-2': ticket(2) });
    vi.mocked(sync.save).mockRejectedValue(error);
    await syncDrafts(sync);
    expect(sync.fetchTicket).toHaveBeenCalledTimes(1);
    expect(keptIds()).toEqual(['title:MOB-1', 'title:MOB-2']);
  });

  it('stops when reading a ticket cannot reach the tracker', async () => {
    keep({ ticketKey: 'MOB-1', field: 'title' }, 'One', 'Ticket 1');
    keep({ ticketKey: 'MOB-2', field: 'title' }, 'Two', 'Ticket 2');
    const sync = deps({ 'MOB-1': SERVER_DOWN, 'MOB-2': ticket(2) });
    await syncDrafts(sync);
    expect(sync.fetchTicket).toHaveBeenCalledTimes(1);
    expect(keptIds()).toEqual(['title:MOB-1', 'title:MOB-2']);
  });

  it('keeps a draft the tracker refuses and goes on with the others', async () => {
    keep({ ticketKey: 'MOB-1', field: 'title' }, 'One', 'Ticket 1');
    keep({ ticketKey: 'MOB-2', field: 'title' }, 'Two', 'Ticket 2');
    const sync = deps({ 'MOB-1': ticket(1), 'MOB-2': ticket(2) });
    vi.mocked(sync.save).mockRejectedValueOnce(REFUSED);
    await syncDrafts(sync);
    expect(sync.save).toHaveBeenCalledTimes(2);
    expect(keptIds()).toEqual(['title:MOB-1']);
  });

  it('sends a refused draft again only once its text changed', async () => {
    const target = { ticketKey: 'MOB-1', field: 'description' } as const;
    keep(target, 'Far too long', '');
    const sync = deps({ 'MOB-1': ticket(1) });
    vi.mocked(sync.save).mockRejectedValue(REFUSED);
    await syncDrafts(sync);
    await syncDrafts(sync);
    expect(sync.save).toHaveBeenCalledTimes(1);
    keep(target, 'Short', '');
    await syncDrafts(sync);
    expect(sync.save).toHaveBeenCalledTimes(2);
    expect(sync.fetchTicket).toHaveBeenCalledTimes(3);
  });

  it('reads only the closed tickets in the projects a change touched', async () => {
    keep({ ticketKey: 'MOB-1', field: 'comment' }, 'Unsent', '');
    keep({ ticketKey: 'WEB-1', field: 'comment' }, 'Unsent too', '');
    keep({ ticketKey: 'WEB-2', field: 'title' }, 'Open here', 'Ticket 2');
    const retry = vi.fn();
    const { unmount } = renderHook(() => useLiveDraft('title:WEB-2', retry));
    retry.mockClear();
    const sync = deps({ 'MOB-1': ticket(1), 'WEB-1': ticket(1) });
    await syncDrafts(sync, new Set(['WEB']));
    expect(sync.fetchTicket).toHaveBeenCalledTimes(1);
    expect(sync.fetchTicket).toHaveBeenCalledWith('WEB-1');
    expect(retry).not.toHaveBeenCalled();
    unmount();
  });
});

describe('runDraftSync', () => {
  it('runs one sync at a time and once more when asked during a run', async () => {
    const first = deferred<void>();
    const sync = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    runDraftSync(sync);
    runDraftSync(sync);
    runDraftSync(sync);
    expect(sync).toHaveBeenCalledTimes(1);
    first.resolve();
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sync).toHaveBeenCalledTimes(2);
  });
});
