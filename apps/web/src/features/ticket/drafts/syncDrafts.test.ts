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

const ticket = (num: number, fields: { title?: string; description?: string } = {}) =>
  makeTicketDetail(listItem(num, STATUS.todo, 0, fields), {
    activity: [comment('c1', 'First thought')],
  });

const keep = (target: DraftTarget, text: string, base: string) =>
  keepDraft(draftIdOf(target), { ...target, text }, base);

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
    keep(
      { ticketKey: 'MOB-1', field: 'comment-edit', activityId: 'c1' },
      'Second',
      'First thought',
    );
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
    keep(
      { ticketKey: 'MOB-1', field: 'comment-edit', activityId: 'c1' },
      'Second',
      'First thought',
    );
    const sync = deps({ 'MOB-1': ticket(1) });
    vi.mocked(sync.save).mockRejectedValue(NOT_FOUND);
    await syncDrafts(sync);
    expect(keptIds()).toEqual([]);
  });

  it('never sends the comment box and leaves drafts on screen to their field', async () => {
    keep({ ticketKey: 'MOB-1', field: 'comment' }, 'Half a thought', '');
    keep({ ticketKey: 'MOB-1', field: 'title' }, 'Typed on screen', 'Ticket 1');
    const retry = vi.fn();
    const { unmount } = renderHook(() => useLiveDraft('title:MOB-1', retry));
    retry.mockClear();
    const sync = deps({ 'MOB-1': ticket(1) });
    await syncDrafts(sync);
    expect(retry).toHaveBeenCalledTimes(1);
    expect(sync.fetchTicket).not.toHaveBeenCalled();
    expect(keptIds()).toEqual(['comment:MOB-1', 'title:MOB-1']);
    unmount();
  });

  it('stops at the first request that cannot reach the tracker and keeps the rest', async () => {
    keep({ ticketKey: 'MOB-1', field: 'title' }, 'One', 'Ticket 1');
    keep({ ticketKey: 'MOB-2', field: 'title' }, 'Two', 'Ticket 2');
    const sync = deps({ 'MOB-1': ticket(1), 'MOB-2': ticket(2) });
    vi.mocked(sync.save).mockRejectedValue(NETWORK_DOWN);
    await syncDrafts(sync);
    expect(sync.fetchTicket).toHaveBeenCalledTimes(1);
    expect(keptIds()).toEqual(['title:MOB-1', 'title:MOB-2']);
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
