import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Ticket } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isLiveRefreshPending } from '../live/refreshPending';
import { queryKeys } from '../queryKeys';
import { deferred } from '../test/deferred';
import { makeBoard, makeTicketDetail, otherProject, project, summaryOf } from '../test/fixtures';
import { MockEventSource } from '../test/mockEventSource';
import { isInvalidated, setupApi } from '../test/render';
import { useLiveUpdates } from './live';
import { useUpdateTicket } from './ticketEdits';

const mobTicketChanged = { type: 'changed', projectId: 'p-mob', ticketId: 't-1' };

function seed(queryClient: QueryClient) {
  queryClient.setQueryData(queryKeys.projects(), [summaryOf(project), summaryOf(otherProject)]);
  queryClient.setQueryData(queryKeys.board('MOB'), makeBoard());
  queryClient.setQueryData(queryKeys.board('WEB'), { ...makeBoard([]), project: otherProject });
  queryClient.setQueryData(queryKeys.ticket('MOB-1'), makeTicketDetail());
  queryClient.setQueryData(queryKeys.session(), { authRequired: false, authenticated: true });
}

describe('useLiveUpdates', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refreshes the list and the cached board and ticket the event points at', () => {
    const { queryClient, wrapper } = setupApi();
    seed(queryClient);
    renderHook(() => useLiveUpdates(), { wrapper });

    act(() => MockEventSource.latest().emit(mobTicketChanged));

    expect(MockEventSource.latest().url).toBe('/api/events');
    expect(isInvalidated(queryClient, queryKeys.projects())).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.board('MOB'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.ticket('MOB-1'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.board('WEB'))).toBe(false);
    expect(isInvalidated(queryClient, queryKeys.session())).toBe(false);
  });

  it('refreshes the runs of the ticket a run event names and the helpers, nothing else', () => {
    const { queryClient, wrapper } = setupApi();
    seed(queryClient);
    queryClient.setQueryData(queryKeys.ticketRuns('MOB-1'), []);
    queryClient.setQueryData(queryKeys.ticketRuns('MOB-3'), []);
    queryClient.setQueryData(queryKeys.runners(), []);
    renderHook(() => useLiveUpdates(), { wrapper });

    const run = { type: 'run', runId: 'r-1', runnerId: 'h-1', projectId: 'p-mob', ticketId: 't-1' };
    act(() => MockEventSource.latest().emit({ ...run, status: 'running' }, 'run'));

    expect(isInvalidated(queryClient, queryKeys.ticketRuns('MOB-1'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.runners())).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.ticketRuns('MOB-3'))).toBe(false);
    expect(isInvalidated(queryClient, queryKeys.ticket('MOB-1'))).toBe(false);
    expect(isInvalidated(queryClient, queryKeys.board('MOB'))).toBe(false);
    expect(isInvalidated(queryClient, queryKeys.projects())).toBe(false);
  });

  it('refreshes the chat a run event names and the chat lists, but no ticket', () => {
    const { queryClient, wrapper } = setupApi();
    seed(queryClient);
    queryClient.setQueryData(queryKeys.ticketRuns('MOB-1'), []);
    queryClient.setQueryData(queryKeys.chats('MOB'), []);
    queryClient.setQueryData(queryKeys.chat('c-1'), null);
    queryClient.setQueryData(queryKeys.chat('c-2'), null);
    renderHook(() => useLiveUpdates(), { wrapper });

    const ask = { type: 'run', runId: 'r-2', runnerId: 'h-1', projectId: 'p-mob', ticketId: null };
    act(() => MockEventSource.latest().emit({ ...ask, chatId: 'c-1', status: 'done' }, 'run'));

    expect(isInvalidated(queryClient, queryKeys.chat('c-1'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.chats('MOB'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.chat('c-2'))).toBe(false);
    expect(isInvalidated(queryClient, queryKeys.ticketRuns('MOB-1'))).toBe(false);
    expect(isInvalidated(queryClient, queryKeys.board('MOB'))).toBe(false);
  });

  it('refreshes every shown ticket run for a ticket it has not cached, as one made from a chat', () => {
    const { queryClient, wrapper } = setupApi();
    seed(queryClient);
    queryClient.setQueryData(queryKeys.ticketRuns('MOB-9'), []);
    renderHook(() => useLiveUpdates(), { wrapper });

    const run = { type: 'run', runId: 'r-3', runnerId: 'h-1', projectId: 'p-mob', chatId: null };
    act(() => MockEventSource.latest().emit({ ...run, ticketId: 't-9', status: 'queued' }, 'run'));

    expect(isInvalidated(queryClient, queryKeys.ticketRuns('MOB-9'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.ticket('MOB-1'))).toBe(false);
  });

  it('reads the new steps of the run a step event names, and nothing else', () => {
    const { queryClient, wrapper } = setupApi();
    seed(queryClient);
    queryClient.setQueryData(queryKeys.runSteps('r-1'), []);
    queryClient.setQueryData(queryKeys.runSteps('r-2'), []);
    queryClient.setQueryData(queryKeys.ticketRuns('MOB-1'), []);
    queryClient.setQueryData(queryKeys.chat('c-1'), null);
    renderHook(() => useLiveUpdates(), { wrapper });

    const step = { type: 'run-step', runId: 'r-1', projectId: 'p-mob', ticketId: 't-1', count: 3 };
    act(() => MockEventSource.latest().emit({ ...step, chatId: null }, 'run-step'));

    expect(isInvalidated(queryClient, queryKeys.runSteps('r-1'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.runSteps('r-2'))).toBe(false);
    expect(isInvalidated(queryClient, queryKeys.ticketRuns('MOB-1'))).toBe(false);
    expect(isInvalidated(queryClient, queryKeys.ticket('MOB-1'))).toBe(false);
    expect(isInvalidated(queryClient, queryKeys.chat('c-1'))).toBe(false);
    expect(isInvalidated(queryClient, queryKeys.projects())).toBe(false);
  });

  it('reads the requests of the run a request event names, and its chat list', () => {
    const { queryClient, wrapper } = setupApi();
    seed(queryClient);
    queryClient.setQueryData(queryKeys.runRequests('r-1'), []);
    queryClient.setQueryData(queryKeys.runRequests('r-2'), []);
    queryClient.setQueryData(queryKeys.runSteps('r-1'), []);
    queryClient.setQueryData(queryKeys.chats('MOB'), []);
    queryClient.setQueryData(queryKeys.ticket('MOB-1'), null);
    renderHook(() => useLiveUpdates(), { wrapper });

    const request = { type: 'run-request', runId: 'r-1', requestId: 'q-1', projectId: 'p-mob' };
    const event = { ...request, ticketId: null, chatId: 'c-1', status: 'open' };
    act(() => MockEventSource.latest().emit(event, 'run-request'));

    expect(isInvalidated(queryClient, queryKeys.runRequests('r-1'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.chats('MOB'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.runRequests('r-2'))).toBe(false);
    expect(isInvalidated(queryClient, queryKeys.runSteps('r-1'))).toBe(false);
    expect(isInvalidated(queryClient, queryKeys.ticket('MOB-1'))).toBe(false);
  });

  it("reads the board again for a request of a ticket's run, as its row says Claude waits", () => {
    const { queryClient, wrapper } = setupApi();
    seed(queryClient);
    queryClient.setQueryData(queryKeys.runRequests('r-1'), []);
    renderHook(() => useLiveUpdates(), { wrapper });

    const request = { type: 'run-request', runId: 'r-1', requestId: 'q-1', projectId: 'p-mob' };
    const event = { ...request, ticketId: 't-1', chatId: null, status: 'open' };
    act(() => MockEventSource.latest().emit(event, 'run-request'));

    expect(isInvalidated(queryClient, queryKeys.runRequests('r-1'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.board('MOB'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.board('WEB'))).toBe(false);
    expect(isInvalidated(queryClient, queryKeys.ticket('MOB-1'))).toBe(false);
  });

  it("reads a run's last steps and its ended requests when it ends", () => {
    const { queryClient, wrapper } = setupApi();
    seed(queryClient);
    queryClient.setQueryData(queryKeys.runSteps('r-1'), []);
    queryClient.setQueryData(queryKeys.runRequests('r-1'), []);
    renderHook(() => useLiveUpdates(), { wrapper });

    const run = { type: 'run', runId: 'r-1', runnerId: 'h-1', projectId: 'p-mob', ticketId: 't-1' };
    act(() => MockEventSource.latest().emit({ ...run, status: 'done' }, 'run'));

    expect(isInvalidated(queryClient, queryKeys.runSteps('r-1'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.runRequests('r-1'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.board('MOB'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.board('WEB'))).toBe(false);
  });

  it('refreshes chats and steps after a reconnect, which may have missed an answer or steps', () => {
    const { queryClient, wrapper } = setupApi();
    queryClient.setQueryData(queryKeys.chat('c-1'), null);
    queryClient.setQueryData(queryKeys.chats('MOB'), []);
    queryClient.setQueryData(queryKeys.runSteps('r-1'), []);
    renderHook(() => useLiveUpdates(), { wrapper });
    const source = MockEventSource.latest();
    act(() => source.emit(mobTicketChanged));
    expect(isInvalidated(queryClient, queryKeys.runSteps('r-1'))).toBe(false);
    act(() => {
      source.fail(false);
      source.open();
    });
    expect(isInvalidated(queryClient, queryKeys.chat('c-1'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.chats('MOB'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.runSteps('r-1'))).toBe(true);
  });

  it('leaves a ticket alone while one of its edits is still saving', async () => {
    const request = deferred<Ticket>();
    const { queryClient, wrapper } = setupApi({ updateTicket: vi.fn(() => request.promise) });
    seed(queryClient);
    const { result } = renderHook(
      () => {
        useLiveUpdates();
        return useUpdateTicket();
      },
      { wrapper },
    );

    act(() => result.current.mutate({ ticketKey: 'MOB-1', input: { title: 'Typing' } }));
    await waitFor(() => expect(queryClient.isMutating()).toBe(1));
    act(() => MockEventSource.latest().emit(mobTicketChanged));

    expect(isInvalidated(queryClient, queryKeys.ticket('MOB-1'))).toBe(false);
    expect(isInvalidated(queryClient, queryKeys.board('MOB'))).toBe(false);
    expect(isInvalidated(queryClient, queryKeys.projects())).toBe(true);
  });

  it('refreshes everything after a reconnect', () => {
    const { queryClient, wrapper } = setupApi();
    seed(queryClient);
    renderHook(() => useLiveUpdates(), { wrapper });
    const source = MockEventSource.latest();

    act(() => source.open());
    expect(isInvalidated(queryClient, queryKeys.board('WEB'))).toBe(false);
    act(() => {
      source.fail(false);
      source.open();
    });

    expect(isInvalidated(queryClient, queryKeys.board('WEB'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.board('MOB'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.ticket('MOB-1'))).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.session())).toBe(false);
  });

  it('holds focus reads from a drop until the reopened stream opens, and not once stopped', () => {
    const { queryClient, wrapper } = setupApi();
    const { unmount } = renderHook(() => useLiveUpdates(), { wrapper });
    const source = MockEventSource.latest();
    act(() => source.open());
    expect(isLiveRefreshPending(queryClient)).toBe(false);

    act(() => source.fail(false));
    expect(isLiveRefreshPending(queryClient)).toBe(true);
    act(() => source.open());
    expect(isLiveRefreshPending(queryClient)).toBe(false);

    act(() => source.fail(false));
    unmount();
    expect(isLiveRefreshPending(queryClient)).toBe(false);
  });

  it('signs out when the server refuses the stream because the session is gone', async () => {
    const signedOut = { authRequired: true, authenticated: false };
    const getSession = vi.fn().mockResolvedValue(signedOut);
    const { queryClient, wrapper } = setupApi({ getSession });
    seed(queryClient);
    renderHook(() => useLiveUpdates(), { wrapper });
    const source = MockEventSource.latest();
    act(() => source.open());

    act(() => source.fail(true));

    await waitFor(() => expect(queryClient.getQueryData(queryKeys.session())).toEqual(signedOut));
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it('reopens a stream waiting to reopen as soon as the tracker answers again', () => {
    const { queryClient, wrapper } = setupApi();
    seed(queryClient);
    let unreachable = true;
    const listeners = new Set<() => void>();
    const tracker = {
      isUnreachable: () => unreachable,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => void listeners.delete(listener);
      },
    };
    renderHook(() => useLiveUpdates(tracker), { wrapper });
    act(() => MockEventSource.latest().fail(true));

    act(() => {
      unreachable = false;
      listeners.forEach((listener) => listener());
    });
    expect(MockEventSource.instances).toHaveLength(2);
    act(() => MockEventSource.latest().open());

    expect(isInvalidated(queryClient, queryKeys.board('MOB'))).toBe(true);
  });

  it('closes the stream on unmount', () => {
    const { wrapper } = setupApi();
    const { unmount } = renderHook(() => useLiveUpdates(), { wrapper });
    const source = MockEventSource.latest();
    unmount();
    expect(source.readyState).toBe(MockEventSource.CLOSED);
  });
});
