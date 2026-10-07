import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '@tracker/client';
import type { Activity } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { isTemporaryId } from '../cache/ticketDetail';
import { queryKeys } from '../queryKeys';
import { deferred } from '../test/deferred';
import { attachment, comment, listItem, makeTicketDetail, STATUS } from '../test/fixtures';
import { cachedTicket, isInvalidated, seedTicket, setupApi } from '../test/render';
import { useAddComment, useDeleteActivity, useUpdateComment } from './comments';

const withComments = () =>
  makeTicketDetail(listItem(1, STATUS.todo, 0), {
    activity: [comment('a1', 'First'), comment('a2', 'Second')],
  });

const ids = (activity: Activity[]) => activity.map((item) => item.id);

describe('useAddComment', () => {
  it('shows a draft at once and swaps in the saved comment', async () => {
    const request = deferred<Activity>();
    const addComment = vi.fn(() => request.promise);
    const { queryClient, wrapper } = setupApi({ addComment });
    seedTicket(queryClient, withComments());
    const { result } = renderHook(() => useAddComment(), { wrapper });
    const image = attachment('img-1');

    act(() => result.current.mutate({ ticketKey: 'MOB-1', text: 'Third', attachments: [image] }));

    await waitFor(() => expect(cachedTicket(queryClient).activity).toHaveLength(3));
    const draft = cachedTicket(queryClient).activity[2]!;
    expect(isTemporaryId(draft.id)).toBe(true);
    expect(draft).toMatchObject({ text: 'Third', attachments: [image], type: 'comment' });
    expect(addComment).toHaveBeenCalledWith('MOB-1', { text: 'Third', attachmentIds: ['img-1'] });

    request.resolve(comment('a3', 'Third'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(ids(cachedTicket(queryClient).activity)).toEqual(['a1', 'a2', 'a3']);
    expect(isInvalidated(queryClient, queryKeys.ticket('MOB-1'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.board('MOB'))).toBe(true);
  });

  it('removes the draft when the comment fails', async () => {
    const { queryClient, wrapper } = setupApi({
      addComment: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    });
    seedTicket(queryClient, withComments());
    const { result } = renderHook(() => useAddComment(), { wrapper });

    act(() => result.current.mutate({ ticketKey: 'MOB-1', text: 'Lost' }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(ids(cachedTicket(queryClient).activity)).toEqual(['a1', 'a2']);
  });
});

describe('useUpdateComment', () => {
  it('edits at once and rolls back on failure', async () => {
    const request = deferred<Activity>();
    const { queryClient, wrapper } = setupApi({ updateComment: vi.fn(() => request.promise) });
    seedTicket(queryClient, withComments());
    const { result } = renderHook(() => useUpdateComment(), { wrapper });

    act(() => result.current.mutate({ ticketKey: 'MOB-1', activityId: 'a2', text: ' Edited ' }));

    await waitFor(() => expect(cachedTicket(queryClient).activity[1]?.text).toBe('Edited'));
    expect(cachedTicket(queryClient).activity[1]?.editedAt).not.toBeNull();

    request.reject(new ApiError(403, 'forbidden', 'Only comments can be edited.'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(cachedTicket(queryClient).activity[1]).toMatchObject({ text: 'Second', editedAt: null });
  });
});

describe('useDeleteActivity', () => {
  it('removes at once and restores on failure', async () => {
    const request = deferred<void>();
    const { queryClient, wrapper } = setupApi({ deleteActivity: vi.fn(() => request.promise) });
    seedTicket(queryClient, withComments());
    const { result } = renderHook(() => useDeleteActivity(), { wrapper });

    act(() => result.current.mutate({ ticketKey: 'MOB-1', activityId: 'a1' }));
    await waitFor(() => expect(ids(cachedTicket(queryClient).activity)).toEqual(['a2']));

    request.reject(new TypeError('Failed to fetch'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(ids(cachedTicket(queryClient).activity)).toEqual(['a1', 'a2']);
  });
});
