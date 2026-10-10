import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../queryKeys';
import { isInvalidated, setupApi } from '../test/render';
import { makeRun } from '../test/runFixtures';
import {
  runsRefreshMs,
  useCancelRun,
  useStartRun,
  useTicketRuns,
  WORKING_RUN_REFRESH_MS,
} from './runs';

const older = makeRun({ id: 'r-0', status: 'failed', error: 'Exit 1' });

describe('runsRefreshMs', () => {
  it('reads the runs again only while the latest one waits or works', () => {
    expect(runsRefreshMs([makeRun({ status: 'queued' })])).toBe(WORKING_RUN_REFRESH_MS);
    expect(runsRefreshMs([makeRun({ status: 'running' }), older])).toBe(WORKING_RUN_REFRESH_MS);
    expect(runsRefreshMs([older, makeRun({ status: 'running' })])).toBe(false);
    expect(runsRefreshMs([])).toBe(false);
    expect(runsRefreshMs(undefined)).toBe(false);
  });
});

describe('useTicketRuns', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks again every 30 s while Claude works, since the tracker only then ends a silent run', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const listTicketRuns = vi
      .fn()
      .mockResolvedValueOnce([makeRun({ status: 'running' })])
      .mockResolvedValue([
        makeRun({ status: 'failed', error: 'Your computer stopped answering.' }),
      ]);
    const { wrapper } = setupApi({ listTicketRuns });
    const { result } = renderHook(() => useTicketRuns('MOB-1'), { wrapper });
    await waitFor(() => expect(result.current.data?.[0]?.status).toBe('running'));

    await act(() => vi.advanceTimersByTimeAsync(WORKING_RUN_REFRESH_MS));
    await waitFor(() => expect(result.current.data?.[0]?.status).toBe('failed'));
    await act(() => vi.advanceTimersByTimeAsync(WORKING_RUN_REFRESH_MS * 3));
    expect(listTicketRuns).toHaveBeenCalledTimes(2);
    expect(listTicketRuns).toHaveBeenCalledWith('MOB-1');
  });
});

describe('useStartRun', () => {
  it('shows the new run on its ticket at once and reads the runs again', async () => {
    const run = makeRun();
    const startRun = vi.fn().mockResolvedValue(run);
    const { queryClient, wrapper } = setupApi({ startRun });
    queryClient.setQueryData(queryKeys.ticketRuns('MOB-1'), [older]);
    const { result } = renderHook(() => useStartRun(), { wrapper });

    const input = { runnerId: 'h-dara', prompt: 'Please work on MOB-1.' };
    act(() => result.current.mutate({ ticketKey: 'mob-1', input }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(startRun).toHaveBeenCalledWith('mob-1', input);
    expect(queryClient.getQueryData(queryKeys.ticketRuns('MOB-1'))).toEqual([run, older]);
    expect(isInvalidated(queryClient, queryKeys.ticketRuns('MOB-1'))).toBe(true);
  });

  it('reads the runs again after a refusal, which may mean a run started elsewhere', async () => {
    const startRun = vi.fn().mockRejectedValue(new Error('Claude is already working on MOB-1.'));
    const { queryClient, wrapper } = setupApi({ startRun });
    queryClient.setQueryData(queryKeys.ticketRuns('MOB-1'), []);
    const { result } = renderHook(() => useStartRun(), { wrapper });

    act(() =>
      result.current.mutate({ ticketKey: 'MOB-1', input: { runnerId: 'h-dara', prompt: 'Go' } }),
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isInvalidated(queryClient, queryKeys.ticketRuns('MOB-1'))).toBe(true);
  });
});

describe('useCancelRun', () => {
  it('shows the cancelled run in place of the working one', async () => {
    const working = makeRun({ status: 'running' });
    const cancelled = { ...working, status: 'cancelled' as const, endedAt: Date.now() };
    const cancelRun = vi.fn().mockResolvedValue(cancelled);
    const { queryClient, wrapper } = setupApi({ cancelRun });
    queryClient.setQueryData(queryKeys.ticketRuns('MOB-1'), [working, older]);
    const { result } = renderHook(() => useCancelRun(), { wrapper });

    act(() => result.current.mutate(working));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cancelRun).toHaveBeenCalledWith(working.id);
    expect(queryClient.getQueryData(queryKeys.ticketRuns('MOB-1'))).toEqual([cancelled, older]);
  });
});
