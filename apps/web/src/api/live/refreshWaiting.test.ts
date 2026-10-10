import { act, renderHook, waitFor } from '@testing-library/react';
import { ENDED_RUN_STATUSES, type Ticket } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { useUpdateTicket } from '../hooks/ticketEdits';
import { queryKeys } from '../queryKeys';
import { deferred } from '../test/deferred';
import { makeBoard, makeTicketDetail, otherProject } from '../test/fixtures';
import { isInvalidated, setupApi } from '../test/render';
import { endsRun, refreshWaiting } from './refreshWaiting';

function setup(overrides: Parameters<typeof setupApi>[0] = {}) {
  const api = setupApi(overrides);
  api.queryClient.setQueryData(queryKeys.board('MOB'), makeBoard());
  api.queryClient.setQueryData(queryKeys.board('WEB'), { ...makeBoard([]), project: otherProject });
  api.queryClient.setQueryData(queryKeys.ticket('MOB-1'), makeTicketDetail());
  return api;
}

describe('endsRun', () => {
  it('is true for the ways a run ends, not for a run that waits or works', () => {
    expect(ENDED_RUN_STATUSES.every(endsRun)).toBe(true);
    expect(endsRun('queued')).toBe(false);
    expect(endsRun('running')).toBe(false);
  });
});

describe('refreshWaiting', () => {
  it("reads the board of the ticket's project again, and nothing else", () => {
    const { queryClient } = setup();
    refreshWaiting(queryClient, 'p-mob', 't-1');
    expect(isInvalidated(queryClient, queryKeys.board('MOB'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.board('WEB'))).toBe(false);
    expect(isInvalidated(queryClient, queryKeys.ticket('MOB-1'))).toBe(false);
    expect(isInvalidated(queryClient, queryKeys.projects())).toBe(false);
  });

  it('reads nothing for a project no screen has shown', () => {
    const { queryClient } = setup();
    refreshWaiting(queryClient, 'p-unknown', 't-9');
    expect(isInvalidated(queryClient, queryKeys.board('MOB'))).toBe(false);
  });

  it('leaves the board as it is while an edit on it saves; the edit reads it once it settles', async () => {
    const request = deferred<Ticket>();
    const { queryClient, wrapper } = setup({ updateTicket: vi.fn(() => request.promise) });
    const { result } = renderHook(() => useUpdateTicket(), { wrapper });
    act(() => result.current.mutate({ ticketKey: 'MOB-1', input: { title: 'Typing' } }));
    await waitFor(() => expect(queryClient.isMutating()).toBe(1));

    refreshWaiting(queryClient, 'p-mob', 't-1');
    expect(isInvalidated(queryClient, queryKeys.board('MOB'))).toBe(false);

    await act(async () => {
      request.resolve(makeTicketDetail().ticket);
      await request.promise;
    });
    await waitFor(() => expect(isInvalidated(queryClient, queryKeys.board('MOB'))).toBe(true));
  });
});
